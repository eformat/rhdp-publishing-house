# Pre-Intake Workflow Design

**Date:** 2026-09-15  
**Status:** Implementation Spec  
**Related:** Pre-Intake Onboarding Design, Field Source Content Design

---

## Workflow States

### New States

| State | Type | Purpose | Timeout |
|-------|------|---------|---------|
| **PreIntakeUpdate** | event-wait | User updates pre-intake details after sendback | None (waits for user action) |
| **PreIntakeReview** | event-wait | Reviewer evaluates submission (approve/sendback/reject) | 168h (7 days) |
| **UpdateEpic** | operation | Syncs final approved data from ProForma form to Jira epic | N/A (async) |
| **WaitForEpicUpdate** | event-wait | Waits for UpdateEpic completion | 30s |
| **CreateRepo** | operation | Creates GitHub repo from template, adds collaborators | N/A (async) |
| **WaitForRepo** | event-wait | Waits for CreateRepo completion | 60s |
| **Rejected** | inject (terminal) | Terminal state for rejected pre-intake submissions | N/A |

### Modified States

| State | Change |
|-------|--------|
| **CreateEpic** | Now async - triggers operation and transitions to WaitForEpic |
| **WaitForEpic** | New wait state after CreateEpic |

---

## Events

### New Consumed Events

```yaml
# Pre-Intake Review Actions
- name: PreIntakeApprovedEvent
  type: ph.preintake.approved
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid

- name: PreIntakeSendBackEvent
  type: ph.preintake.sendback
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid

- name: PreIntakeRejectedEvent
  type: ph.preintake.rejected
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid

# Pre-Intake Update Submission
- name: PreIntakeUpdateSubmittedEvent
  type: ph.preintake.update.submitted
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid

# Async Operation Completions
- name: EpicCreatedEvent
  type: ph.epic.created
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid

- name: EpicUpdatedEvent
  type: ph.epic.updated
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid

- name: RepoCreatedEvent
  type: ph.repo.created
  source: publishing-house
  kind: consumed
  correlation:
    - contextAttributeName: projectid
```

---

## State Transitions

### Happy Path (No Sendback)

```
Init → Setup → CreateEpic → WaitForEpic → PreIntakeUpdate → PreIntakeReview
  → (approved) → UpdateEpic → WaitForEpicUpdate → CreateRepo → WaitForRepo → Intake
```

**Key Points:**
- PreIntakeUpdate is initially **skipped** (goes straight to PreIntakeReview)
- First time through, reviewer sees initial template submission
- On approval, epic updated with ProForma values, repo created

### Sendback Loop

```
PreIntakeReview → (sendback) → PreIntakeUpdate
  → (user submits) → PreIntakeReview
  → (sendback) → PreIntakeUpdate
  → (user submits) → PreIntakeReview
  → (approved) → UpdateEpic → ...
```

**Key Points:**
- Can loop multiple times
- Each loop updates workflow data
- Epic is NOT updated until final approval
- PreIntakeUpdate becomes "active" after first sendback

### Rejection Path

```
PreIntakeReview → (rejected) → Rejected (terminal)
```

**Key Points:**
- Workflow ends
- Epic remains in Jira (marked as rejected)
- No repo created
- No cleanup needed (nothing created yet)

---

## State Definitions

### PreIntakeUpdate

```yaml
- name: PreIntakeUpdate
  type: event
  exclusive: true
  onEvents:
    - eventRefs:
        - PreIntakeUpdateSubmittedEvent
      eventDataFilter:
        toStateData: ".updatedFields"
  stateDataFilter:
    input: |
      . + {
        updatedFields: null,
        reviewHistory: ((.reviewHistory // []) + [{
          stage: "preintake_update",
          action: "submitted",
          timestamp: (now | tostring),
          user: .ssoUser
        }])
      }
    output: |
      . + (.updatedFields // {}) + {
        reviewHistory: ((.reviewHistory // []) + [{
          stage: "preintake_update",
          action: "completed",
          timestamp: (now | tostring),
          user: .ssoUser
        }])
      } | del(.updatedFields)
  transition:
    nextState: PreIntakeReview
```

### PreIntakeReview

```yaml
- name: PreIntakeReview
  type: event
  exclusive: true
  onEvents:
    - eventRefs:
        - PreIntakeApprovedEvent
      eventDataFilter:
        toStateData: ".reviewAction"
    - eventRefs:
        - PreIntakeSendBackEvent
      eventDataFilter:
        toStateData: ".reviewAction"
    - eventRefs:
        - PreIntakeRejectedEvent
      eventDataFilter:
        toStateData: ".reviewAction"
  timeouts:
    stateExecTimeout: PT168H  # 7 days
  stateDataFilter:
    input: |
      . + {
        reviewAction: null,
        reviewHistory: ((.reviewHistory // []) + [{
          stage: "preintake_review",
          action: "started",
          timestamp: (now | tostring),
          user: "system"
        }])
      }
    output: |
      . + {
        reviewHistory: ((.reviewHistory // []) + (if .reviewAction then [.reviewAction] else [] end)),
        rejection: (
          if .reviewAction and .reviewAction.action == "rejected"
          then {
            isRejected: true,
            reviewerName: .reviewAction.user,
            reviewerStage: "preintake",
            timestamp: .reviewAction.timestamp,
            reasons: (.reviewAction.reasons // [])
          }
          else { isRejected: false }
          end
        )
      } | del(.reviewAction)
  transition:
    nextState: PreIntakeReviewDecision
```

### PreIntakeReviewDecision

```yaml
- name: PreIntakeReviewDecision
  type: switch
  dataConditions:
    - condition: "${ .rejection.isRejected == true }"
      transition:
        nextState: Rejected
    - name: SendBack
      condition: |
        ${ 
          .reviewHistory[-1].action == "sendback"
        }
      transition:
        nextState: PreIntakeUpdate
  defaultCondition:
    transition:
      nextState: UpdateEpic
```

### UpdateEpic

```yaml
- name: UpdateEpic
  type: operation
  actions:
    - name: UpdateJiraEpic
      functionRef:
        refName: updatejiraepic
        arguments:
          epic_key: .epic_key
          epic_type: .deploymentMode
  transition:
    nextState: WaitForEpicUpdate
```

### WaitForEpicUpdate

```yaml
- name: WaitForEpicUpdate
  type: event
  exclusive: true
  onEvents:
    - eventRefs:
        - EpicUpdatedEvent
  timeouts:
    stateExecTimeout: PT30S
  transition:
    nextState: CreateRepo
```

### CreateRepo

```yaml
- name: CreateRepo
  type: operation
  actions:
    - name: CreateGitHubRepo
      functionRef:
        refName: createrepo
        arguments:
          project_id: .projectId
          repo_owner: "rhpds"
          template_repo: "https://github.com/rhpds/rhdp-publishing-house-template"
          collaborators: (.teamMembers // [])
  transition:
    nextState: WaitForRepo
```

### WaitForRepo

```yaml
- name: WaitForRepo
  type: event
  exclusive: true
  onEvents:
    - eventRefs:
        - RepoCreatedEvent
      eventDataFilter:
        toStateData: ".repoData"
  timeouts:
    stateExecTimeout: PT60S
  stateDataFilter:
    output: |
      . + {
        repoUrl: .repoData.repoUrl,
        commitHash: .repoData.commitHash
      } | del(.repoData)
  transition:
    nextState: Intake
```

### Rejected

```yaml
- name: Rejected
  type: inject
  data:
    stage: rejected
  end:
    terminate: true
```

### Modified CreateEpic

```yaml
- name: CreateEpic
  type: operation
  actions:
    - name: CreateJiraEpic
      condition: "${ .deploymentMode == \"rhdp_published\" }"
      functionRef:
        refName: createjiraepic
        arguments:
          epic_type: .deploymentMode
          fields: .
  transition:
    nextState: WaitForEpic
```

### WaitForEpic

```yaml
- name: WaitForEpic
  type: event
  exclusive: true
  onEvents:
    - eventRefs:
        - EpicCreatedEvent
      eventDataFilter:
        toStateData: ".epicData"
  timeouts:
    stateExecTimeout: PT30S
  stateDataFilter:
    output: |
      . + {
        epic_key: .epicData.epic_key,
        jira_url: .epicData.jira_url,
        proforma_form_id: (.epicData.proforma_form_id // "")
      } | del(.epicData)
  transition:
    nextState: PreIntakeUpdate
```

---

## Function Definitions

### createjiraepic

```yaml
- name: createjiraepic
  operation: specs/central-api.yaml#createJiraEpic
  type: rest
```

### updatejiraepic

```yaml
- name: updatejiraepic
  operation: specs/central-api.yaml#updateJiraEpic
  type: rest
```

### createrepo

```yaml
- name: createrepo
  operation: specs/central-api.yaml#createRepo
  type: rest
```

---

## Workflow Data Model

### Initial State (from Template)

```json
{
  "projectId": "my-lab-project",
  "ssoUser": "jsmith",
  "ssoEmail": "jsmith@redhat.com",
  "deploymentMode": "rhdp_published",
  
  "assetTitle": "OpenShift AI Workshop",
  "projectDescription": "Hands-on lab teaching...",
  "contentOutline": "Module 1: Intro\nModule 2: Deploy...",
  "learningObjectives": "- Deploy AI workloads\n- Configure...",
  "contentType": "lab",
  "associatedOpportunities": "RH1 2027",
  "salesPlayTdp": "AI/ML Sales Play",
  "aiRelated": true,
  "gpuNeeded": false,
  "maasInstead": true,
  "partnersAccess": false,
  "teamMembers": [
    {"user": "jsmith", "email": "jsmith@redhat.com", "access": "write"}
  ],
  "initiativeKey": "rh1_2027",
  "showroomType": "classic",
  "automationType": "ansible",
  "tags": ["openshift", "ai"]
}
```

### After CreateEpic

```json
{
  ...(all above),
  "epic_key": "RHDPCD-1234",
  "jira_url": "https://issues.redhat.com/browse/RHDPCD-1234",
  "proforma_form_id": "12345"
}
```

### After PreIntakeUpdate (sendback)

```json
{
  ...(all above),
  "assetTitle": "OpenShift AI Workshop - Updated",
  "contentOutline": "Module 1: Updated intro...",
  "reviewHistory": [
    {
      "stage": "preintake_review",
      "action": "sendback",
      "timestamp": "2026-09-15T10:00:00Z",
      "user": "reviewer@redhat.com",
      "notes": "Please clarify objectives"
    },
    {
      "stage": "preintake_update",
      "action": "submitted",
      "timestamp": "2026-09-15T14:30:00Z",
      "user": "jsmith"
    }
  ]
}
```

### After CreateRepo

```json
{
  ...(all above),
  "repoUrl": "https://github.com/rhpds/my-lab-project",
  "commitHash": "abc123..."
}
```

---

## Event Payloads

### ph.preintake.approved

```json
{
  "specversion": "1.0",
  "type": "ph.preintake.approved",
  "source": "publishing-house",
  "id": "uuid",
  "projectid": "my-lab-project",
  "data": {
    "stage": "preintake_review",
    "action": "approved",
    "timestamp": "2026-09-15T10:00:00Z",
    "user": "reviewer@redhat.com"
  }
}
```

### ph.preintake.sendback

```json
{
  "specversion": "1.0",
  "type": "ph.preintake.sendback",
  "source": "publishing-house",
  "id": "uuid",
  "projectid": "my-lab-project",
  "data": {
    "stage": "preintake_review",
    "action": "sendback",
    "timestamp": "2026-09-15T10:00:00Z",
    "user": "reviewer@redhat.com",
    "notes": "Please clarify learning objectives"
  }
}
```

### ph.preintake.update.submitted

```json
{
  "specversion": "1.0",
  "type": "ph.preintake.update.submitted",
  "source": "publishing-house",
  "id": "uuid",
  "projectid": "my-lab-project",
  "data": {
    "assetTitle": "Updated Title",
    "contentOutline": "Updated outline...",
    "learningObjectives": "Updated objectives..."
  }
}
```

### ph.epic.created

```json
{
  "specversion": "1.0",
  "type": "ph.epic.created",
  "source": "publishing-house",
  "id": "uuid",
  "projectid": "my-lab-project",
  "data": {
    "epic_key": "RHDPCD-1234",
    "jira_url": "https://issues.redhat.com/browse/RHDPCD-1234",
    "proforma_form_id": "12345"
  }
}
```

### ph.repo.created

```json
{
  "specversion": "1.0",
  "type": "ph.repo.created",
  "source": "publishing-house",
  "id": "uuid",
  "projectid": "my-lab-project",
  "data": {
    "repoUrl": "https://github.com/rhpds/my-lab-project",
    "commitHash": "abc123..."
  }
}
```

---

## Timeline Visualization States

### Stage Status Mapping

| Workflow State | Timeline Stage | Status |
|----------------|----------------|--------|
| Init, Setup | Init | completed |
| CreateEpic, WaitForEpic | CreateEpic | in_progress / completed |
| PreIntakeUpdate (first time) | PreIntakeUpdate | skipped |
| PreIntakeReview (first time) | PreIntakeReview | in_progress |
| PreIntakeUpdate (after sendback) | PreIntakeUpdate | in_progress |
| UpdateEpic, WaitForEpicUpdate | UpdateEpic | in_progress / completed |
| CreateRepo, WaitForRepo | CreateRepo | in_progress / completed |
| Intake | Intake | in_progress |

---

## Error Handling

### Epic Creation Failure

- If epic creation fails, workflow stays in WaitForEpic
- Timeout triggers retry or manual intervention
- No data loss - all fields in workflow state

### Repo Creation Failure

- If repo creation fails, workflow stays in WaitForRepo
- Can retry via manual CloudEvent
- Epic already exists and updated - safe to retry

### ProForma Not Available

- Epic created with description only
- proforma_form_id set to empty string
- UpdateEpic reads workflow state instead of form
- Fallback allows deployment on Jira instances without ProForma

---

**Status:** Ready for implementation

# Pre-Intake Onboarding Stage

Adds a new Pre-Intake stage to the Publishing House workflow that replaces the external JSM onboarding form (RHDPSPPT) + GPTEINFRA project Jira issue with an integrated RHDH Scaffolder template and review gate. Pulls all onboarding questions into PH so the full lifecycle — from initial request through publication — runs in one system.

## Motivation

Today, RHDP content onboarding starts with a JSM form in the RHDPSPPT Jira project that then creates an issue in the GPTEINFRA project. After review there, the content author separately creates a Publishing House project in RHDH which tracks work in the RHDPCD Jira project. The two systems are disjointed: decisions made during onboarding review don't automatically flow into the PH project, and there's no single place to track the full lifecycle.

This design eliminates the JSM form by embedding the same onboarding questions directly into the PH Scaffolder template, adding a review gate before intake begins, and creating the Jira tracking epic at submission time so the review conversation happens on the epic itself.

## Workflow Change

Current:
```
Init → Setup → CreateEpic → Intake → ContentReview → InfraReview → ... → Published
```

New:
```
Init → Setup → CreateEpic → PreIntake → Intake → ContentReview → InfraReview → ... → Published
                                │
                             rejected
                                │
                                ▼
                           Rejected (end)
```

Everything after PreIntake is unchanged. PreIntake is a mandatory stage for all projects — no bypass, no conditions.

## Template Changes

The RHDH Scaffolder template (`templates/publishing-house-project/template.yaml`) is restructured into two tabs. The `deployment_mode` field is removed — all projects created through this template are implicitly `rhdp_published`.

### Tab 1 — Onboarding Request

| # | Field | Type | Required | Destination |
|---|-------|------|----------|-------------|
| 1 | Asset Title | text | yes | `spec.title` in spec.yaml |
| 2 | Description / Abstract | textarea | yes | `project.description` in spec.yaml |
| 3 | Content Outline | textarea | yes | Jira epic form; seeds `spec.modules` on approval |
| 4 | Learning Objectives | textarea | yes | Jira epic form; seeds `spec.learning_objectives` on approval |
| 5 | Is this a lab or a demo? | radio (Lab / Demo) | yes | `project.content_type` in spec.yaml |
| 6 | Associated opportunities | textarea | no | Jira epic form only |
| 7 | Sales Play / TDP relevance | textarea | no | Jira epic form only |
| 8 | How will you automate? | radio (Ansible / GitOps / Both) | yes | `project.automation_type` in spec.yaml |
| 9 | Is this related to AI? | radio (Yes / No) | no | Jira epic form only |
| 10 | Do you need direct GPU access? | radio (Yes / No) | no | Jira epic form only |
| 11 | Can you use MaaS instead? | radio (Yes / No) | no | Jira epic form only |
| 12 | Should it be available to Partners? | radio (Yes / No) | no | Jira epic form only |

**Field labels and help text:**

- Field 2: *"What is this asset and why is it needed? High-level but clear."*
- Field 3: *"Rough outline of the modules or sections. Doesn't need to be final — just show the shape of what you're building."*
- Field 4: *"What will participants learn or be able to do? Draft quality is fine."*
- Field 6: *"Is this associated with any specific opportunities, projects, or marketing campaigns?"* (not required; N/A is acceptable)
- Field 7: *"Which TDP, Sales Play, and/or Sales Tactic is this most relevant to?"*

**Conditional logic (Backstage Scaffolder `dependencies`):**

- Field 9 (AI) = No → Fields 10 and 11 are hidden
- Field 9 (AI) = Yes → Field 10 is shown
- Field 10 (GPU) = Yes → Field 11 is hidden (they need real GPU)
- Field 10 (GPU) = No → Field 11 is shown

### Tab 2 — Project Setup

| Field | Type | Required |
|-------|------|----------|
| Project Name (slug) | text (pattern: `^[a-z0-9-]+$`) | yes |
| Team Members | list of { GitHub Username (text), Red Hat Email (email) } | yes (min 1) |
| Initiative | select (RH1 2027 / Summit 2027 / None) | yes |
| Showroom Type | radio (Classic / Zero Touch) | yes |
| Tags | tag list | no |

First team member entry = project owner. Red Hat email is collected for future dev CI RBAC (access control on dev.yaml files based on email). GitHub username is used for repo collaborator access.

### Removed Fields

- `deployment_mode` — removed. All projects are implicitly `rhdp_published`. Self-published content will be handled by a separate template in a future effort.

## Field Destination Mapping

Fields fall into two categories based on where they live after submission:

**spec.yaml fields** — written at template submission, used by the intake skill:
- Asset Title → `spec.title`
- Description → `project.description`
- Content type (lab/demo) → `project.content_type`
- Automation type → `project.automation_type`

**Jira-epic-only fields** — stored on the Jira epic for review context and historical record. Not written to spec.yaml at submission. On pre-intake approval, Central API reads the current values from the epic and syncs relevant fields (outline, objectives) back to spec.yaml:
- Content Outline → synced to `spec.modules` on approval (draft/seed quality)
- Learning Objectives → synced to `spec.learning_objectives` on approval (draft/seed quality)
- Associated opportunities → stays on epic only
- Sales Play / TDP → stays on epic only
- AI, GPU, MaaS, Partners → stay on epic only

## Scaffolder Steps

The existing scaffolder steps remain in the same order with one addition — the onboarding fields that go to the Jira epic are passed to the workflow trigger so they're available in SonataFlow workflow data (which the plugin UI reads for the review panel).

1. Check project name availability (unchanged)
2. Generate skeleton artifacts (unchanged, but spec.yaml now includes `spec.title` from the form)
3. Set creation timestamp (unchanged)
4. Create repository and push skeleton (unchanged, but team members now include email)
5. Start Publishing House workflow via Central API (updated: passes all onboarding fields)
6. Register in Developer Hub catalog (unchanged)

## SonataFlow Changes

### New Events

```yaml
- name: PreIntakeApprovedEvent
  type: ph.preintake.approved
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
```

### New States

**PreIntake** — event-wait state between CreateEpic and Intake. Same pattern as ContentReview: waits for either an approved or rejected event, records the action in reviewHistory.

```yaml
- name: PreIntake
  type: event
  exclusive: true
  onEvents:
    - eventRefs:
        - PreIntakeApprovedEvent
      eventDataFilter:
        toStateData: ".latestAudit"
    - eventRefs:
        - PreIntakeRejectedEvent
      eventDataFilter:
        toStateData: ".latestAudit"
  timeouts:
    stateExecTimeout: PT168H
  transition:
    nextState: PreIntakeDecision
```

**PreIntakeDecision** — switch state. Rejected → terminal. Approved → Intake.

```yaml
- name: PreIntakeDecision
  type: switch
  dataConditions:
    - condition: "${ .rejection.isRejected == true }"
      transition:
        nextState: Rejected
  defaultCondition:
    transition:
      nextState: Intake
```

**Rejected** — terminal state.

```yaml
- name: Rejected
  type: inject
  data:
    stage: rejected
  end:
    terminate: true
```

### Modified Transitions

- `CreateEpic` transition changes from `nextState: Intake` to `nextState: PreIntake`
- `CreateEpic` condition changes: epic creation is no longer conditional on `deploymentMode == "rhdp_published"` since all projects are now rhdp_published. The condition can be removed or kept as a no-op guard.

## Central API Changes

### New Endpoint

```
POST /api/v1/projects/{slug}/preintake
```

**Request:**
```json
{
  "action": "approved" | "rejected",
  "reason": "optional text"
}
```

**Auth:** Requires membership in a reviewer group (either a new `rhdp-preintake-review` group or the existing `rhdp-administrators` group — to be decided during implementation).

**On approve:**
1. Read current onboarding fields from the Jira epic form (via ProForma REST API)
2. Compare with current spec.yaml in the repo
3. If any mapped fields changed (outline, objectives, title, description), commit an updated spec.yaml to the repo
4. Send `ph.preintake.approved` CloudEvent to SonataFlow

**On reject:**
1. Post rejection reason as a comment on the Jira epic
2. Send `ph.preintake.rejected` CloudEvent to SonataFlow

### Updated Epic Creation

The existing `POST /api/v1/jira/epic` endpoint is updated:

- Epic description now includes all onboarding form answers in a structured format
- A ProForma form is attached to the epic via the Jira Forms REST API, pre-populated with the onboarding field values. This form is editable in Jira, allowing the reviewer and submitter to modify answers during the pre-intake review conversation.
- Epic summary format: `[PH] {asset_title}` (uses the new Asset Title field instead of just the slug)

### Jira Forms Integration

Central API uses the ProForma REST API (`/rest/api/1/form`) to:

1. **On epic creation:** Create a form on the epic with all onboarding fields pre-populated from the template submission
2. **On pre-intake approval:** Read the current form values from the epic, diff against spec.yaml, and sync any changes

The form gives reviewers and submitters a structured, editable UI on the Jira epic — no need to edit YAML or parse free-text descriptions.

## Plugin UI Changes

A new "Pre-Intake Review" panel is added to the project detail page in the RHDH plugin. Same component pattern as the existing content review and infra review panels.

- Visible when workflow is in `PreIntake` state and user has reviewer permissions
- Displays onboarding form answers from workflow data
- Approve / Reject buttons with optional reason text field
- Calls `POST /api/v1/projects/{slug}/preintake`

## Data Flow Summary

```
┌─────────────────┐
│  RHDH Template   │  User fills out onboarding + project setup fields
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Scaffolder      │  Creates repo (spec.yaml with mapped fields),
│  Steps           │  triggers workflow, registers component
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Central API     │  Creates Jira epic with ProForma form
│  (CreateEpic)    │  pre-populated from onboarding answers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PreIntake       │  Reviewer and submitter converse on Jira epic,
│  (SonataFlow     │  may edit form values directly in Jira.
│   wait state)    │  Reviewer approves/rejects via RHDH plugin.
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Approved   Rejected
    │         │
    ▼         ▼
┌────────┐  ┌──────────┐
│Central │  │ Terminal  │
│API sync│  │ end state │
│spec.yml│  └──────────┘
│from    │
│Jira    │
└───┬────┘
    │
    ▼
  Intake (existing workflow continues)
```

## Open Items

1. **ProForma form template** — Define the exact form structure (field types, labels, validation rules) for the onboarding form attached to the epic. Implementation team should validate that the ProForma REST API supports creating forms on Epic issue types in the RHDPCD project.

2. **Reviewer group** — Decide whether pre-intake review uses a new `rhdp-preintake-review` Keycloak group or reuses `rhdp-administrators`. Affects the auth check on the Central API endpoint and the plugin UI visibility.

3. **Field 6 final wording** — Current draft: *"Is this associated with any specific opportunities, projects, or marketing campaigns?"* May be refined during implementation.

4. **spec.yaml sync granularity** — Define the exact mapping from ProForma form fields to spec.yaml fields for the approval sync. Content outline → `spec.modules` and Learning objectives → `spec.learning_objectives` need a parsing strategy (e.g., one bullet point per module/objective).

5. **Rejected project cleanup** — Decide whether rejected projects should have their repos archived/deleted or left as-is. Currently spec says workflow just terminates.

## What Does Not Change

- Intake stage and skill behavior
- Content Review and Infra Review stages
- JiraSync stages
- Development, EnvSetup, Testing, Published stages
- The spec.yaml structure (existing fields remain; no new sections added)
- The publishing-house-template repo skeleton
- DevSpaces integration
- API key management
- RCARS integration

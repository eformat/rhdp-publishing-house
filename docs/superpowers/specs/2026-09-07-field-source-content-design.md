# Field Source Content — New Project Type

Adds a new project type and workflow to Publishing House for field-contributed content (demos, labs) that doesn't require the full onboarding rigor of RHDP-published items. Field source content gets its own Scaffolder template, a lighter review process, and automated AgnosticV catalog item creation — making field-built content discoverable in RHDP without the overhead of full onboarding.

## Motivation

Today, field source content in RHDP is a single generic catalog item (`ocp-field-asset-cnv`) where the user pastes a GitOps repo URL at order time. This works but has two problems:

1. **No discoverability.** Since everything goes through one generic item, there's no catalog of what people have built. A field-created demo is invisible unless you know the repo URL.
2. **No growth path.** Moving a successful field demo to a fully onboarded RHDP item requires starting from scratch — different repo structure, different automation patterns, different catalog entry.

Publishing House solves both by creating a per-project virtual CI in AgnosticV that appears in the RHDP catalog (hidden by default behind an SLA label, opt-in to discover). The developer works in a PH-created monorepo (or their own repo via a stub), and the automation follows the same patterns as onboarded content — so graduating to fully onboarded later is straightforward.

This replaces the `self_published` deployment mode being removed from the main PH template.

## Workflow

```
Template → CreateEpic → PreIntake → Create Monorepo + Dev CI (PR) → Development
                                                                        │
                                                                   [Ready for Testing]
                                                                        │
                                                                   Create Test CI (PR) → Testing
                                                                                            │
                                                                                       [Ready for Prod]
                                                                                            │
                                                                                       Prod Approval → Create Prod CI (PR) → Published
```

- **No intake stage.** The pre-intake questionnaire captures enough design thinking. RCARS runs at epic creation as advisory context.
- **No infra review.** The base component is canned; there's nothing to review.
- **Single review gate at the front (PreIntake).** Reviewed by `rhdp-field-source-reviewers` Keycloak group.
- **Prod approval gate at the back.** Same reviewer group. This is the one moment content goes from "your team" to "everyone in RHDP."
- **All AgnosticV changes go through PRs** — initial creation, test/prod CI creation, config updates. PH opens the PR and shows the link; it doesn't block the workflow on merge.

### Stage Details

| Stage | Type | What Happens | Timeout |
|-------|------|-------------|---------|
| CreateEpic | operation | Creates Jira epic in RHDPCD with `project_type: field_source` label. RCARS results posted as advisory comment on epic. | — |
| PreIntake | event-wait | Reviewer approves or rejects. On approve: monorepo created, dev CI PR opened in AgnosticV. | 45 days → Stalled |
| Development | event-wait | Developer works in monorepo, orders via RHDP catalog. Plugin shows "Ready for Testing" button. | 45 days → Stalled |
| Testing | event-wait | Test CI PR opened. Developer validates with wider access. Plugin shows "Ready for Production" button. | 45 days → Stalled |
| ProdApproval | event-wait | Reviewer gate. On approve: prod CI PR opened. | 45 days → Stalled |
| Published | terminal | Prod CI available to all RHDP users (behind SLA label filter). | — |
| Stalled | event-wait | Notification sent. Reviewer can resume or delete. | — |

### Stalled State

When a 45-day timeout fires, the workflow transitions to Stalled. This triggers a notification (Jira comment on epic, optionally email). Stalled is a wait state (not terminal) — it waits for a reviewer action:
- **Resume** — transitions back to the previous stage (resets the 45-day timeout)
- **Delete** — cleanup action removes AgnosticV files, archives/deletes monorepo, closes Jira epic, then transitions to a terminal Deleted state

## Template

New Scaffolder template: "Field Source Content Project" (separate from the onboarded project template).

### Tab 1 — Your Project

| # | Field | Type | Required | Destination |
|---|-------|------|----------|-------------|
| 1 | Asset Title | text | yes | `spec.title`, slug auto-derived |
| 2 | Description | textarea | yes | `project.description`, Jira epic |
| 3 | Content Outline | textarea | yes | Jira epic |
| 4 | Learning Objectives | textarea | no | Jira epic |
| 5 | Lab or Demo? | radio (Lab / Demo) | yes | `project.content_type` |
| 6 | Sales Play / TDP | textarea | no | Jira epic only |
| 7 | Team Members | list of {GitHub Username, Red Hat Email} | yes (min 1) | Repo collaborators, dev.yaml ACLs |
| 8 | Where will your automation live? | radio (PH repo / Existing repo) | yes | Determines monorepo content |
| 9 | Existing Repo URL | text | conditional (if #8 = Existing) | Monorepo stub target |
| 10 | Tags | tag list | no | `project.tags` |

**Field 8 help text:** Explain the tradeoff — PH repo means the automation lives alongside content in a standard structure (easier to graduate to fully onboarded later); existing repo means PH creates a stub that points to your repo (you keep working where you are, but graduation requires moving automation later).

**Slug derivation:** Auto-derived from Asset Title (lowercase, spaces to hyphens, strip special chars). Shown below the title field for confirmation. Prefixed with `fs-` for the AgnosticV CI name.

### Tab 2 — Environment Configuration

| # | Field | Type | Required | Notes |
|---|-------|------|----------|-------|
| 11 | Cloud Provider | radio (CNV / AWS / Azure) | yes | Default CNV |
| 12 | Cloud Provider Justification | textarea | conditional | If not CNV |
| 13 | Cluster Type | radio (SNO / Multinode) | yes | Default SNO |
| 14 | OCP Version | select (4.20 / 4.21 / 4.22) | yes | Default 4.21 |
| 15 | Worker Count | integer | conditional | If multinode |
| 16 | Worker Memory (GB) | select | conditional | If multinode |
| 17 | Worker CPU | select | conditional | If multinode |
| 18 | Base Workloads | multi-select (OpenShift Virtualization / OpenShift AI / AAP) | no | Hardcoded in virtual CI |
| 19 | Multi-user? | boolean | no | Default false |
| 20 | User Count | integer (1-50) | conditional | If multi-user = yes |
| 21 | Are you doing anything with AI? | radio (Yes / No) | no | |
| 22 | Do you need direct GPU access? | radio (Yes / No) | conditional | If AI = Yes |
| 23 | Can you use MaaS instead? | radio (Yes / No) | conditional | If AI = Yes and GPU = No |

**Conditional logic:**

- AI = No → fields 22, 23 hidden
- AI = Yes → field 22 shown
- GPU = Yes → cloud provider forced to AWS; field 23 hidden
- GPU = No → field 23 shown

**All environment fields are hardcoded into the virtual CI.** They are not order-time parameters. The developer's automation expects these workloads/config to be present — making them selectable at order time would cause failures. Changes go through the "Apply Config" mechanism (see below).

## AgnosticV Structure

### Directory

```
agnosticv/field-source/fs-<slug>/
  common.yaml
  description.adoc
  dev.yaml        # created at PreIntake approval
  test.yaml       # created at "Ready for Testing"
  prod.yaml       # created at Prod Approval
```

**CI name character limit:** Keep `fs-<slug>` under 50 characters total. Flag for developer verification on exact AgnosticV limit.

### Virtual CI Structure

The virtual CI follows the same pattern as published virtual CIs. The component is the field source base component — `ocp-field-asset-cnv` for CNV, with AWS/Azure variants as they become available. Cloud provider selection in the template determines which base component is used.

**`common.yaml`** contains:
- `#include` for the base component (e.g., `ocp-field-asset-cnv`)
- Access restriction (devs only on dev/test; open on prod)
- Catalog metadata with `labels.SLA: Field_Supported`
- Hardcoded environment variables from the spec:
  - `existing_gitops: true`
  - `ocp4_workload_field_content_gitops_repo_url: <monorepo URL>`
  - `ocp4_workload_field_content_gitops_repo_revision: main`
  - `ocp4_workload_field_content_gitops_repo_path: <automation path>`
  - Base workload toggles (`enable_base_virt`, `enable_base_rhoai`, `enable_base_aap`)
  - `create_multi_user` and `num_users`
  - `enable_litemaas_keys` (if MaaS = yes)
  - OCP version, cluster type, worker config

**`dev.yaml`** contains:
- `purpose: development`
- ACLs restricting access to the team members listed in the template
- `__meta__.deployer.scm_ref: main`

**`test.yaml`** contains:
- `purpose: testing`
- ACLs potentially widened to additional users
- `__meta__.deployer.scm_ref: main` (or a tagged version)

**`prod.yaml`** contains:
- `purpose: production`
- No ACL restrictions (available to all RHDP users, filtered by SLA label)
- `__meta__.deployer.scm_ref: <tagged version>`

### UI Filtering

`common.yaml` includes:

```yaml
__meta__:
  catalog:
    labels:
      SLA: Field_Supported
```

The RHDP UI hides items with `SLA: Field_Supported` by default. Users opt in to see field source content via a filter/toggle.

## Monorepo

PH creates the monorepo at **template submission time** (Scaffolder step, same as onboarded content). The repo exists before pre-intake review so the reviewer can see the skeleton. The dev CI in AgnosticV is created later, at pre-intake approval. Standard structure with content and automation directories.

**If BYO repo selected:** The monorepo is still created, but the automation directory contains a stub pointing to the external repo URL. The virtual CI's `ocp4_workload_field_content_gitops_repo_url` points to the PH monorepo regardless — the stub handles the redirection.

## Jira

- Epic created in **RHDPCD** project
- Epic labeled with `project_type: field_source` for board/filter separation
- RCARS results posted as advisory comment on epic at creation time (informational, not blocking)
- Pre-intake review conversation happens on the epic (same pattern as onboarded)
- PR links posted as comments when AgnosticV PRs are opened

## Central API Changes

### New Endpoints

```
POST /api/v1/projects/{slug}/field-source/advance
```

Handles stage transitions (Ready for Testing, Ready for Prod). Creates AgnosticV branch, commits yaml files, opens PR via GitHub API, returns PR URL.

```
POST /api/v1/projects/{slug}/field-source/apply-config
```

Reads current spec.yaml from monorepo, regenerates virtual CI parameters, opens PR to update AgnosticV files. Returns PR URL.

```
POST /api/v1/projects/{slug}/field-source/cleanup
```

Tears down a stalled or deleted project: removes AgnosticV files (via PR or direct if permitted), archives/deletes monorepo, closes Jira epic.

### Modified Endpoints

- `POST /api/v1/jira/epic` — supports `project_type: field_source` label and RCARS advisory comment
- Existing pre-intake endpoint works as-is (same CloudEvent pattern)

## SonataFlow

Separate workflow definition for field source content. Does not reuse the onboarded workflow — the stage sequence is different enough that conditional branching would be more complex than a second workflow.

### Events

```yaml
- name: FSPreIntakeApprovedEvent
  type: ph.fs.preintake.approved
- name: FSPreIntakeRejectedEvent
  type: ph.fs.preintake.rejected
- name: FSReadyForTestingEvent
  type: ph.fs.ready-for-testing
- name: FSReadyForProdEvent
  type: ph.fs.ready-for-prod
- name: FSProdApprovedEvent
  type: ph.fs.prod.approved
- name: FSProdRejectedEvent
  type: ph.fs.prod.rejected
```

### States

`Init → Setup → CreateEpic → PreIntake → PreIntakeDecision → Development → Testing → ProdApproval → ProdApprovalDecision → Published`

With `Stalled` as a timeout destination from Development, Testing, and ProdApproval (45-day timeout). `Stalled` waits for a resume or delete event. `Deleted` is the terminal state for cleaned-up projects.

**Prod rejection** returns to Testing (same pattern as onboarded content review rejection returning to intake — gives the developer a chance to fix issues and re-submit).

## Plugin UI Changes

### New Template

"Field Source Content Project" template registered in RHDH alongside the existing onboarded template.

### Project Detail Page

- **Stage indicator** showing current workflow state
- **"Ready for Testing" button** — visible in Development stage
- **"Ready for Production" button** — visible in Testing stage
- **"Approve / Reject" panel** — visible in PreIntake and ProdApproval stages for `rhdp-field-source-reviewers` group members
- **"Apply Config" button** — visible in Development, Testing stages. Opens PR to update virtual CI from current spec.
- **PR status links** — shows pending AgnosticV PRs with merge status
- **"Delete Project" action** — available to reviewers on stalled projects

## Base Component Selection

The base component of the virtual CI is determined by the cloud provider selected in the template:

| Cloud Provider | Base Component |
|---------------|----------------|
| CNV | `ocp-field-asset-cnv` |
| AWS | `ocp-field-asset-aws` |
| Azure | `ocp-field-asset-azure` |

Central API validates the component against a **hardcoded allowlist** of approved field source base components. The spec.yaml stores the selected component, and Apply Config reads it — but the API rejects any value not on the allowlist. No freeform component selection.

**Future extension point:** This design intentionally keeps all component selection logic in Central API, not in SonataFlow. The workflow doesn't know or care which base component is used. This means the component selection logic can be changed (e.g., RCARS suggests a more specific base component, or new component types are added) without any workflow changes — just update the API's allowlist and selection logic. The allowlist can be loosened over time as more base components are validated.

## What Does Not Change

- Onboarded content workflow (Init → Setup → CreateEpic → PreIntake → Intake → ContentReview → InfraReview → ... → Published)
- The `ocp-field-asset-cnv` base component itself (PH consumes it; doesn't modify it)
- RCARS service (PH calls it the same way)
- API key management
- DevSpaces integration (not used for field source)
- LiteMaaS key provisioning from PH (not used; base component handles MaaS at order time if enabled)

## Open Items

1. **AgnosticV CI name character limit** — Confirm the exact maximum. Spec assumes 50 characters for `fs-<slug>`. Developer to verify.

2. **BYO repo stub pattern** — Define the exact mechanism for the monorepo stub pointing to an external repo. Options include an ArgoCD Application manifest or a Helm chart wrapper. Depends on how the `ocp4_workload_field_content` role consumes the repo.

3. **Stalled → Resume transition** — Define whether resuming from Stalled requires reviewer action or if the developer can self-resume. Spec assumes reviewer action.

4. **AWS/Azure base components** — `ocp-field-asset-aws` and `ocp-field-asset-azure` don't exist yet. Field source on non-CNV providers depends on these being created. CNV is the only supported provider at launch.

5. **RHEL-based field source content** — Called out as future need. Template captures automation type (Ansible / GitOps / Both) to preserve the option, but only GitOps/OCP is supported at launch. RHEL would require a different base component and deployment pattern.

6. **PR merge notification** — When an AgnosticV PR is merged, PH should ideally update the project status. Options: GitHub webhook, polling, or manual "PR merged" button. Not critical for v1 — the developer can see the PR status via the link.

7. **Test CI access widening** — Define whether additional users can be added at the testing stage and how (plugin UI field, or manual spec edit + Apply Config).

8. **Automation type field** — Currently captures Ansible / GitOps / Both but only GitOps is supported. Decide whether to show all options with a note, or limit to GitOps for v1 and expand later.

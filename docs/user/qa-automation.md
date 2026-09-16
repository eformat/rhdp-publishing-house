# QA Automation

Two checks verify your project works after it's provisioned: `healthcheck.yml` confirms the environment came up healthy, and `e2e.yml` walks through the learner's steps start to finish. This page covers what each check does, where they live, how to write them for both OCP and RHEL/Zero Touch infrastructure, worked examples of each, and the provisioning config some checks need.

## Where checks live

Every project scaffolds a `qa-automation/` directory with two stub playbooks: `healthcheck.yml` and `e2e.yml`. Both start as `TODO` placeholders — you replace them as part of building automation. Whatever pattern your project scaffolded from (Open, Guided, or ZT Guided), the two files live in the same place and are exercised the same way, regardless of infrastructure — see "Running against a deployed Showroom" below.

## healthcheck.yml

Checks that the services **your workshop/demo provisions** are up after provisioning finishes.

**In scope** — anything your automation deploys on top of the base infrastructure:

- Custom workloads deployed via Ansible roles/collections
- ArgoCD Applications (sync + health status)
- Services/processes started on a VM (systemd units, containers, listening ports)
- Any app endpoint your automation stands up

**Out of scope** — the base infrastructure itself. That's already verified by whoever provisions it (AgnosticD / demo team infra), before your automation ever runs:

- OpenShift cluster health (API server, console, node status)
- VM boot, OS, network reachability

| Your demo uses... | Health-check | Don't health-check |
|---|---|---|
| OCP cluster + custom workloads (Ansible/GitOps) | Workload pods Running, app endpoints respond, ArgoCD Application sync/health | Cluster API server, console, node health |
| A VM + services you start on it | Your services (systemd units, containers, app ports) | The VM itself (boot, OS, network) |

**Requirements:**

- Completes in under 60 seconds
- Exit `0` = healthy, non-zero = unhealthy
- Non-destructive and idempotent — safe to run against a live environment, safe to re-run

## e2e.yml

Walks through the learner's steps from the module content and confirms the workshop/demo can be completed start to finish, unattended. Script the learner's documented steps directly — CLI/API calls that mirror what they'd do manually.

**Requirements:**

- Fails on the first broken step, with a message identifying which module/step failed
- Runs unattended, start to finish, no manual intervention

## How to write checks

Both playbooks follow one of two host-targeting patterns depending on your project's infrastructure. Pick the one that matches your `publishing-house/spec.yaml` `environment.platform`, or look at what your scaffolded `qa-automation/` stub already assumes.

### OCP / AgD v2: `hosts: localhost` + `kubernetes.core`

Runs locally in the Showroom pod and talks to the OpenShift API directly via `kubernetes.core.k8s*` modules and `oc`. Set `module_defaults.group/kubernetes.core.k8s.kubeconfig` to `{{ k8s_kubeconfig | default(omit) }}` so those tasks pick up the elevated identity described below when you need one. See the real [`healthcheck.yml`](https://github.com/rhpds/ph-openshift-monorepo-example/blob/main/qa-automation/healthcheck.yml) for the full pattern — cluster reachability via `oc whoami`, then an ArgoCD `Application` sync/health check via `kubernetes.core.k8s_info`.

The `module_defaults`/`k8s_kubeconfig` wiring only matters if your checks need to look outside the Showroom pod's own namespace — see "Provisioning / AgnosticV config" below.

### RHEL VM / ZT Guided: SSH inventory + `become`

Builds a one-host inventory from bastion connection details injected as environment variables (`BASTION_HOST`, `BASTION_PORT`, `BASTION_USER`, `BASTION_PASSWORD`) via `ansible.builtin.add_host`, then targets that host over SSH. See the real [`healthcheck.yml`](https://github.com/rhpds/cy27-rh1-lb2062a-rhhi/blob/main/qa-automation/healthcheck.yml) for the full pattern — a two-play file that builds the inventory, then runs `ansible.builtin.ping` against it.

Set `become: true` on the second play instead when a check needs privileged actions on the bastion (installing packages, restarting services, reading root-owned files) — see "Provisioning / AgnosticV config" below for why there's no separate elevated-identity step here.

**Reusing runtime-automation scripts for e2e** — ZT Guided projects already have per-module `solve`/`validate` (and optionally `setup`) shell scripts in `runtime-automation/<module>/`. Rather than re-implementing those checks in Ansible, `e2e.yml` can replay them remotely in `ui-config.yml` module order and fail on the first broken one. See [`qa-automation/tasks/run_script.yml`](https://github.com/rhpds/cy27-rh1-lb2062a-rhhi/blob/main/qa-automation/tasks/run_script.yml) in the ZT example below for the reusable task pattern — it copies the script to the bastion, sources a `fail_validation` helper the script can call to report *why* it failed, executes it, and captures which module/stage broke.

## Examples

| Pattern | Content repo | healthcheck.yml | e2e.yml |
|---|---|---|---|
| OCP (AgD v2) | [`ph-openshift-monorepo-example`](https://github.com/rhpds/ph-openshift-monorepo-example) | [healthcheck.yml](https://github.com/rhpds/ph-openshift-monorepo-example/blob/main/qa-automation/healthcheck.yml) | [e2e.yml](https://github.com/rhpds/ph-openshift-monorepo-example/blob/main/qa-automation/e2e.yml) |
| ZT Guided (Project Zero / RHEL) | [`cy27-rh1-lb2062a-rhhi`](https://github.com/rhpds/cy27-rh1-lb2062a-rhhi) | [healthcheck.yml](https://github.com/rhpds/cy27-rh1-lb2062a-rhhi/blob/main/qa-automation/healthcheck.yml) | [e2e.yml](https://github.com/rhpds/cy27-rh1-lb2062a-rhhi/blob/main/qa-automation/e2e.yml) |

The OCP example checks ArgoCD Application sync/health and namespaces outside its own, using the cluster-admin identity described below. The ZT example SSHes to the bastion and replays the lab's existing `runtime-automation/` solve/validate scripts module by module — see "How to write checks" above for both patterns.

## Running against a deployed Showroom

Once the environment is provisioned, copy the Showroom URL from the order. Hosts, GUIDs, and clusters vary — the paths do not. Example: `https://showroom-abc12.apps.ocpv00.rhdp.net`

The easiest way to run a playbook is to open it in a browser. Ansible output streams in the tab until the playbook finishes (`✓ Completed successfully!` or `✗ Failed (exit code N)`, then `__DONE__`).

- Health check: `https://showroom-abc12.apps.ocpv00.rhdp.net/stream/qa/healthcheck`
- E2E: `https://showroom-abc12.apps.ocpv00.rhdp.net/stream/qa/e2e`

A 404 means that playbook is not in the **deployed** content tree. Push `qa-automation/` and re-provision or re-sync before retrying.

The same endpoints work from curl if you prefer the command line (`-N` streams `TASK` lines live; `-k` covers cluster TLS):

```bash
SHOWROOM=https://showroom-abc12.apps.ocpv00.rhdp.net

# Fast readiness check (< 60s)
curl -sk -N "$SHOWROOM/stream/qa/healthcheck"

# Full unattended walkthrough
curl -sk -N "$SHOWROOM/stream/qa/e2e"
```

## Provisioning / AgnosticV config

Both `/stream/qa/healthcheck` and `/stream/qa/e2e` are served by a runtime automation runner sidecar in the Showroom pod. What it takes to reach beyond that pod's own default access differs by infrastructure.

### OpenShift: cluster-admin identity

By default, `healthcheck.yml`/`e2e.yml` run with the Showroom pod's own in-cluster identity, which is `edit`-scoped to its own namespace. If your checks need to look outside that namespace — cluster-scoped resources, other namespaces, ArgoCD `Application` status in `openshift-gitops` — enable the runtime-automation cluster-admin identity instead.

**Enable the QA automation endpoints** — devs must set this in the AgnosticV catalog item's `common.yml` for `/stream/qa/healthcheck` and `/stream/qa/e2e` to exist at all:

```yaml
ocp4_workload_showroom_runtime_automation_enable: true
```

**Enable cluster-admin permissions** — this authenticates both the `kubernetes.core.k8s*` Ansible modules and `oc` via shell inside the playbooks:

```yaml
ocp4_workload_showroom_runtime_automation_cluster_admin: true
ocp4_workload_showroom_openshift_api_url: "{{ openshift_api_url }}"
ocp4_workload_showroom_openshift_api_token: "{{ openshift_cluster_admin_token }}"
```

This populates a `runtime-automation-kubeconfig` Secret that the playbook reads into a `k8s_kubeconfig` variable. Wire it into `module_defaults` for `kubernetes.core.k8s*`/`helm` tasks, and into the `KUBECONFIG`/`K8S_AUTH_KUBECONFIG` environment variables for `oc` and any nested `ansible-playbook` calls — see the [OCP example](https://github.com/rhpds/ph-openshift-monorepo-example/blob/main/qa-automation/e2e.yml) above for the exact pattern.

### RHEL / Zero Touch: bastion access

ZT labs work differently — there's no Kubernetes API to grant elevated access to, so none of the OCP flags above apply, and there's nothing to opt into. Every ZT catalog item gets bastion SSH connection details injected automatically as `BASTION_HOST`, `BASTION_PORT`, `BASTION_USER`, and `BASTION_PASSWORD` environment variables, available to `qa-automation/` the same way they're available to `runtime-automation/`.

There's no cluster-admin equivalent for ZT, and no separate identity to enable — checks authenticate as the same bastion user the learner uses. If a check needs privileged local actions (installing packages, restarting services, reading root-owned files), set `become: true` on the play instead, the same way the [ZT e2e example](https://github.com/rhpds/cy27-rh1-lb2062a-rhhi/blob/main/qa-automation/e2e.yml) above does.

## Marking complete

`publishing-house/spec.yaml` tracks these independently: `development.e2e.status` and `development.healthCheck.status`. Set each to `complete` once implemented and tested — both must be `complete` to pass compliance checks.

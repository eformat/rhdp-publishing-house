# Plan: Back up `publishing-house` app (OADP/Velero)

**Jira:** [GPTEINFRA-17834](https://redhat.atlassian.net/browse/GPTEINFRA-17834) — status: **In Progress**, assignee: Andrew Jones, sprint: Sprint 141
**Cluster:** `https://api.ocpv-infra02.wdc07.infra.demo.redhat.com:6443`
**Namespace:** `publishing-house`
**Goal:** Back up the `publishing-house` app (RHDH-based) so it can be restored or moved to another cluster.

> This file has the full config/detail discovered during investigation that didn't fit in the Jira ticket. Take this with you — it has the actual manifests to apply, not just the high-level plan.

---

## Status as of last session

- [x] Jira ticket created, moved to In Progress
- [x] Investigated namespace contents, confirmed OADP operator installed but not configured
- [ ] `oc login` to ocpv-infra02 (in progress — was about to do this when workspace changed)
- [ ] Create ObjectBucketClaim (backup bucket)
- [ ] Create `cloud-credentials` secret
- [ ] Create `DataProtectionApplication`
- [ ] Run first `Backup`
- [ ] Validate `Restore`
- [ ] Document restore/move procedure

---

## 1. Namespace inventory (`publishing-house`)

| Resource | Kind | Notes |
|---|---|---|
| `developer-hub` | `Backstage` CR (rhdh-operator v1.10.3) | Red Hat Developer Hub. **Currently `DeployFailed`** — dynamic-plugins ConfigMap YAML parse error (`ph-developer-hub-dynamic-plugins`, line 70: mapping values not allowed). Separate bug, not blocking backup, but backup will capture this broken state as-is. |
| `backstage-developer-hub` | Deployment + Service | RHDH backend pod |
| `backstage-psql-developer-hub-0` | StatefulSet + PVC (`data-backstage-psql-developer-hub-0`, 1Gi) | Backstage's own Postgres |
| `central-api` | Deployment + PVC (`central-api-data`, 1Gi) | `quay.io/rhpds/central-api:1.21.21` |
| `publishinghouseworkflow` | `SonataFlow` CR (Serverless Logic operator, logic-operator.v1.38.1) | `quay.io/rhpds/publishing-house-workflow:1.6` — the actual workflow logic |
| `sonataflow-platform-data-index-service`, `sonataflow-platform-jobs-service`, `sonataflow-management-console` | Deployments | SonataFlow platform services |
| `sonataflow-postgresql-0` | StatefulSet + PVC (`data-sonataflow-postgresql-0`, 5Gi) | SonataFlow's own Postgres |
| `developer-hub-dynamic-plugins-root` | PVC (5Gi) | RHDH dynamic plugins cache |
| Various CronJobs | `drift-checker`, `inactivity-checker`, `workflow-cleanup` | Housekeeping jobs, low priority for backup |

**PVCs (4 total, all `ocs-storagecluster-ceph-rbd`, RWO, CSI-backed):**
- `central-api-data` (1Gi)
- `data-backstage-psql-developer-hub-0` (1Gi)
- `data-sonataflow-postgresql-0` (5Gi)
- `developer-hub-dynamic-plugins-root` (5Gi)

**Secrets that matter (must be included in backup):**
- `ph-developer-hub-env`
- `publishing-house-credentials` (has `api-key` used by Backstage backend as `PH_API_KEY`)
- `backstage-psql-secret-developer-hub`
- `sonataflow-console-oauth-proxy`
- `sonataflow-postgresql-svcbind`
- `rhdh-k8s-integration` (service account token — Backstage's kubernetes plugin)

**ConfigMaps worth noting:** `ph-developer-hub-app-config`, `ph-developer-hub-dynamic-plugins`, `ph-rbac-policy`, `ph-validation-policy`, plus per-service `*-props`/`*-config` maps.

**Routes:**
- `central-publishing-house` → `backstage-developer-hub` (the RHDH UI — this is the URL the user gave: `https://central-publishing-house-publishing-house.apps.ocpv-infra02.wdc07.infra.demo.redhat.com/`)
- `central-api` → `central-api`
- `sonataflow-management-console` → `sonataflow-management-console`

**Key facts:**
- **Not GitOps-managed** — no ArgoCD `Application` found for this namespace. Restore must replay real manifests + real data, not a git re-sync.
- `Backstage` and `SonataFlow` are CRs owned by operators (`rhdh-operator`, `logic-operator` / OpenShift Serverless Logic). **The target/restore cluster needs these operators (OLM subscriptions) installed first** — OADP won't install operators, only the CRs and native resources.

---

## 2. Cluster backup tooling already available

- **OADP operator**: `oadp-operator.v1.4.11`, installed in `openshift-adp` namespace — **installed but not configured** (no `DataProtectionApplication`, no `BackupStorageLocation`, no existing `Backup`/`Schedule`).
- **ODF / Noobaa** (S3-compatible object storage) is available as the backup target:
  - Noobaa S3 endpoint: `https://10.190.52.97:31834` (from `oc get noobaa noobaa -n openshift-storage`)
  - OBC storage class to request a bucket: `openshift-storage.noobaa.io`
- **CSI VolumeSnapshotClasses** exist (`ocs-storagecluster-rbdplugin-snapclass`, `-cephfsplugin-snapclass`, `-nfsplugin-snapclass`) but these are Ceph/ODF-specific — **not portable to a different cluster**. Use Velero's file-system backup (Kopia) instead for portability, since the goal is "restore or move."
- No `velero` CLI installed locally — use `oc apply` with Backup/Restore CRs, or install the CLI if you want live `velero backup logs` streaming.

---

## 3. Exact steps / manifests to apply

### Step 1 — Create the backup bucket (ObjectBucketClaim)

```yaml
apiVersion: objectbucket.io/v1alpha1
kind: ObjectBucketClaim
metadata:
  name: velero-backup-bucket
  namespace: openshift-adp
spec:
  generateBucketName: velero-backup
  storageClassName: openshift-storage.noobaa.io
```

After creating, get the generated credentials:

```bash
oc get secret velero-backup-bucket -n openshift-adp -o yaml
oc get cm velero-backup-bucket -n openshift-adp -o yaml
```

### Step 2 — Create the Velero credentials secret (AWS format)

```bash
cat <<EOF > credentials-velero
[default]
aws_access_key_id=<ACCESS_KEY_ID from OBC secret>
aws_secret_access_key=<SECRET_ACCESS_KEY from OBC secret>
EOF

oc create secret generic cloud-credentials -n openshift-adp --from-file=cloud=credentials-velero
```

### Step 3 — `DataProtectionApplication`

```yaml
apiVersion: oadp.openshift.io/v1alpha1
kind: DataProtectionApplication
metadata:
  name: dpa-publishing-house
  namespace: openshift-adp
spec:
  configuration:
    velero:
      defaultPlugins:
        - openshift
        - csi
        - aws
    nodeAgent:
      enable: true
      uploaderType: kopia   # file-level backup, portable across clusters/storage classes
  backupLocations:
    - velero:
        provider: aws
        default: true
        objectStorage:
          bucket: <bucket-name from OBC's ConfigMap>
          prefix: velero
        config:
          region: us-east-1
          s3Url: https://10.190.52.97:31834
          s3ForcePathStyle: "true"
          insecureSkipTLSVerify: "true"
        credential:
          name: cloud-credentials
          key: cloud
```

Check it comes up healthy:

```bash
oc get dpa -n openshift-adp
oc get backupstoragelocation -n openshift-adp -o wide   # PHASE should become "Available"
```

### Step 4 — First backup

```yaml
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: publishing-house-backup
  namespace: openshift-adp
spec:
  includedNamespaces:
    - publishing-house
  defaultVolumesToFsBackup: true
```

```bash
oc apply -f backup.yaml
oc get backup publishing-house-backup -n openshift-adp -w
oc describe backup publishing-house-backup -n openshift-adp   # check for partial failures/warnings
```

### Step 5 — Restore (same cluster, different namespace, or a different cluster)

Prereqs on the target cluster: OADP installed + a `DataProtectionApplication` pointed at the *same* bucket/credentials (read access is enough), and the `rhdh-operator` + Serverless Logic (`logic-operator`) OLM subscriptions installed.

```yaml
apiVersion: velero.io/v1
kind: Restore
metadata:
  name: publishing-house-restore
  namespace: openshift-adp
spec:
  backupName: publishing-house-backup
```

```bash
oc apply -f restore.yaml
oc get restore publishing-house-restore -n openshift-adp -w
```

### Optional — Schedule for ongoing backups

Same spec as the `Backup` above, wrapped in a `Schedule`:

```yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: publishing-house-nightly
  namespace: openshift-adp
spec:
  schedule: "0 2 * * *"
  template:
    includedNamespaces:
      - publishing-house
    defaultVolumesToFsBackup: true
```

---

## 4. Quick fallback (if OADP setup is blocked and you just need *something* fast)

No extra setup, but manifests-only (no PVC data) and needs cleanup before reapplying:

```bash
NS=publishing-house
mkdir -p ph-backup
for res in deployment statefulset service route configmap secret pvc backstage sonataflow sonataflowplatform serviceaccount rolebinding role cronjob; do
  oc get $res -n $NS -o yaml > ph-backup/$res.yaml 2>/dev/null
done
```

- Strip `resourceVersion`/`uid`/`status`/owner references before reapplying (e.g. `oc krew install neat` then `oc neat`).
- PVC data (both Postgres DBs + the dynamic-plugins cache) needs separate handling — `oc rsync`/`tar` via a helper pod, or `pg_dump` for the two databases.

---

## 5. Loose ends / things to flag separately

- `Backstage` CR `developer-hub` is currently `DeployFailed` due to a YAML error in the `ph-developer-hub-dynamic-plugins` ConfigMap (line 70, "mapping values are not allowed in this context"). Doesn't block backup, but worth its own fix.
- No `velero` CLI locally — consider installing it (`brew install velero` / binary from GitHub releases) for easier `velero backup describe --details` / `velero backup logs` debugging instead of `oc describe`/`oc logs` on the Velero pod.

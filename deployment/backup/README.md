# `publishing-house` namespace backup (OADP/Velero)

Jira: [GPTEINFRA-17834](https://redhat.atlassian.net/browse/GPTEINFRA-17834)

Backs up the `publishing-house` app (RHDH-based, not GitOps-managed) on
`ocpv-infra02` using the OADP operator (Velero + Kopia), so it can be
restored or moved to another cluster.

## What's here

| File | Purpose |
|---|---|
| `object-bucket-claim.yaml` | Requests a Noobaa (ODF S3-compatible) bucket for backup storage |
| `data-protection-application.yaml` | Configures Velero (`nodeAgent` + Kopia uploader) and the `BackupStorageLocation` |
| `backup.yaml` | One-off `Backup` of the `publishing-house` namespace (manifests + PVC data via Kopia) |
| `schedule.yaml` | Nightly `Schedule` (cron `0 2 * * *`) wrapping the same backup spec, 30-day TTL |
| `restore-test.yaml` | **Example only** — same-cluster restore into `publishing-house-restore-test` via `namespaceMapping`, for testing without touching the live app |

Not included here (must be created separately, and **never committed**):
`cloud-credentials` secret (AWS-format credentials for the bucket, created
from the `ObjectBucketClaim`'s generated secret — see "Setup" below).

## Setup (already done on `ocpv-infra02`)

```bash
oc apply -f object-bucket-claim.yaml

# Get generated bucket credentials, build the AWS-format credentials file
oc get secret velero-backup-bucket -n openshift-adp -o jsonpath='{.data.AWS_ACCESS_KEY_ID}' | base64 -d
oc get secret velero-backup-bucket -n openshift-adp -o jsonpath='{.data.AWS_SECRET_ACCESS_KEY}' | base64 -d
oc get cm velero-backup-bucket -n openshift-adp -o jsonpath='{.data.BUCKET_NAME}'

cat <<'EOF' > /tmp/credentials-velero
[default]
aws_access_key_id=<ACCESS_KEY_ID>
aws_secret_access_key=<SECRET_ACCESS_KEY>
EOF
oc create secret generic cloud-credentials -n openshift-adp --from-file=cloud=/tmp/credentials-velero
rm /tmp/credentials-velero

# Update the `bucket:` field in data-protection-application.yaml with the
# generated BUCKET_NAME, then:
oc apply -f data-protection-application.yaml
oc get backupstoragelocation -n openshift-adp -o wide   # wait for PHASE: Available

oc apply -f backup.yaml
oc apply -f schedule.yaml
```

## Restore / move procedure

### Prerequisites on the target cluster

1. **OADP operator installed** (`openshift-adp` namespace).
2. **Same operators installed as source cluster** — the `Backstage` and
   `SonataFlow` CRs are owned by `rhdh-operator` and the OpenShift
   Serverless Logic operator (`logic-operator`) respectively. OADP restores
   the CRs themselves but does **not** install operators — install these
   via OLM subscriptions *before* restoring, or the CRs will sit unreconciled.
3. **`DataProtectionApplication` pointed at the same bucket/credentials**
   as the source (read access is sufficient). If restoring to a different
   cluster, create a fresh `ObjectBucketClaim`-independent `cloud-credentials`
   secret using the *same* Noobaa bucket's access/secret keys (or a
   read-only Noobaa account scoped to that bucket), and a `DataProtectionApplication`
   with the same `backupLocations.velero.objectStorage.bucket` name.
   Velero will discover the existing `Backup` objects in the bucket once
   the `BackupStorageLocation` syncs (may take a minute).

### Restore

```bash
oc apply -f restore.yaml   # backupName: publishing-house-backup
oc get restore publishing-house-restore -n openshift-adp -w
oc describe restore publishing-house-restore -n openshift-adp
```

Where `restore.yaml` is:

```yaml
apiVersion: velero.io/v1
kind: Restore
metadata:
  name: publishing-house-restore
  namespace: openshift-adp
spec:
  backupName: publishing-house-backup
```

This restores into the `publishing-house` namespace as-is (suitable for a
different/throwaway cluster). For testing on the **same** cluster without
touching the live app, use `restore-test.yaml` instead, which remaps into
`publishing-house-restore-test` via `namespaceMapping`.

### Post-restore checks

- `oc get backstage,sonataflow -n publishing-house` — confirm CRs
  reconcile (requires operators from prerequisites above).
- `oc get pods -n publishing-house` — confirm all pods come up; check logs
  for connection errors if secrets/configmaps reference cluster-specific
  values (e.g. routes, the `rhdh-k8s-integration` service account token).
- `oc get datadownload -n openshift-adp` — confirm Kopia restores of all 4
  PVCs (`central-api-data`, `data-backstage-psql-developer-hub-0`,
  `data-sonataflow-postgresql-0`, `developer-hub-dynamic-plugins-root`)
  completed.
- `oc get route -n publishing-house` — routes will have new/regenerated
  hostnames if restoring under a different namespace name or cluster;
  update any external references (bookmarks, other apps' config)
  accordingly.

## Known issues (unrelated to backup)

- `Backstage` CR `developer-hub` on the source cluster is currently
  `DeployFailed` due to a YAML parse error in the `ph-developer-hub-dynamic-plugins`
  ConfigMap (line 70, "mapping values are not allowed in this context").
  The backup captures this broken state as-is — fixing it is tracked
  separately.

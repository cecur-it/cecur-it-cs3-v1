# Log retention and archival SOP

This SOP defines CS3 retention across OpenSearch, PostgreSQL audit logs, and offline archives. Apply it alongside `deployment/operations/backup-restore.md`.

## Retention policy

| Tier | Duration | Storage | Purpose |
|---|---:|---|---|
| Hot | 30 days | OpenSearch hot nodes | active investigations, dashboards, detection |
| Warm | 90 days | OpenSearch warm nodes | recent investigations, lower-cost search |
| Cold | 1 year+ | searchable cold tier or restored snapshots | compliance and lookbacks |
| Archive | 7 years | immutable object store / WORM | legal/regulatory retention |

Profile overrides:

| Profile | Hot | Warm | Cold | Archive |
|---|---:|---:|---:|---:|
| cloud | 14 d | 60 d | 365 d | 7 y |
| onprem | 30 d | 90 d | 365 d | 7 y |
| airgap | 30 d | 180 d | 730 d | 7 y |

## ISM policy file

The production JSON policy lives at `deployment/operations/ism/cs3-logs-lifecycle.json`. Apply it with:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_plugins/_ism/policies/cs3-logs-lifecycle       --data-binary @deployment/operations/ism/cs3-logs-lifecycle.json
```

Bind the policy to new indices with a matching template:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_index_template/cs3-logs-template       -d '{
    "index_patterns":["cs3-*","wazuh-alerts-*"],
    "template":{
      "settings":{
        "plugins.index_state_management.policy_id":"cs3-logs-lifecycle"
      }
    },
    "priority":100
  }'
```

Verify attachment:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS"       https://indexer-mgr-1.example.internal:9200/_plugins/_ism/explain/cs3-logs-2026.10.19?pretty
```

## Snapshot repository for cold/archive handoff

The ISM policy expects a snapshot repository named `cs3-cold`:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_snapshot/cs3-cold       -d '{"type":"s3","settings":{"bucket":"cs3-archive","base_path":"opensearch","region":"us-gov-west-1","server_side_encryption":true}}'
```

Use immutable storage controls on the bucket (Object Lock governance or compliance mode) for the 7-year archive window.

## PostgreSQL `audit_logs` archival

`cs3.audit_logs` is append-only by design. Retention is handled by export plus immutable storage, not by routine deletes.

Export with the read-only archiver role:

```bash
export ARCHIVER_DSN='postgresql://cs3_archiver@postgres:5432/cs3'   # password via PGPASSWORD / ~/.pgpass, never inline
export STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
export OUT="/srv/cs3/archive/audit_logs-${STAMP}.jsonl"

psql "$ARCHIVER_DSN" <<SQL
\copy (
  SELECT row_to_json(t)
  FROM (
    SELECT chain_no, id, data, prev_hash, chain_hash, created_at
    FROM cs3.audit_logs
    WHERE created_at < now() - interval '365 days'
    ORDER BY chain_no
  ) AS t
) TO '${OUT}'
SQL

sha256sum "$OUT" | tee "${OUT}.sha256"
```

Push the export to immutable storage:

```bash
aws s3 cp "$OUT" s3://cs3-archive/postgres/       --storage-class DEEP_ARCHIVE       --object-lock-mode COMPLIANCE       --object-lock-retain-until-date 2033-10-19T00:00:00Z

aws s3 cp "${OUT}.sha256" s3://cs3-archive/postgres/
```

Record the export manifest, checksum, and `max(chain_no)` in the change record.

## Break-glass deletion procedure

Routine deletion is forbidden. If legal counsel orders a purge, require dual control, fresh backups, and a signed change ticket. The minimum controlled sequence is:

```sql
BEGIN;
ALTER TABLE cs3.audit_logs DISABLE TRIGGER USER;
ALTER TABLE cs3.audit_logs NO FORCE ROW LEVEL SECURITY;
DELETE FROM cs3.audit_logs WHERE created_at < TIMESTAMPTZ '2020-01-01 00:00:00+00';
ALTER TABLE cs3.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE cs3.audit_logs ENABLE TRIGGER USER;
COMMIT;
```

Mandatory follow-up after any break-glass purge:

- keep the pre-purge export and checksum in immutable storage
- document the retained starting `prev_hash` / first surviving `chain_no`
- run `SELECT cs3.verify_audit_chain();` and attach the result to the exception record

## Legal hold

When a hold is issued:

1. suspend ISM deletes for matching indices by removing the delete transition or moving the indices to a dedicated hold policy
2. stop archive expiry jobs for the related PostgreSQL exports and snapshot prefixes
3. tag the S3/object-store prefix and ticket with the hold identifier
4. keep the hold scope narrow; do not freeze unrelated indices

## Operational review

Review retention quarterly:

- compare actual storage burn against the hot/warm/cold plan
- confirm OpenSearch snapshot restore still works
- confirm archived audit exports remain readable and checksums still match

# Backup and restore SOP

This runbook covers the CS3 Docker/Helm data plane: PostgreSQL (`cs3_pgdata` + `cs3_wal-archive`), OpenSearch/Wazuh Indexer snapshots, and Ollama model stores (`cs3_ollama-*`). Run every command from the repository root unless stated otherwise.

## Recovery targets

| Component | Backup method | Minimum cadence | Restore validation |
|---|---|---:|---|
| PostgreSQL 16 | `pg_basebackup` + continuous WAL archive already enabled in `deployment/docker/docker-compose.yml` | nightly base backup + continuous WAL | `SELECT cs3.verify_audit_chain();` |
| OpenSearch / Wazuh Indexer | repository snapshots (`fs` or `s3`) | hourly or 4-hourly | `_cluster/health`, sample index restore |
| Ollama | volume tarball per node | before every model change + nightly | `ollama list`, sample inference |

## PostgreSQL: base backup + WAL archive

The compose stack already starts PostgreSQL with:

```bash
docker compose exec -T postgres psql -U postgres -d cs3 -c "show archive_mode; show archive_command;"
docker compose exec -T postgres psql -U postgres -d cs3 -c "select archived_count, failed_count, last_archived_wal, last_failed_wal from pg_stat_archiver;"
```

Expected values:

- `archive_mode = on`
- `archive_command = test ! -f /wal-archive/%f && cp %p /wal-archive/%f`
- `failed_count = 0`

Take a nightly plain-format base backup over the PostgreSQL container's local socket:

```bash
export STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -d -m 0700 "/srv/cs3/backups/postgres/base/${STAMP}"
docker compose exec -T postgres pg_basebackup -h /var/run/postgresql -U postgres -D "/tmp/cs3-base-${STAMP}" -Fp -X none -P
sudo docker cp "$(docker compose ps -q postgres):/tmp/cs3-base-${STAMP}/." "/srv/cs3/backups/postgres/base/${STAMP}/"
docker compose exec -T postgres rm -rf -- "/tmp/cs3-base-${STAMP}"

docker run --rm -v "/srv/cs3/backups/postgres/base/${STAMP}:/backup:ro" postgres:16-alpine       pg_verifybackup /backup

WAL_MOUNT="$(docker volume inspect cs3_wal-archive --format '{{ .Mountpoint }}')"
sudo rsync -a --delete "${WAL_MOUNT}/" "/srv/cs3/backups/postgres/wal/"
```

Retain enough WAL to cover the oldest retained base backup. Do not prune `/srv/cs3/backups/postgres/wal/` until the newest base backup verifies cleanly.

### pgBackRest option for HA deployments

If you run Patroni / CloudNativePG rather than the single-node compose service, prefer pgBackRest:

```ini
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=7
repo1-retention-diff=14
start-fast=y

[cs3]
pg1-path=/var/lib/postgresql/data
```

```bash
pgbackrest --stanza=cs3 stanza-create
pgbackrest --stanza=cs3 check
pgbackrest --stanza=cs3 --type=full backup
pgbackrest --stanza=cs3 info
```

## PostgreSQL PITR restore

Restore to a new maintenance window target, then promote:

```bash
export RESTORE_BASE=/srv/cs3/backups/postgres/base/20261019T020000Z
export TARGET_TIME='2026-10-19 03:15:00+00'

docker compose stop console postgres
docker run --rm -v cs3_pgdata:/pgdata busybox sh -c 'rm -rf /pgdata/*'
docker run --rm       -v cs3_pgdata:/pgdata       -v "$RESTORE_BASE:/backup:ro"       busybox sh -c 'cp -a /backup/. /pgdata/ && chown -R 70:70 /pgdata'

docker run --rm -v cs3_pgdata:/pgdata busybox sh -c "
  touch /pgdata/recovery.signal &&       printf "%s\n"         "restore_command = 'cp /wal-archive/%f %p'"         "recovery_target_time = '$TARGET_TIME'"         "recovery_target_action = 'promote'"         "recovery_target_timeline = 'latest'" >> /pgdata/postgresql.auto.conf &&       chown 70:70 /pgdata/recovery.signal /pgdata/postgresql.auto.conf"

docker compose up -d postgres
docker compose logs -f postgres
```

When logs show `database system is ready to accept connections`, verify the recovery point and then start the console:

```bash
docker compose exec -T postgres psql -U postgres -d cs3 -c "select pg_is_in_recovery();"
docker compose exec -T postgres psql -U postgres -d cs3 -c "select cs3.verify_audit_chain();"
docker compose exec -T postgres psql -U postgres -d cs3 -c "select max(created_at) from cs3.audit_logs;"
docker compose up -d console
curl -fsS http://localhost:3000/api/health | python3 -m json.tool
```

`cs3.verify_audit_chain()` must return `NULL`. Any non-null `chain_no` means the restored ledger is not trustworthy.

## OpenSearch / Wazuh Indexer snapshots

For an FS repository, add `path.repo` on every node and restart the indexer process:

```yaml
path.repo:
  - /var/backups/opensearch
```

Register an FS repository:

```bash
export OS_URL='https://indexer-1.example.internal:9200'
export OS_USER='admin'
export OS_PASS='replace-with-real-secret'
export OS_CA='/etc/opensearch/root-ca.pem'

curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT "$OS_URL/_snapshot/cs3_fs_repo"       -d '{"type":"fs","settings":{"location":"/var/backups/opensearch/cs3","compress":true}}'
```

Register an S3 repository after loading S3 credentials into the OpenSearch keystore:

```bash
/usr/share/opensearch/bin/opensearch-keystore add s3.client.default.access_key
/usr/share/opensearch/bin/opensearch-keystore add s3.client.default.secret_key

curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT "$OS_URL/_snapshot/cs3_s3_repo"       -d '{"type":"s3","settings":{"bucket":"cs3-opensearch-backups","base_path":"prod/indexer","region":"us-gov-west-1","server_side_encryption":true}}'
```

Take and verify a snapshot:

```bash
SNAP="cs3-$(date -u +%Y%m%dT%H%M%SZ)"
curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT "$OS_URL/_snapshot/cs3_s3_repo/${SNAP}?wait_for_completion=true"       -d '{"indices":"wazuh-alerts-*,cs3-*","ignore_unavailable":true,"include_global_state":false}'

curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" "$OS_URL/_snapshot/cs3_s3_repo/_all?pretty"
```

Schedule snapshots with a cron-driven API call if you do not run Snapshot Management:

```cron
5 */4 * * * root SNAP=cs3-$(date -u +\%Y\%m\%dT\%H\%M\%SZ) &&       curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT "https://indexer-1.example.internal:9200/_snapshot/cs3_s3_repo/${SNAP}?wait_for_completion=true"       -d '{"indices":"wazuh-alerts-*,cs3-*","ignore_unavailable":true,"include_global_state":false}'
```

Restore one day of alerts into a side-by-side namespace first:

```bash
curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPOST "$OS_URL/_snapshot/cs3_s3_repo/${SNAP}/_restore?wait_for_completion=true"       -d '{"indices":"wazuh-alerts-2026.10.18","rename_pattern":"(.+)","rename_replacement":"restore-$1","include_global_state":false}'

curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" "$OS_URL/_cluster/health?pretty"
curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" "$OS_URL/_cat/indices/restore-*?v"
```

## Ollama model volume backup

Drain one node at a time from the load balancer, verify no active jobs with `ollama ps`, then snapshot the volume:

```bash
export STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -d -m 0750 /srv/cs3/backups/ollama

docker run --rm -v cs3_ollama-1:/src:ro -v /srv/cs3/backups/ollama:/backup       busybox tar -C /src -cf "/backup/ollama-1-${STAMP}.tar" .
docker run --rm -v cs3_ollama-2:/src:ro -v /srv/cs3/backups/ollama:/backup       busybox tar -C /src -cf "/backup/ollama-2-${STAMP}.tar" .
sha256sum /srv/cs3/backups/ollama/ollama-*-${STAMP}.tar | tee /srv/cs3/backups/ollama/SHA256SUMS-${STAMP}
```

Restore a node volume:

```bash
docker compose stop ollama-1
docker run --rm -v cs3_ollama-1:/dst busybox sh -c 'rm -rf /dst/*'
docker run --rm -v cs3_ollama-1:/dst -v /srv/cs3/backups/ollama:/backup:ro       busybox sh -c 'cd /dst && tar -xf /backup/ollama-1-20261019T020000Z.tar'
docker compose up -d ollama-1
curl -fsS http://localhost:11434/healthz
```

## Post-restore validation

Run these checks after every recovery event:

```bash
docker compose exec -T postgres psql -U postgres -d cs3 -c "select cs3.verify_audit_chain();"
curl -fsS http://localhost:3000/api/health | python3 -m json.tool
curl -fsS http://localhost:11434/api/tags | python3 -m json.tool
curl --cacert "$OS_CA" -u "$OS_USER:$OS_PASS" "$OS_URL/_cluster/health?pretty"
```

## RPO / RTO targets

| Component | Target RPO | Target RTO | Notes |
|---|---:|---:|---|
| PostgreSQL | ≤ 5 minutes | 60 minutes | WAL is continuous; base backup is nightly. |
| OpenSearch / Wazuh Indexer | 4 hours | 90 minutes | Shorten to 1 hour for high-volume MDR sites. |
| Ollama models | 24 hours or before every model change | 30 minutes per node | Keep previous tarball until acceptance passes. |
| CS3 console config | 15 minutes | 30 minutes | Store `.env`, Helm values, and ingress secrets in GitOps or secret manager. |

## Restore drills

- Run a PostgreSQL PITR drill monthly and prove `cs3.verify_audit_chain()` still returns `NULL`.
- Restore one OpenSearch snapshot into `restore-*` indices weekly and compare document counts before deletion.
- Restore one Ollama node from the previous night's tarball monthly; verify `ollama list` and one inference request before returning traffic.
- Record actual RTO/RPO achieved, any missing secrets, and any manual edits required. Update this SOP when a drill reveals a gap.

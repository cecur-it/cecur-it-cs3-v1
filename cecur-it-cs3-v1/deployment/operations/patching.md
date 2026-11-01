# Patching SOP

Patch in layers: OS, container images, PostgreSQL, OpenSearch, Ollama, then forwarders. Keep one approved rollback path per layer before touching production.

## Maintenance window checklist

- approved change record with scope, owner, start/end time, and rollback trigger
- verified backups: PostgreSQL base backup + WAL, OpenSearch snapshot, Ollama volume tarballs
- active alert silence only for the systems under maintenance
- operator on standby for DB/indexer/application validation

## Change record minimum

Record at least:

- ticket / CAB id
- versions before and after
- exact commands run
- backup artifact identifiers
- validation results
- rollback point and owner

## OS patching

Ubuntu / Debian:

```bash
sudo apt-get update
sudo apt-get -y dist-upgrade
sudo reboot
```

RHEL / Rocky / Alma:

```bash
sudo dnf -y upgrade --refresh
sudo reboot
```

Patch one node at a time for PostgreSQL replicas, OpenSearch data nodes, and Ollama GPU nodes.

## Container patching

Pull first, then restart one service at a time:

```bash
docker compose pull
docker compose up -d postgres
docker compose up -d console
docker compose up -d ollama-1 ollama-2 ollama-lb
```

After each restart, validate with `curl -fsS http://localhost:3000/api/health` and the service-specific health checks.

## PostgreSQL minor patch

Minor updates stay in the same major version and should preserve on-disk format.

1. Confirm backups.
2. If using replicas, patch a replica first and let it catch up.
3. Fail over if your HA stack requires it.
4. Patch the former primary.

Single-node compose example:

```bash
docker compose pull postgres
docker compose up -d postgres
docker compose exec -T postgres psql -U postgres -d cs3 -c "select version();"
docker compose exec -T postgres psql -U postgres -d cs3 -c "select cs3.verify_audit_chain();"
```

## PostgreSQL major patch

Major upgrades need a rehearsed cutover. Preferred patterns:

- replica migration to a new major version using logical replication or dump/restore
- `pg_upgrade --check` on a cloned data volume before the live window

Minimum safe sequence:

1. take a fresh base backup and WAL snapshot
2. build a test clone and run `pg_upgrade --check`
3. stop writers during the cutover
4. run the chosen upgrade method
5. run `ANALYZE`, then validate CS3 health and audit-chain integrity

Roll back by restoring the pre-upgrade data volume; do not improvise an in-place downgrade.

## OpenSearch rolling patch / restart

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_cluster/settings       -d '{"transient":{"cluster.routing.allocation.enable":"primaries"}}'
```

Patch order:

1. warm data nodes
2. hot data nodes
3. coordinating/ingest nodes if any
4. cluster-manager nodes last

Re-enable allocation after the last node:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" -H 'Content-Type: application/json'       -XPUT https://indexer-mgr-1.example.internal:9200/_cluster/settings       -d '{"transient":{"cluster.routing.allocation.enable":"all"}}'
```

## Ollama patching

Patch one node at a time:

1. drain the node from NGINX/HAProxy
2. snapshot the model volume
3. upgrade the image or binary
4. warm the approved models
5. run a sample prompt
6. return the node to service

Compose example:

```bash
docker compose stop ollama-2
docker compose pull ollama-2
docker compose up -d ollama-2
docker compose exec -T ollama-2 ollama list
```

## Forwarder patching

Use canaries and batch updates. Patch 5%, validate ingest, then 25%, then the remainder. If forwarders write through `/api/cecur/logs/ingest`, watch for `401`, `429`, and `503` rates before advancing.

## Validation after every patch wave

```bash
curl -fsS http://localhost:3000/api/health | python3 -m json.tool
docker compose exec -T postgres psql -U postgres -d cs3 -c "select cs3.verify_audit_chain();"
curl -fsS http://localhost:11434/api/tags | python3 -m json.tool
```

## Rollback rules

Roll back immediately if any of these occur and cannot be corrected inside the maintenance window:

- console health endpoint remains down longer than 5 minutes
- `cs3.verify_audit_chain()` returns non-null after a database change
- OpenSearch cluster turns red and does not recover after one node cycle
- Ollama nodes lose the approved primary or fallback model tags
- more than 5% of agents stop heartbeating after a forwarder rollout

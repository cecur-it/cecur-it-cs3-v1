# Monitoring and alerting SOP

Scrape the CS3 stack with Prometheus and alert on user-visible health first: console API availability, PostgreSQL replication/archive health, OpenSearch cluster health, Ollama latency, fleet drift, and disk exhaustion.

## Scrape points

| Target | Method | Why |
|---|---|---|
| `/api/health` | blackbox probe or ingress probe | end-user API health |
| `/api/fleet/summary` | textfile collector or JSON exporter | fleet size / non-active drift |
| PostgreSQL | `postgres_exporter` | replication lag, archiver failures, connections |
| OpenSearch | `elasticsearch_exporter` or OpenSearch-compatible exporter | health, shard allocation, disk |
| Ollama LB | blackbox probe + HAProxy exporter if used | latency, queue depth |
| Nodes | `node_exporter` | disk, memory, CPU |

## Fleet summary collector

The repo exposes `GET /api/fleet/summary` but not a native Prometheus endpoint. Convert it into textfile metrics for `node_exporter`:

```bash
curl -fsS -H "Authorization: Bearer $CS3_TOKEN" https://soc.example.internal/api/fleet/summary       | python3 - <<'PY' > /var/lib/node_exporter/textfile_collector/cs3-fleet.prom
import json, sys
data = json.load(sys.stdin)
by_status = data.get('byStatus', {})
print(f"cs3_fleet_total {data.get('total', 0)}")
print(f"cs3_fleet_pending_enrollments {data.get('pendingEnrollments', 0)}")
print(f"cs3_fleet_active {by_status.get('active', 0)}")
print(f"cs3_fleet_offline {by_status.get('offline', 0)}")
PY
```

Run that collector every minute under systemd timer or cron.

## Prometheus rules

```yaml
groups:
  - name: cs3-console
    rules:
      - record: cs3:console_availability_error_ratio:5m
        expr: 1 - avg_over_time(probe_success{job="cs3-console-health"}[5m])
      - alert: CS3ConsoleHealthFailed
        expr: probe_success{job="cs3-console-health"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: CS3 console /api/health probe is failing
          description: The user-visible console health endpoint has failed for more than 2 minutes.
      - alert: CS3ConsoleErrorBudgetBurnFast
        expr: cs3:console_availability_error_ratio:5m > 0.0144
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: CS3 console is burning the 99.9% availability budget too quickly
          description: Error ratio over the last 5 minutes exceeds the fast-burn threshold.
  - name: cs3-postgres
    rules:
      - alert: CS3PostgresReplicationLag
        expr: pg_replication_lag > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: PostgreSQL replication lag above 30 seconds
          description: A replica is too far behind to meet CS3 RPO targets.
      - alert: CS3PostgresWalArchiveFailures
        expr: increase(pg_stat_archiver_failed_count[15m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: PostgreSQL WAL archiving is failing
          description: pg_stat_archiver failed_count increased in the last 15 minutes.
      - alert: CS3PostgresConnectionsHigh
        expr: sum(pg_stat_database_numbackends{datname="cs3"}) / max(pg_settings_max_connections) > 0.80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: PostgreSQL connections above 80%
          description: Reduce CS3_PG_POOL_MAX per replica or raise database capacity.
  - name: cs3-opensearch
    rules:
      - alert: CS3OpenSearchClusterRed
        expr: elasticsearch_cluster_health_status{color="red"} == 1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: OpenSearch cluster health is red
          description: At least one primary shard is unavailable.
      - alert: CS3OpenSearchUnassignedShards
        expr: elasticsearch_cluster_health_unassigned_shards > 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: OpenSearch has unassigned shards
          description: Investigate allocation filters, watermarks, and node failures.
  - name: cs3-ollama
    rules:
      - alert: CS3OllamaLatencyHigh
        expr: avg_over_time(probe_duration_seconds{job="ollama-lb-health"}[5m]) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Ollama load balancer latency is high
          description: /api/tags or /healthz probes are taking more than 5 seconds on average.
      - alert: CS3OllamaQueueGrowing
        expr: haproxy_backend_current_queue{backend="ollama_pool"} > 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Ollama requests are queueing
          description: Add nodes, reduce OLLAMA_NUM_PARALLEL, or drain unhealthy nodes.
  - name: cs3-fleet-and-node
    rules:
      - alert: CS3FleetOfflineRatioHigh
        expr: cs3_fleet_offline / clamp_min(cs3_fleet_total, 1) > 0.05
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: More than 5% of the fleet is offline
          description: Investigate agent heartbeat drift and network reachability.
      - alert: CS3DiskFreeLow
        expr: node_filesystem_avail_bytes{fstype!="tmpfs",mountpoint!="/boot"} / node_filesystem_size_bytes{fstype!="tmpfs",mountpoint!="/boot"} < 0.15
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: Node disk free space below 15%
          description: Free space is below the safety margin for WAL, snapshots, or model caches.
```

## Dashboard set

Minimum dashboards:

1. **Console SLO**: `/api/health` availability, p95 latency, auth failures, active SSE clients.
2. **PostgreSQL**: connections, WAL archiver success/failure, replication lag, checkpoint duration, `cs3.verify_audit_chain()` job result.
3. **OpenSearch / Wazuh**: cluster health, unassigned shards, JVM heap, disk, ingest rate.
4. **Ollama**: per-node latency, queue depth, active requests, model reload frequency.
5. **Fleet**: `cs3_fleet_total`, `cs3_fleet_active`, `cs3_fleet_offline`, pending enrollments.
6. **Host capacity**: CPU, memory, disk, NIC saturation on DB, indexer, and GPU nodes.

## Alert routing

- critical: page the on-call engineer immediately
- warning: send to SOC platform ops channel and create a ticket within the same shift
- maintenance windows: silence only the exact services being worked on, not the entire CS3 stack

## Operator checks after changes

```bash
curl -fsS http://localhost:3000/api/health | python3 -m json.tool
curl -fsS http://localhost:3000/api/fleet/summary | python3 -m json.tool
docker compose exec -T postgres psql -U postgres -d cs3 -c "select cs3.verify_audit_chain();"
```

Keep alert thresholds in version control with the same rigor as application configuration.

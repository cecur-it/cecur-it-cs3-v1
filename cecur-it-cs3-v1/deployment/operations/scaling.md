# Scaling SOP

Use this SOP when sustained EPS, analyst concurrency, or agent count outgrow the current CS3 footprint.

## Scale triggers

| Signal | Threshold | Action |
|---|---|---|
| Console CPU | > 70% for 15 min | add console replicas |
| Console p95 latency | > 500 ms for 15 min | add replicas and review DB pool sizing |
| PostgreSQL connections | > 80% of `max_connections` | lower pool per replica or add DB capacity |
| OpenSearch hot-node disk | > 75% used | add hot nodes or change future shard count |
| Ollama queue depth | queue non-zero for 10 min | add nodes or reduce `OLLAMA_NUM_PARALLEL` |
| Fleet onboarding backlog | pending enrollments grow, `413` on bulk enroll | reduce batch size or raise limits |

## Horizontal console replicas (Helm)

The chart already exposes HPA settings in `deployment/helm/cs3/values.yaml`.

Increase console capacity with Helm rather than ad hoc pod edits:

```bash
helm upgrade --install cs3 deployment/helm/cs3 -n cs3 --reuse-values       --set console.replicas=4       --set console.hpa.enabled=true       --set console.hpa.minReplicas=4       --set console.hpa.maxReplicas=12       --set console.hpa.targetCPUUtilizationPercentage=70       --set console.pgPoolMax=15
```

Keep `console.replicas * console.pgPoolMax` within PostgreSQL connection capacity.

## PostgreSQL read replicas

Use replicas for analytics, exports, and reporting only. Keep the writer path, `LISTEN cs3_events`, `cs3.audit_logs`, and `cs3.enrollments` on the primary.

For a physical replica:

```bash
pg_basebackup -h primary-db.example.internal -U replicator -D /var/lib/postgresql/data -Fp -Xs -P -R
```

Then confirm:

```bash
psql -U postgres -d cs3 -c "select pg_is_in_recovery();"
```

If the value is `t`, the node is safe for read-only workloads.

## OpenSearch node adds

1. provision the node with matching OpenSearch version and TLS trust chain
2. add the node to `discovery.seed_hosts`
3. set `node.roles` and `node.attr.tier`
4. start the service and wait for it to join
5. if you added hot nodes, raise replica count only after the node is stable

Validate with:

```bash
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cat/nodes?v
curl --cacert /etc/opensearch/root-ca.pem -u "$OS_USER:$OS_PASS" https://indexer-mgr-1.example.internal:9200/_cat/allocation?v
```

## Ollama node adds

Docker / Podman:

- create a new `ollama-N` service with its own volume
- pin a unique GPU if applicable
- add the node to `nginx.conf` or `haproxy.cfg`
- pre-load the approved models before routing production traffic

Kubernetes:

```bash
kubectl scale statefulset/<release>-ollama -n cs3 --replicas=4
kubectl rollout status statefulset/<release>-ollama -n cs3
kubectl get svc <release>-ollama-lb -n cs3
```

## Fleet enrollment batching

The server enforces `CS3_ENROLL_MAX_BATCH` (`1000` by default). Keep client batches at or below that value; `250-500` is a safer steady-state target.

Direct API example that `deployment/agents/cs3-enroll.mjs` should mirror:

```bash
curl -fsS -XPOST https://soc.example.internal/api/fleet/enroll/bulk       -H "Authorization: Bearer $CS3_TOKEN"       -H 'Content-Type: application/json'       -d '{
    "group":["windows-workstations"],
    "ttlHours":24,
    "dryRun":false,
    "agents":[
      {"hostname":"ws-001","platform":"windows","ip":"10.10.10.11","osName":"Windows 11","osVersion":"23H2","arch":"x86_64","workloadType":"local"},
      {"hostname":"ws-002","platform":"windows","ip":"10.10.10.12","osName":"Windows 11","osVersion":"23H2","arch":"x86_64","workloadType":"local"}
    ]
  }'
```

Batch rollout pattern:

- wave 1: 5% canary
- wave 2: 20-25%
- wave 3: remaining fleet

## Procedure summary

1. confirm the trigger is real for at least one business cycle
2. take or confirm backups
3. scale the narrowest bottleneck first
4. run health checks (`/api/health`, `cs3.verify_audit_chain()`, cluster health, model list)
5. watch metrics for 30-60 minutes before the next scale step

## Exit criteria

A scale event is complete only when:

- the new capacity is visible in health endpoints and dashboards
- no new alerts remain open for the changed tier
- updated connection, shard, and queue baselines are captured in the change record

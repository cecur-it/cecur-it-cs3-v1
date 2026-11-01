# Chaos engineering playbook

Use this playbook only in a controlled test window with stakeholder approval. Run the experiments in order of blast radius.

## 1. Steady-state hypotheses

| ID | Hypothesis |
|---|---|
| H1 | `/api/health` remains `200` and returns `status=nominal` during single-component restarts that the deployment is designed to tolerate. |
| H2 | Forwarder ingest retries succeed without operator action for transient console or Ollama loss. |
| H3 | SSE clients connected to `/api/events` reconnect automatically after pod/container replacement. |
| H4 | Postgres and OpenSearch failures are surfaced within the alerting window and do not silently corrupt audit or search data. |
| H5 | Enrollment abuse on `POST /api/fleet/enroll/claim` is rate-limited with HTTP `429` after repeated failures from one source IP. |

## 2. Blast-radius guards

- Run one experiment at a time.
- Keep a live health probe running:
  - `watch -n 5 'curl -fsS https://cs3.example.mil/api/health | jq .status'`
- Abort if any of the following occurs:
  - `/api/health` fails for more than 5 consecutive minutes
  - data-tier cluster enters unrecoverable red state
  - ingest error rate remains above 5% for 10 minutes after the fault is removed
  - recovery would require destructive data repair outside the runbook

## 3. Experiment catalog

### E1 - kill one console instance

**Docker Compose**

```bash
docker compose -f deployment/docker/docker-compose.yml kill console
docker compose -f deployment/docker/docker-compose.yml ps
```

**Kubernetes**

```bash
kubectl -n cs3 delete pod -l app.kubernetes.io/name=cs3-console
kubectl -n cs3 rollout status deploy/cs3-console --timeout=5m
```

**Expected result**

- reverse proxy returns brief `502/503` only if a single replica exists
- `/api/health` recovers automatically after restart
- `/api/events` clients reconnect without manual browser refresh

### E2 - kill one Ollama node

**Docker Compose**

```bash
docker compose -f deployment/docker/docker-compose.yml stop ollama-1
docker compose -f deployment/docker/docker-compose.yml logs --tail=100 ollama-lb
```

**Kubernetes**

```bash
kubectl -n cs3 delete pod ollama-0
kubectl -n cs3 get pods -l app.kubernetes.io/name=ollama -w
```

**Expected result**

- inference latency rises but console remains available
- remaining Ollama nodes keep serving through the load balancer
- no user-facing 5xx spike beyond the agreed error budget

### E3 - Postgres primary failover / restart recovery

**Docker Compose** (single-instance profile: recovery test, not HA failover)

```bash
docker compose -f deployment/docker/docker-compose.yml stop postgres
sleep 30
docker compose -f deployment/docker/docker-compose.yml start postgres
```

**Kubernetes** (HA cluster assumption)

```bash
kubectl -n cs3 get pods -l app.kubernetes.io/name=postgres -o wide
kubectl -n cs3 delete pod cs3-postgres-0
kubectl -n cs3 get pods -l app.kubernetes.io/name=postgres -w
```

**Expected result**

- health check reports degraded or transient failure while the primary is unavailable
- after promotion/restart, writes resume without manual schema repair
- audit chain verification still passes once the database is stable

### E4 - OpenSearch node loss

**Docker Compose** (single-node profile: degraded-search test)

```bash
docker compose -f deployment/docker/docker-compose.yml --profile siem stop indexer
sleep 30
docker compose -f deployment/docker/docker-compose.yml --profile siem start indexer
```

**Kubernetes**

```bash
kubectl -n cs3 delete pod cs3-opensearch-data-1
kubectl -n cs3 get pods -l app.kubernetes.io/name=opensearch -w
```

**Expected result**

- ingest to the console may continue while search/index operations degrade
- no silent data loss: backlog is either queued or explicitly alarmed
- cluster health returns to green/yellow within the recovery window

### E5 - network partition between DMZ and internal app segment

**Host firewall injection**

```bash
sudo nft add rule inet filter forward ip saddr 10.20.10.10 ip daddr 10.20.20.10 drop
sleep 120
sudo nft delete rule inet filter forward handle $(sudo nft -a list chain inet filter forward | awk '/10\.20\.10\.10.*10\.20\.20\.10/ {print $NF; exit}')
```

**Kubernetes with Chaos Mesh (optional)**

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: cs3-dmz-to-app-loss
  namespace: cs3
spec:
  action: partition
  mode: all
  selector:
    labelSelectors:
      app.kubernetes.io/name: cs3-console
  direction: both
  target:
    mode: all
    selector:
      labelSelectors:
        app.kubernetes.io/name: ingress-nginx
```

**Expected result**

- edge returns `502/503` while the partition exists
- app/data tiers do not get exposed directly as a workaround
- service recovers cleanly when connectivity is restored

### E6 - fill the WAL archive target

**Docker Compose**

```bash
docker exec $(docker ps --filter name=postgres --format '{{.ID}}' | head -n 1) sh -c 'dd if=/dev/zero of=/wal-archive/fill.bin bs=1M count=20480 status=progress'
```

**Kubernetes**

```bash
kubectl -n cs3 exec sts/cs3-postgres -- sh -c 'dd if=/dev/zero of=/wal-archive/fill.bin bs=1M count=20480 status=progress'
```

**Expected result**

- alert fires before the archive fills completely
- database either continues safely with warnings or explicitly blocks archiving-related writes without corruption
- cleanup restores normal operation:

```bash
rm -f /wal-archive/fill.bin
```

### E7 - clock skew

**Dedicated test host only**

```bash
sudo date -s '+10 minutes'
# after observation
sudo chronyc -a makestep
```

**Expected result**

- certificate validation and token-expiry monitoring should detect the issue quickly
- health dashboards show time drift or secondary symptoms (TLS, auth, audit timestamp anomalies)

### E8 - expired agent certificate

Advance time on a non-production test agent beyond certificate expiry, then restart the forwarder.

**Linux agent**

```bash
sudo date -s '+120 days'
sudo systemctl restart cecur-forwarder
# restore time
sudo chronyc -a makestep
```

**Windows agent**

```powershell
Set-Date -Date (Get-Date).AddDays(120)
Restart-Service CecurForwarder
w32tm /resync /force
```

**Expected result**

- mTLS handshake fails at the edge
- ingest is rejected until a renewed certificate is installed
- no fallback to anonymous or unauthenticated ingest occurs

### E9 - enrollment-token abuse / 429 verification

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    -X POST https://ingest.cs3.example.mil/api/fleet/enroll/claim \
    -H 'Content-Type: application/json' \
    -d '{"agentId":"bad-agent","token":"bad-token"}'
done
```

**Expected result**

- initial bad claims return `401`
- after repeated failures from one source IP inside one minute, the route returns `429`
- normal valid claims from other IPs continue to work

## 4. Expected results summary

| Experiment | Primary signals | Recovery target |
|---|---|---|
| E1 console kill | `/api/health`, restart count, SSE reconnect | < 5 min |
| E2 Ollama node loss | inference latency, console errors | < 10 min |
| E3 Postgres failover/restart | DB role/state, write success, audit verification | < 15 min |
| E4 OpenSearch node loss | cluster health, indexing backlog, search errors | < 20 min |
| E5 network partition | edge 5xx, no direct data-tier exposure | < 10 min after heal |
| E6 WAL archive full | DB warnings, storage alert, archive recovery | < 30 min |
| E7 clock skew | TLS/auth errors, audit drift | < 15 min |
| E8 expired cert | mTLS reject, no anonymous ingest | Until cert renewed |
| E9 token abuse | 401→429 transition, no collateral lockout | Immediate after window resets |

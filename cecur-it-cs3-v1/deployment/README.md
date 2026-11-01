# CS3 production deployment (1,000+ endpoints)

Everything needed to run Cecur CS3 on-prem (or in a cloud / air-gapped enclave) at fleet scale.

> **Looking for a guided on-prem path?** [`on-prem/`](../on-prem/README.md) curates the `onprem`
> profile across this directory into a single README + checklist, adds a VyOS edge/firewall
> bootstrap script, a fail-closed preflight gate, and the real-telemetry durability fix (events
> ingested via `POST /api/cecur/logs/ingest` are now durably indexed into OpenSearch, not just
> kept in a 300-row in-memory cache). It does not replace anything below — it is a thin,
> opinionated wrapper around it.

```
deployment/
├── helm/cs3/            Helm chart + values.yaml, values-cloud.yaml, values-onprem.yaml, values-airgap.yaml
├── kustomize/           base + components (postgres, ollama) + overlays (cloud, onprem, airgap)
├── argocd/              AppProject, Helm/Kustomize Applications, multi-site ApplicationSet
├── docker/              docker-compose.yml (+ gpu, supabase overrides), Ollama LB (NGINX/HAProxy), PostgreSQL init schema
├── terraform/           OpenTofu/Terraform HCL: aws/ root + modules (network, security_groups, backup_bucket, helm_release)
├── ansible/             provisioning, forwarder rollout, cert rotation, model update/rollback, backup, remediation
├── agents/              endpoint forwarder installers (PowerShell, Bash), watchdogs, bulk enrollment CLI
├── operations/          SOPs: backup/restore, scaling, capacity, monitoring, retention, networking, firewall, PKI, compliance, testing
└── scripts/             sync-sql.sh (keeps the Kustomize and Helm copies of the schema in sync)
```

## Pick a path

| Situation | Use |
|---|---|
| Single host / lab / small site | `docker/` (`docker compose up -d`; Podman supported) — see `docker/README.md` |
| Kubernetes, Helm-native | `helm/cs3` with `-f values-<profile>.yaml` |
| Kubernetes, GitOps | `kustomize/overlays/<profile>` via ArgoCD (`argocd/`), see `operations/cloud-native-guide.md` |
| VM fleet (no Kubernetes) | `ansible/` (`provision.yml`, profile via `-e @vars/<profile>.yml`) |
| Cloud network + immutable backups | `terraform/aws` |

### Profiles

| Profile | Egress | Models | Notes |
|---|---|---|---|
| `onprem` | restricted to approved mirrors | local Ollama only | hosted-model keys rejected |
| `airgap` | none | from verified bundles (`scripts/verify-bundle.mjs`) | images/models arrive via cross-domain transfer |
| `cloud` | security groups | local; hosted optional | managed ingress / secrets |

## Fleet rollout in five steps

1. Deploy the stack (above) with `CS3_PERSISTENCE=postgres` and `CS3_INGEST_REQUIRE_KEY=true`.
2. Bulk-enroll hosts: `node agents/cs3-enroll.mjs bulk --url https://… --file hosts.csv` (≤ 1000 per request, automatic batching).
3. Roll out forwarders in waves (5 % → 25 % → rest): `ansible/playbooks/deploy-forwarders.yml`, or `agents/install-forwarder.sh` / `Install-CecurForwarder.ps1`.
4. Watchdogs auto-restart unhealthy forwarders and report cert expiry; fleet-wide remediation: `ansible/playbooks/health-remediation.yml`.
5. Validate: `operations/testing/` (100 / 1,000 / 10,000 EPS scenarios, chaos, multi-site failover, SLA template).

## PostgreSQL + JSONB persistence

Optional layer enabled with `CS3_PERSISTENCE=postgres` and `DATABASE_URL`. The schema (`docker/postgres/init/`) maps each Firestore collection to a
table with a `data jsonb` column (`id`, `data`, timestamps, GIN index).

- **Audit tamper protection (NIST AU-9):** `cs3.audit_logs` replaces the append-only `/auditLogs` rule of `firestore.rules`: row-level security (SELECT/INSERT policies only, FORCE enabled), `BEFORE UPDATE OR DELETE` (and `TRUNCATE`) triggers that raise exceptions, a hash chain per row, and `cs3.verify_audit_chain()` (returns `NULL` when intact). The app role has no UPDATE/DELETE grant; retention is export + immutable storage (`operations/log-retention-archival.md`).
- **Real time:** Firestore `onSnapshot` is replaced by `LISTEN/NOTIFY` (channel `cs3_events`); `server/pg/events.ts` bridges notifications into the existing SSE stream (`/api/live/stream`, also exposed as `/api/events`) in `server.ts`.
- **Supabase self-hosted:** `docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d` (see `docker/README.md`).

Details and operations: `operations/postgres-persistence.md`, `operations/backup-restore.md`.

## Console additions (`demo/demo-100226`)

- `POST /api/fleet/enroll/bulk` (admin, `manage_fleet`), `POST /api/fleet/enroll/claim` (single-use token), `GET /api/fleet/summary`.
- `POST /api/cecur/logs/ingest` accepts one event or an array; optional per-agent key enforcement (`CS3_INGEST_REQUIRE_KEY`).
- Fleet routes are rate limited per IP (`CS3_FLEET_RATE_LIMIT`, default 600/min; raise it if agents claim through a shared NAT/relay).
- `/api/events` alias for the SSE stream; `CS3_JSON_LIMIT` tunes the body limit; graceful SIGTERM shutdown.

## Operations index

See [`operations/README.md`](operations/README.md) for the full SOP list (backup/restore, model update/rollback, patching, scaling, capacity, monitoring,
retention, networking and firewall templates, mTLS/pinning, certificate rotation, compliance mapping for GDPR/HIPAA/FedRAMP/CJIS/NIST 800-53/800-171, testing).

## Validation

CI (`.github/workflows/deployment-validate.yml`) runs helm lint/template, kustomize builds, compose config, shellcheck, the PowerShell parser,
Ansible syntax checks, `tofu validate` and the console type-check on every change under `deployment/`.

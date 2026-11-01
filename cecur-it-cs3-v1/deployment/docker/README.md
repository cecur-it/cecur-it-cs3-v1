# deployment/docker

Docker Compose stack for local / single-host on-prem CS3: console, PostgreSQL (JSONB, RLS-protected
audit ledger), two Ollama nodes behind an NGINX (or HAProxy) load balancer, optional OpenSearch.

```bash
cp .env.example .env            # then fill JWT_SECRET, POSTGRES_*, CS3_*_PASSWORD
docker compose up -d
docker compose --profile pull-models up ollama-init   # connected profiles only
curl -fsS http://localhost:3000/api/health
```

| File | Purpose |
|---|---|
| `docker-compose.yml` | Base stack. Profiles: `siem`, `haproxy`, `pull-models`. |
| `docker-compose.gpu.yml` | NVIDIA GPU pinning (one GPU per Ollama node). |
| `docker-compose.supabase.yml` | Supabase self-hosted Postgres image profile. |
| `postgres/init/` | `001_roles.sh`, `002_schema.sql`, `003_audit_protection.sql`, `004_notify.sql`, `005_migrate_hexstrike_to_errow.sql` (idempotent rename for standing DBs). Executed on first start. |
| `postgres/tests/` | `audit_tamper_test.sql` — proves AU-9 protections. |
| `ollama-lb/` | `nginx.conf` (passive checks) and `haproxy.cfg` (active checks, queue backpressure). |

## Podman

`podman compose up -d` (Podman ≥ 4.7 with the compose provider) or `podman-compose up -d`.
Rootless notes: ports < 1024 need `sysctl net.ipv4.ip_unprivileged_port_start=80`; for GPUs use CDI
(see comments in `docker-compose.gpu.yml`); add `:Z` to bind mounts on SELinux hosts, e.g.
`./postgres/init:/docker-entrypoint-initdb.d:ro,Z`.

## Air-gap

Set `CS3_PROFILE=airgap`, leave `GEMINI_API_KEY`/`DEEPSEEK_API_KEY` blank, pre-load images with
`docker load` / `podman load`, and import models from the verified bundle
(`../operations/model-update-rollback.md`). Do **not** use the `pull-models` profile.

## Re-initialising Postgres

Init scripts only run on an empty data volume. `docker compose down -v` destroys data — never
do this in production; schema changes go through new numbered migrations run as `cs3_migrator`.

# 03. Real Endpoint Onboarding — End-to-End Walkthrough

This walkthrough enrolls real hosts using the tooling that already exists in
[`deployment/agents/`](../../deployment/agents/) and [`deployment/ansible/`](../../deployment/ansible/).
Nothing here invents a new enrollment mechanism — it sequences the existing one and adds the
on-prem safety rails described in `on-prem/README.md`.

## 0. Prerequisites

- A console already running with `CS3_PROFILE=onprem`, `CS3_DEMO_MODE` unset/false, and
  `CS3_INGEST_REQUIRE_KEY=true` (verify with `on-prem/bin/preflight-check.sh`).
- An admin account with the `manage_fleet` permission, and either `CS3_TOKEN` or
  `CS3_USERNAME`/`CS3_PASSWORD` exported (never pass credentials on the command line — see
  `deployment/agents/cs3-enroll.mjs` header comment).
- A real inventory file (`hosts.csv` or `hosts.json`) with your actual hostnames, IPs, and
  platforms. Columns: `hostname` (required), `ip`, `platform` (`linux|windows|macos|container`),
  `osName`, `osVersion`, `arch`, `workloadType`, `group` (`deployment/agents/README.md`).

## 1. Bulk-enroll

```bash
export CS3_TOKEN=<admin token with manage_fleet>
on-prem/bin/enroll-real-endpoints.sh --url https://cs3.example.internal --file hosts.csv --group prod --dry-run
on-prem/bin/enroll-real-endpoints.sh --url https://cs3.example.internal --file hosts.csv --group prod --out cs3-enrollment.json
```

This wraps `deployment/agents/cs3-enroll.mjs bulk`, which calls `POST /api/fleet/enroll/bulk`
(batches of up to 1,000 per request, split automatically) and writes one-time enrollment tokens to
`cs3-enrollment.json` (mode `0600`). Treat that file as a secret — it feeds the installers in the
next step, then must be shredded.

## 2. Roll out forwarders

Pick one:

- **Ansible (recommended for fleets):** `deployment/ansible/playbooks/deploy-forwarders.yml`
  distributes and starts the Fluent Bit-based forwarder in waves.
- **By hand / MDM:** `deployment/agents/install-forwarder.sh` (Linux, installs a systemd unit) or
  `deployment/agents/Install-CecurForwarder.ps1` (Windows, installs a scheduled task/service).

Each installer redeems the host's one-time token at `POST /api/fleet/enroll/claim` and receives a
per-agent ingest key, which it stores locally and uses on every subsequent
`POST /api/cecur/logs/ingest` call (`X-API-Key` header). With `CS3_INGEST_REQUIRE_KEY=true`, the
console pins every event to that agent, so a compromised endpoint cannot impersonate another host
(`demo/demo-100226/server/fleet/enrollment.ts#requireIngestKey`).

## 3. Watch health

`deployment/agents/cs3-forwarder-watchdog.sh` (Linux) / `Test-CecurForwarder.ps1` (Windows) restart
unhealthy forwarders within a bounded budget and report certificate expiry. Fleet-wide remediation
is `deployment/ansible/playbooks/health-remediation.yml`.

## 4. Confirm real telemetry is flowing and durable

```bash
on-prem/bin/verify-real-telemetry.sh --url https://cs3.example.internal --ingest-key <per-agent key> --token "$CS3_TOKEN"
```

This posts a uniquely marked event through the real ingest path, confirms it appears via
`GET /api/cecur/logs` (the console's hot cache), and — if `CS3_INDEXER_ENABLED=true` — confirms it
is durably indexed in OpenSearch (survives a console restart). See
`Literature/04_VALIDATION_AND_ACCEPTANCE.md` for the full acceptance procedure and
`server-extensions/README.md` for why `GET /api/cecur/logs` and OpenSearch are checked separately.

## 5. Scale notes for 1,000+ endpoints

- Fleet routes are rate limited per IP (`CS3_FLEET_RATE_LIMIT`, default 600/min — raise it if agents
  claim through a shared NAT or relay). Root `README.md` §6.4.1/§6.4.3.
- `POST /api/cecur/logs/ingest` accepts a single event or a JSON array capped by
  `CS3_INGEST_MAX_BATCH` (default 1000), matching Fluent Bit batch delivery.
- Load-test the expected EPS rate before go-live using
  `deployment/operations/testing/eps-loadgen.mjs` / `k6-ingest.js` (100/1,000/10,000 EPS
  scenarios already authored) — see `checklists/go-live-checklist.md`.

# CS3 On-Prem — real endpoints, real telemetry, zero simulation

`on-prem/` is the curated, production-oriented counterpart to [`demo/demo-100226`](../demo/demo-100226).
It runs the **same CS3 ESOC Console** code — there is no separate on-prem build — but every script,
checklist, and doc in this directory exists to get you from a bare on-prem VM (including a VyOS-fronted
network) to a console that is actually ingesting, indexing, and alerting on telemetry from **real
endpoints**, with the demo's mock-data loop permanently off.

## How this differs from `demo/demo-100226`

| | `demo/demo-100226` | `on-prem/` |
|---|---|---|
| Purpose | Evaluate the console UI/UX with no install | Stand up a real, durable, fleet-scale deployment |
| Data | `CS3_DEMO_MODE=true` → `generateInitial*()` seed data + a 3.5s `simulateTick()` mock loop (`server.ts`, `server/db.ts`, `server/data/generators.ts`) | `CS3_DEMO_MODE` is asserted **false**; zero seed data, zero simulation loop (`isDemoMode()` gates both — see `server/profile.ts`) |
| Endpoints | None — synthetic agents/sensors | Real hosts enrolled via `deployment/agents/cs3-enroll.mjs` and the Fluent Bit forwarders |
| Log storage | In-memory only | In-memory hot cache **and** durable OpenSearch indexing (see `server-extensions/README.md`) |
| Entry point | `npm run dev` inside `demo/demo-100226` | `bin/bootstrap-onprem.sh` orchestrating `cs3-launcher.mjs --profile onprem`, `deployment/docker` or `deployment/ansible`, and a VyOS edge (optional) |

## How this differs from `deployment/`

`deployment/` is the general-purpose production toolbox (Helm, Kustomize, ArgoCD, Ansible, Terraform,
Docker Compose, agents, and operations SOPs) covering `cloud`, `onprem`, and `airgap` profiles equally.
`on-prem/` does not duplicate any of that tooling. It is a **thin, opinionated path through it**,
specifically for the on-prem profile, that:

1. Adds a hard-fail preflight gate (`bin/preflight-check.sh`) so an operator cannot accidentally go live
   with demo mode, missing ingest-key enforcement, or hosted-model keys still set.
2. Adds the one piece of glue the generic tooling does not provide: a VyOS edge/firewall bootstrap script
   that turns the manual command list in
   [`deployment/operations/firewall/vyos-onprem.md`](../deployment/operations/firewall/vyos-onprem.md)
   into a parameterized, idempotent, dry-run-capable script.
3. Closes a real gap found by reading the code: `/api/cecur/logs/ingest` only kept the last 300 events in
   memory and never wrote to the OpenSearch indexer container the stack already runs. See
   `server-extensions/README.md` for the fix (now implemented in
   `demo/demo-100226/server/integrations/opensearchSink.ts`).
4. Documents and scripts the end-to-end proof that telemetry is real and durable
   (`Literature/04_VALIDATION_AND_ACCEPTANCE.md`, `bin/verify-real-telemetry.sh`).

## Hard invariant

**`CS3_DEMO_MODE` must never be `"true"` anywhere under this tree.** Every script here asserts this
before doing anything else (`bin/preflight-check.sh`), and every doc traces its data path back to a real
enrolled endpoint — never to `server/data/generators.ts`.

## Quickstart

```bash
# 1. Read the architecture and prerequisites first.
less on-prem/Literature/01_ARCHITECTURE_REAL_TELEMETRY.md
less on-prem/Literature/02_VM_AND_VYOS_PREREQUISITES.md

# 2. (Optional) If a dedicated VyOS box fronts this deployment, apply the firewall policy.
cp on-prem/vyos/vyos-vars.example.yml on-prem/vyos/vyos-vars.yml   # edit site CIDRs/IPs
on-prem/vyos/bootstrap-vyos-edge.sh --vars on-prem/vyos/vyos-vars.yml --dry-run
on-prem/vyos/bootstrap-vyos-edge.sh --vars on-prem/vyos/vyos-vars.yml

# 3. Bootstrap the console host (wraps cs3-launcher.mjs + compose/ansible + preflight).
on-prem/bin/bootstrap-onprem.sh --vehicle docker   # or: --vehicle ansible

# 4. Enroll real endpoints and roll out forwarders.
on-prem/bin/enroll-real-endpoints.sh --url https://cs3.example.internal --file hosts.csv

# 5. Prove the telemetry is real and durable before go-live.
on-prem/bin/verify-real-telemetry.sh --url https://cs3.example.internal --agent-id <agentId>

# 6. Sign off.
less on-prem/checklists/go-live-checklist.md
```

## Directory map

```
on-prem/
  README.md                         # this file
  Literature/
    01_ARCHITECTURE_REAL_TELEMETRY.md   # endpoint -> forwarder -> ingest -> durable store -> console
    02_VM_AND_VYOS_PREREQUISITES.md     # VM sizing, network segments, VyOS edge prerequisites
    03_REAL_ENDPOINT_ONBOARDING.md      # end-to-end enrollment walkthrough
    04_VALIDATION_AND_ACCEPTANCE.md     # proving no mock data + durability across restarts
  vyos/
    README.md                         # relationship to deployment/operations/firewall/vyos-onprem.md
    bootstrap-vyos-edge.sh            # parameterized, idempotent, dry-run-capable VyOS firewall apply
    vyos-vars.example.yml             # per-site addressing model
  bin/
    preflight-check.sh                # fail-closed go/no-go gate
    bootstrap-onprem.sh               # orchestrates existing installer/deployment entry points
    enroll-real-endpoints.sh          # wraps deployment/agents/cs3-enroll.mjs with on-prem defaults
    verify-real-telemetry.sh          # proves a real event survives an indexer/console restart
  server-extensions/
    README.md                         # documents the OpenSearch durability fix and how it's wired
  compose/
    docker-compose.onprem.yml         # thin overlay: profile=onprem, siem enabled, demo mode forced off
  ansible/
    site-onprem.yml                   # thin wrapper: deployment/ansible/playbooks/site.yml -e vars/onprem.yml
  checklists/
    go-live-checklist.md              # pre-cutover sign-off list
```

## Cross-references

- Root [`README.md`](../README.md) §6.4 — production scale-out overview.
- [`deployment/README.md`](../deployment/README.md) — the full production toolbox this directory curates.
- [`deployment/operations/agent-fleet-management.md`](../deployment/operations/agent-fleet-management.md) — enrollment SOP.
- [`deployment/operations/networking-architecture.md`](../deployment/operations/networking-architecture.md) and
  [`deployment/operations/firewall/vyos-onprem.md`](../deployment/operations/firewall/vyos-onprem.md) — the network/firewall design this directory's `vyos/` scripts implement.
- [`deployment/operations/opensearch-cluster.md`](../deployment/operations/opensearch-cluster.md) — scaling the indexer this directory's durability fix writes to.

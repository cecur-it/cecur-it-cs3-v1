# CS3 Platform — Multi-Platform Installation Guide 
## PaaS & On-Prem

**NIST SP 800-53 Rev. 5 (High) · NIST SP 800-171 Rev. 3 · FedRAMP High · DoD IL5/6**

CS3 Platform is produced and maintained by **CECUR-IT**. Company site:
<https://cecur-it.io/> · See the console before you install anything, no
account required: <https://demo.cecur-it.io/> · Listen to a narrated
platform overview: <https://audio.cecur-it.io/>.

2026-09-18 · Prepared by CECUR-IT, Inc.

## 1. Purpose, Audience & Deployment Path Selection

This guide covers two supported installation paths for the CS3 Platform and adds a third module - an On-Prem Agentic AI Stack - for DoD, Federal, and Public Sector customers whose data residency, air-gap, or ATO requirements rule out calling external model APIs (Gemini/DeepSeek) from the standard CS3 AI router.

For production on-prem installations serving **1,000+ live endpoints** (multi-node Ollama, PostgreSQL persistence, fleet enrollment, backups, network/firewall templates, load and chaos testing), this guide is complemented by the [`deployment/`](deployment/README.md) tree — see Section 6.4.

Audience: platform architects, ISSOs/ISsMs, SOC engineers, and DevOps administrators responsible for standing up or maintaining a CS3 deployment inside a customer enclave.

Repository status: the installation source referenced throughout this guide (`cecur-it-cs3`) is a private GitHub repository. Every step below assumes authenticated, least-privilege access - see Section 2 before cloning anything.

### 1.1 Choosing a Path

| Criterion | Path A — PaaS (Cloud-Hosted) | Path B — On-Prem / Air-Gapped Agentic Stack |
|-----------|------------------------------|---------------------------------------------|
| Data residency | Data may transit CS3 Cloud / external LLM APIs | All telemetry and LLM inference stay inside the customer boundary |
| Network posture | Requires outbound HTTPS to CS3 Cloud + model providers | Works fully offline after initial bundle install |
| Model hosting | CS3 AI Flash / CS3 AI Chat (hosted) | Ollama-hosted Gemma-4 and Nemotron-3-Nano (local) |
| Typical fit | Commercial SOCs, MSSPs, low-latency SLA needs | DoD/IL4-IL6, FedRAMP-adjacent, CUI/CJIS environments, disconnected OT/SCADA sites |
| Compliance anchor | SOC 2 / ISO 27001 (provider-managed) | Customer-owned ATO, NIST 800-53, DoD STIGs |
| Ops burden | Low — managed by CECUR-IT | Higher — customer owns GPU capacity, model lifecycle, patching |

Most Federal deployments run a hybrid: the CS3 console and SIEM/SOAR core on-prem or in a GovCloud tenant, with the Agentic LLM Router pointed at the local Ollama endpoint instead of external APIs. Section 6 and Section 7 cover that wiring.

### 1.2 Terminology & Compliance Framing

This guide reuses CECUR-IT's public terminology verbatim so that nothing drifts between the marketing surface, this installer, and a customer's ATO package:

| Term | Meaning |
|------|---------|
| **ESOC** | Enterprise Security Operations Center — the CS3 console surface installed by this repository (referred to below as the CS3 ESOC Console). |
| **ConMon** | Continuous Monitoring — the ongoing telemetry/logging posture this repository's health checks and audit logging feed into. |
| **HATS** | Holistic Approach to Security — CECUR-IT's overall security framework, of which this installer implements the technical controls. |
| **CUI Enclave** | A customer network boundary handling Controlled Unclassified Information; the on-prem/airgap paths in this guide are designed to keep inference and telemetry inside that boundary. |
| **SPRS 110/110** | The maximum possible score under DoD's Supplier Performance Risk System scoring methodology (110 points). This is terminology describing the scoring system's ceiling, not a score CECUR-IT or this repository attains or attests to — any customer's actual SPRS score is established solely by that customer's own assessment. |
| **CMMC 2.0 Level 2** | The Cybersecurity Maturity Model Certification tier aligned to NIST SP 800-171 Rev. 3 that many DoD contracts require; this repository documents engineering controls relevant to that baseline, not an attained certification. |
| **NIST SP 800-53 Rev. 5 (High) / NIST SP 800-171 Rev. 3** | The control baselines this repository's engineering controls are designed against (see the banner at the top of this document). |

**What this repository does and does not claim:** CECUR-IT's public site (<https://cecur-it.io/>) makes compliance claims about assessment outcomes, including first-pass 3PAO/C3PAO rates and maximum SPRS scores. This repository does not restate those as engineering facts. It describes the engineering controls that support such outcomes — air-gap bundle verification, ConMon telemetry, SBOM generation, unprivileged service accounts, and the rest of this guide — and leaves attestation to your organization's formal authorization (ATO) process. See Section 9 for the full split of responsibilities.

**Try before you install:** an evaluator can walk through the CS3 ESOC Console with no install at all via the hosted demonstration console at <https://demo.cecur-it.io/>, and can listen to a narrated platform overview at <https://audio.cecur-it.io/> before starting Section 5 or Section 6 below.

## 2. Private Repository & Access Model

The `cecur-it-cs3` repository stays private for the lifetime of the engagement. Treat repo access as a security control:

### 2.1 Provider-Side (CECUR-IT) Controls

- Org-scoped access only — no personal forks with broad org permissions; contributors added via team membership, never individual repo-admin grants.
- Branch protection on `main` / `release/*`: required PR review (2 reviewers for anything touching `scripts/`, `install.*`, or `onboarding/`), required status checks (lint, SCA, secret scan), no force-push, no direct commits.
- `CODEOWNERS` on `scripts/`, `onboarding/wizard.config.json`, and `.github/workflows/` so install-path and CI changes always route to platform security review.
- Signed, checksummed releases — every tagged release publishes a `SHA256SUMS` (and, where feasible, a Sigstore/cosign signature) alongside binaries and model bundles produced by `.github/workflows/release.yml` and `model-bundle.yml`.
- Scoped automation credentials — GitHub Actions uses short-lived, workflow-scoped tokens (OIDC to cloud registries) rather than long-lived PATs; no secrets committed to the repo (secret scanning + push protection enabled).
- Dependency hygiene — Dependabot/Renovate for `package.json` and script dependencies; SBOM (CycloneDX) generated per release so customers can run their own vulnerability review before install.

### 2.2 Consumer-Side (Customer) Controls

Request access via your CECUR-IT engagement lead; access is granted per-named-user with the minimum role needed (read-only for install operators, write only for customer engineers actively contributing scripts back). For classified or disconnected networks, do not clone directly onto the target enclave. Pull the repository and its release artifacts onto an internet-connected staging host, verify checksums/signatures there (Section 6.3), and transfer only the verified bundle across your organization's approved cross-domain / removable-media process. Rotate any deploy keys or fine-grained PATs issued to your organization at engagement handoff and again at contract renewal. Enable your own org-level audit log review of clone/download events against this repository, consistent with your insider-risk program (the same posture CS3's own ActivTrak module applies to customer environments).

These controls apply identically whether you proceed to Path A (PaaS) or Path B (On-Prem/Air-Gapped) below.

## 3. Hardware & Prerequisite Sizing

Size the host to the model tier you intend to run, not the other way around. Treat the figures below as planning minimums — validate against the exact quantization/context length you deploy before production sign-off, and re-check current tags in the Ollama library at install time since sizes and defaults do change between releases.

| Tier | Model | Active Params | Min VRAM | Min System RAM | Notes |
|------|-------|---------------|----------|----------------|-------|
| Entry / edge workstation | Gemma-4 26B (MoE, 4B active) | 4B | 16 GB | 32 GB | Best fit for analyst workstations and single-seat air-gapped kits |
| Frontier / reasoning tier | Gemma-4 31B (Dense) | 31B | 24 GB+ | 64 GB | Coding, complex reasoning, multi-step agentic workflows |
| Agentic tool-use tier | Nemotron-3-Nano 30B (hybrid MoE, 3.5B active) | 3.5B | 24 GB+ | 64 GB | Recommended default for SOAR playbook generation; supports toggling thinking mode off for latency-sensitive triage |

### 3.1 Baseline Host Requirements

- OS: Ubuntu 22.04/24.04 LTS or RHEL 8/9 for server-class GPU hosts; Windows 11 Enterprise or macOS (Apple Silicon, unified memory ≥ 32 GB) supported for single-analyst workstation deployments.
- GPU: NVIDIA (CUDA 12.x) recommended for both model families; Apple Silicon (Metal) supported for smaller quantizations at reduced throughput.
- Disk: 200 GB+ free on an NVMe volume dedicated to `~/.ollama/models` — model weights, quantized variants, and any air-gap bundle staging add up quickly.
- Network (Path B only): no outbound internet requirement after initial installation; loopback (`localhost:11434`) and, optionally, an internal segment for multi-node Ollama fan-out (NGINX/HAProxy load balancer; see Section 6.4 and `deployment/operations/ollama-multinode-scaling.md`).
- Raspberry Pi / edge collectors: supported as CS3 Agent Fleet Forwarders (Section 5 of the main CS3 manual; installers in `deployment/agents/`) but are not valid hosts for Gemma-4/Nemotron inference — route their telemetry to a properly sized GPU host running the agentic stack.

## 4. Installer Repository Structure

The private `cecur-it-cs3` installer repository is organized so a single entry point (`cs3-launcher.mjs`) can branch by platform and by deployment profile (`cloud | onprem | airgap`):

```text
cecur-it-cs3/
  cs3-launcher.mjs          # shared logic + profile branch (cloud | onprem | airgap)
  install.sh                # Linux / RPi (cloud | onprem | airgap)
  install.command           # macOS double-click
  install.ps1               # Windows 11
  demo/demo-100226/         # CS3 ESOC Console source (React/Vite + Express); built into the console image
    Dockerfile              # builds the console image used by all three profiles (cs3-soc-console)
    .env.example            # variable reference for local `npm run dev` (placeholders only)
    server/fleet/           # bulk enrollment, single-use claim tokens, per-agent ingest keys
    server/pg/              # optional PostgreSQL JSONB persistence + LISTEN/NOTIFY → SSE bridge
    server/routes/fleet.ts  # /api/fleet/* (enroll/bulk, enroll/claim, summary)
  onboarding/               # interactive setup: profile, model tier, endpoints
    wizard.mjs              # interactive onboarding entry point
    wizard.config.json      # profile-gated environment prompts
    models.json             # approved model tags + release-pinned hashes
                            # profile definitions, required env vars per profile
                            # PaaS profile: CS3 Cloud + hosted LLM router
                            # On-prem profile: local Ollama endpoint, no external calls
                            # Air-gap profile: local Ollama + bundle verification required
                            # registry: model id, quant, size, min VRAM, sha256
    seed/{demo-data.json,policies.yaml}
    assets/{banner.txt, welcome.md}
  scripts/
    detect-hardware.mjs     # GPU/VRAM/OS probe → recommends a model tier
    install-ollama.sh       # pinned-version Ollama install + service hardening
    install-llama.cpp.sh    # optional llama.cpp fallback for non-CUDA/edge hosts
    build-airgap-bundle.mjs # creates offline, checksummed model bundles for air-gapped installs
    verify-bundle.mjs       # SHA-256 (and signature, where available) checks for air-gap bundles
  deployment/               # production orchestration for 1,000+ endpoints (Section 6.4)
    helm/cs3/               # Helm chart + values-cloud.yaml, values-onprem.yaml, values-airgap.yaml
    kustomize/              # base + components (postgres, ollama) + overlays (cloud | onprem | airgap)
    argocd/                 # AppProject, Helm/Kustomize Applications, multi-site ApplicationSet
    docker/                 # docker-compose.yml (+ gpu, supabase overrides), Ollama LB, PostgreSQL init schema
    terraform/              # OpenTofu/Terraform HCL: aws/ root module + network, security_groups, backup_bucket, helm_release
    ansible/                # provisioning, forwarder rollout, cert rotation, model update/rollback, backup, remediation
    agents/                 # forwarder installers (Bash, PowerShell), watchdogs, bulk enrollment CLI (cs3-enroll.mjs)
    operations/             # SOPs: backup/restore, scaling, capacity, monitoring, retention, networking, firewall, PKI, compliance, testing
    scripts/sync-sql.sh     # keeps the Kustomize and Helm copies of the PostgreSQL init schema in sync
  .github/workflows/
    release.yml             # signed, checksummed release artifacts
    model-bundle.yml        # builds the offline air-gap model bundle (Gemma-4 + Nemotron-3-Nano)
    deployment-validate.yml # static validation of deployment/ (helm, kustomize, compose, ansible, tofu, shellcheck, tsc)
```

Key differences from a generic cloud-only installer:

- `wizard.config.json` gates which env template is offered based on the selected profile — an operator cannot accidentally populate cloud API keys into an airgap profile, or vice versa.
- `models.json` is the single source of truth for which Gemma-4/Nemotron tags are approved for this release, each pinned with a SHA-256 digest that `verify-bundle.mjs` checks before the wizard will proceed.
- `model-bundle.yml` (optional CI job) pre-pulls and packages approved model weights into a portable, checksummed archive for environments with no outbound internet at install time — see Section 6.3.

### 4.1 Console Image & Runtime Variables (demo/demo-100226)

The ESOC Console shipped in `demo/demo-100226` is containerized by `demo/demo-100226/Dockerfile` (Node 20, non-root, `/api/health` healthcheck, `PORT` honored, default 3000). All three profiles use it via `CS3_CONSOLE_IMAGE`:

| Profile | How the image is obtained |
|---------|---------------------------|
| cloud / onprem | `docker pull` of `CS3_CONSOLE_IMAGE`; falls back to `docker build` from `demo/demo-100226` |
| airgap | `docker load` from `images/*.tar` inside the verified bundle (`node scripts/build-airgap-bundle.mjs --out <bundle>.tar` bundles the console image and the Ollama binary by default; pass `--no-include-console-image` / `--no-include-ollama-binary` only for a models-only refresh); no network pull or build is ever attempted |

Every generated `.env` also carries the console variables `JWT_SECRET` (auto-generated by the wizard if blank), `APP_URL`, `HEXSTRIKE_BASE_URL`, `HEXSTRIKE_API_KEY`, `CECUR_INDEXER_URL`, `CECUR_CLUSTER_NAME`, plus optional `FIREBASE_*` overrides on cloud/onprem. Firestore sync requires external egress and is not available on airgap; the bundled `firebase-applet-config.json` is only used as a default on the cloud profile (onprem needs explicit `FIREBASE_*` values). The mock telemetry simulation loop and demonstrative-credential seeding run only when `CS3_DEMO_MODE=true`. Fonts and avatars are served locally (no Google Fonts / Unsplash requests). On Linux onprem/airgap installs the console container runs with `--network host` so it can reach the loopback-only Ollama; on macOS/Windows it uses `host.docker.internal`. Third-party licensing (e.g. the GPL-2.0 Wazuh spec file) is documented in `NOTICE`. For local development without Docker: `cd demo/demo-100226 && npm install && cp .env.example .env && npm run dev`. Never commit real keys; `.env.example` contains placeholders only.

**Optional PostgreSQL persistence.** By default the console keeps state in memory (and, on cloud/onprem, optional Firestore sync). Set `CS3_PERSISTENCE=postgres` and `DATABASE_URL` to persist to PostgreSQL JSONB tables instead (schema in `deployment/docker/postgres/init/`; see Section 6.4.2). The SSE stream is served at `/api/live/stream` and is also exposed as `/api/events`.

## 5. Path A — PaaS (Cloud-Hosted) Installation

Use this path when the CS3 console and Agentic LLM Router may call CS3 Cloud-hosted models (CS3 AI Flash / CS3 AI Chat) directly.

1. Authenticate to the private repo (SSH deploy key or fine-grained PAT scoped read-only)

   ```bash
   git clone git@github.com:DaScient/cecur-it-cs3.git
   cd cecur-it-cs3
   ```

2. Run the shared launcher and select the cloud profile

   ```bash
   node cs3-launcher.mjs --profile cloud
   ```

The launcher will:

1. Run `onboarding/wizard.mjs`, which copies `onboarding/env.cloud.template` to `.env` and prompts for `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, and your CS3 tenant identifiers.
2. Pull (or, if the registry image is unavailable, build from `demo/demo-100226/Dockerfile`) and start the CS3 ESOC Console container (see the core manual's Section 04 for the underlying Docker/Kubernetes/Cloud Run deployment options).
3. Run the standard post-deployment health check (Section 10 below).

Secrets handling: never place live API keys directly in `wizard.config.json` or commit a populated `.env`. The wizard writes `.env` to a path already excluded via `.gitignore`; confirm that before proceeding in any shared or multi-tenant staging environment.

PaaS installs do not require Ollama, GPU provisioning, or the model-bundle workflow described in Path B — skip to Section 10 for verification once the console is reachable.

## 6. Path B — On-Prem & Air-Gapped Agentic Stack (Ollama + Gemma-4 + Nemotron-3-Nano)

### 6.1 Connected On-Prem (No Air-Gap)

For a customer network that has outbound access to `ollama.ai` / the Ollama registry but must keep inference and telemetry inside its own boundary:

1. Clone the private repo as in Section 5, then run the on-prem profile

   ```bash
   node cs3-launcher.mjs --profile onprem
   ```

   The launcher invokes `scripts/install-ollama.sh`, which pins a specific Ollama version, creates a dedicated non-root service account, and installs it as a systemd unit.

2. Pull the approved model tags (versions confirmed against `onboarding/models.json`)

   ```bash
   ollama pull gemma4:26b
   ollama pull gemma4:31b   # only if hardware meets the Frontier tier in Section 3
   ollama pull nemotron-3-nano:30b
   ```

Ollama exposes an OpenAI-compatible API at `http://localhost:11434/v1` - this is the endpoint the CS3 Agentic LLM Router and any agent framework (Section 7) target instead of external providers. `onboarding/env.onprem.template` sets:

```bash
CS3_LLM_MODE=local
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_PRIMARY_MODEL=nemotron-3-nano:30b
OLLAMA_FALLBACK_MODEL=gemma4:26b
GEMINI_API_KEY=      # left blank - no external calls in this profile
DEEPSEEK_API_KEY=    # left blank - no external calls in this profile
```

### 6.2 Fully Air-Gapped Installation

For networks with no outbound connectivity at install time, model weights must be pre-staged as a verified bundle rather than pulled live:

On an internet-connected build/staging host (NOT the target enclave):

```bash
# CI job .github/workflows/model-bundle.yml produces this artifact automatically on release;
# to build it manually:
ollama pull gemma4:26b
ollama pull nemotron-3-nano:30b
node scripts/build-airgap-bundle.mjs --out cs3-model-bundle-<version>.tar
sha256sum cs3-model-bundle-<version>.tar > cs3-model-bundle-<version>.sha256
```

Transfer the bundle and its checksum file to the air-gapped enclave using your organization's approved cross-domain transfer process (write-once media, data diode, or accredited transfer station) — never over an ad hoc network bridge.

On the target host:

```bash
# 1. Verify integrity BEFORE extracting or loading anything
node scripts/verify-bundle.mjs --bundle cs3-model-bundle-<version>.tar --sha256 cs3-model-bundle-<version>.sha256

# 2. Only on a PASS result, run the air-gap profile
node cs3-launcher.mjs --profile airgap --bundle cs3-model-bundle-<version>.tar
```

The airgap profile: loads models directly into Ollama's local store from the verified bundle (no registry pull attempted), disables any update-check or telemetry call in the CS3 console build, and fails closed — the wizard refuses to proceed — if `verify-bundle.mjs` reports a hash mismatch.

### 6.3 Bundle Verification Is Mandatory, Not Optional

Treat every offline model bundle exactly like any other software supply-chain artifact entering a classified or CUI environment:

Confirm the SHA-256 (and signature, if your release includes one) before extraction, on every transfer, even between two hosts you control. Cross-check the bundle's manifest against `onboarding/models.json` in the release tag you're installing — a bundle built from a different tag should not be silently accepted. Log the verification result (hash, verifier, timestamp) into your own change-management record for the ATO package; `verify-bundle.mjs --verbose` emits a machine-readable result suitable for that log.

### 6.4 Production Scale-Out (1,000+ Endpoints)

Everything below lives under [`deployment/`](deployment/README.md). Pick the deployment vehicle that matches your site, then follow the fleet rollout steps.

> **Curated on-prem path:** [`on-prem/`](on-prem/README.md) is a guided, opinionated walkthrough of this section specifically for the `onprem` profile (including a VyOS edge/firewall bootstrap script, a fail-closed preflight gate, and a real-telemetry durability fix) — start there if you are standing up a new on-prem site and want the full checklist end to end.

| Situation | Use | Entry point |
|-----------|-----|-------------|
| Single host / lab / small site | Docker Compose (Docker Engine or Podman) | `deployment/docker/` — `docker compose up -d` |
| Kubernetes, Helm-native | Helm chart with a profile values file | `deployment/helm/cs3/` — `-f values-onprem.yaml` (or `values-cloud.yaml` / `values-airgap.yaml`) |
| Kubernetes, GitOps | Kustomize overlays + ArgoCD | `deployment/kustomize/overlays/<profile>`, `deployment/argocd/` |
| VM fleet, no Kubernetes | Ansible | `deployment/ansible/playbooks/site.yml -e @vars/<profile>.yml` |
| Cloud network + immutable backups | OpenTofu / Terraform | `deployment/terraform/aws/` |

The three profiles keep the semantics used throughout this guide: `onprem` (restricted egress, local Ollama only, hosted-model keys rejected), `airgap` (no egress; images and models arrive only through verified bundles) and `cloud`.

#### 6.4.1 Agent Fleet Management

1. Deploy the stack with `CS3_INGEST_REQUIRE_KEY=true` so every forwarder must present its own key.
2. Bulk-enroll hosts (CSV or JSON; batches of up to 1,000 per request, split automatically):

   ```bash
   export CS3_TOKEN=<admin token with manage_fleet>      # or CS3_USERNAME + CS3_PASSWORD
   node deployment/agents/cs3-enroll.mjs bulk --url https://soc.example.internal --file hosts.csv --group prod --dry-run
   node deployment/agents/cs3-enroll.mjs bulk --url https://soc.example.internal --file hosts.csv --group prod --out cs3-enrollment.json
   ```

3. Roll out forwarders in waves (Ansible, MDM, or by hand): `deployment/ansible/playbooks/deploy-forwarders.yml`, `deployment/agents/install-forwarder.sh` (Linux/systemd) or `deployment/agents/Install-CecurForwarder.ps1` (Windows). Shred the enrollment file afterward.
4. Each endpoint redeems its one-time token at `POST /api/fleet/enroll/claim` and receives a per-agent ingest key; with `CS3_INGEST_REQUIRE_KEY=true` the console pins every event to that agent, so a compromised endpoint cannot impersonate another host.
5. Watchdogs (`cs3-forwarder-watchdog.sh` / `Test-CecurForwarder.ps1`) restart unhealthy forwarders within a bounded budget and report certificate expiry; fleet-wide remediation is `deployment/ansible/playbooks/health-remediation.yml`.

Enrollment tokens are single use, expire (default 24 h, maximum 168 h) and are stored server-side only as SHA-256 digests. Installers refuse plaintext HTTP and never take the token on the command line. Details: `deployment/agents/README.md`, `deployment/operations/agent-fleet-management.md`.

#### 6.4.2 PostgreSQL + JSONB Persistence

The optional persistence layer (`CS3_PERSISTENCE=postgres`, `DATABASE_URL`) maps each Firestore collection to a table with a `data jsonb` column and a GIN index. Firestore-specific behaviors are replaced as follows:

| Firestore behavior | PostgreSQL replacement |
|--------------------|------------------------|
| `firestore.rules` append-only `/auditLogs` | `cs3.audit_logs` with row-level security (SELECT/INSERT policies only, `FORCE`d) and `BEFORE UPDATE OR DELETE` plus `TRUNCATE` triggers that raise exceptions (NIST AU-9); a per-row hash chain verified by `cs3.verify_audit_chain()` (returns `NULL` when intact) |
| `onSnapshot` real-time listeners | `LISTEN/NOTIFY` on channel `cs3_events`, bridged by `server/pg/events.ts` into the existing SSE stream |
| Rules-based access | Separate roles: `cs3_migrator` (owns objects), `cs3_app` (DML only), `cs3_archiver` (read-only on audit logs) |

Because deletes are blocked by design, audit retention is export-and-archive to immutable storage (`deployment/operations/log-retention-archival.md`). A Supabase self-hosted profile is available with `docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d`. See `deployment/operations/postgres-persistence.md`.

#### 6.4.3 Scaling & Performance

- **Multi-node Ollama** behind NGINX (passive checks) or HAProxy (active checks, queue backpressure): `deployment/docker/ollama-lb/`, `deployment/operations/ollama-multinode-scaling.md`.
- **OpenSearch (Wazuh Indexer) cluster:** `deployment/operations/opensearch-cluster.md`.
- **Ingestion tuning** (buffering, backpressure, sharding): `deployment/operations/ingestion-tuning.md`. `POST /api/cecur/logs/ingest` accepts a single event or a JSON array (capped by `CS3_INGEST_MAX_BATCH`, default 1000), matching Fluent Bit batches; fleet routes are rate limited per IP (`CS3_FLEET_RATE_LIMIT`, default 600/min — raise it if agents claim through a shared NAT or relay).
- **Capacity planning and monitoring:** `deployment/operations/capacity-planning.md`, `deployment/operations/monitoring.md`.

#### 6.4.4 Operations & Maintenance

| Task | Runbook / automation |
|------|----------------------|
| Backup & restore (PostgreSQL WAL + base backups, OpenSearch snapshots) | `deployment/operations/backup-restore.md`, `ansible/playbooks/backup.yml` |
| Model update & rollback (air-gapped bundle verification, canary node first, auto-restore on failure) | `deployment/operations/model-update-rollback.md`, `ansible/playbooks/model-update.yml`, `model-rollback.yml` (both call `scripts/verify-bundle.mjs`) |
| Certificate rotation (mTLS / internal PKI) | `deployment/operations/certificate-rotation.md`, `ansible/playbooks/rotate-certs.yml` |
| Log retention & archival (Index State Management / cold storage) | `deployment/operations/log-retention-archival.md`, `operations/ism/cs3-logs-lifecycle.json` |
| Patching and scaling | `deployment/operations/patching.md`, `deployment/operations/scaling.md` |

#### 6.4.5 Networking, Security & Compliance

- Network architecture (DMZ, internal segment, cross-domain transfer): `deployment/operations/networking-architecture.md`.
- Firewall templates for each profile — nftables (`onprem`, `airgap`, cloud host), VyOS, and cloud security groups (also provisioned by `deployment/terraform/`): `deployment/operations/firewall/`. The nftables rulesets contain placeholder interface names and addresses that must be edited for your site.
- mTLS and certificate pinning for agent-to-console traffic: `deployment/operations/mtls-certificate-pinning.md` (installers support `--pin-sha256` / `-PinSha256` and an internal CA file).
- Data residency mapping for GDPR, HIPAA, FedRAMP, CJIS, NIST SP 800-53 and 800-171: `deployment/operations/compliance-mapping.md`. As with Section 1.2, this documents engineering controls; it is not an attestation.

#### 6.4.6 Testing & Validation

Load scenarios for 100, 1,000 and 10,000 EPS (`eps-loadgen.mjs`, `k6-ingest.js`), a chaos engineering playbook, multi-site failover procedures and performance baseline / SLA templates are in `deployment/operations/testing/`. Static validation of every deployment artifact runs in CI (`.github/workflows/deployment-validate.yml`).

## 7. Agent Framework Integration

All three frameworks below talk to the same local Ollama endpoint (`http://localhost:11434/v1`) — pick one based on how much orchestration control you need, not on model compatibility.

### 7.1 LangGraph

Best for stateful, multi-step SOC agents (ReAct loops, tool calling, memory, reflection). Point the model client at Ollama:

```python
from langchain_ollama import ChatOllama

llm = ChatOllama(
    model="nemotron-3-nano:30b",
    base_url="http://localhost:11434",
    temperature=0.2  # matches CS3's deterministic-reasoning posture
)
```

Use LangGraph's standard ReAct, tool-calling, and memory-persistence patterns with the same local Ollama base URL to keep all inference inside the customer boundary.

### 7.2 Microsoft Agent Framework

Lightweight tool-calling agents against an OpenAI-compatible endpoint:

```bash
pip install agent-framework
```

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

client = OpenAIChatClient(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # any non-empty string - ollama does not validate it
    model="gemma4:31b",
)
agent = ChatAgent(chat_client=client, tools=[...])
```

### 7.3 OpenJarvis

A research-backed framework decomposing the stack into intelligence, engine, agents, tools/memory, and learning primitives, with native MCP support for external tool integration. Configure its engine layer to use Ollama as the inference backend and select Gemma-4 or Nemotron-3-Nano per-agent based on the task profile (heavier reasoning → Gemma-4 31B; high-throughput tool-calling triage → Nemotron-3-Nano with thinking mode disabled).

### 7.4 Choosing Thinking Mode (Nemotron-3-Nano)

Nemotron-3-Nano's configurable thinking mode trades latency for reasoning depth:

- Enabled — use for SOAR playbook generation and root-cause synthesis where correctness matters more than speed (mirrors CS3's `temperature: 0.2`, JSON-schema-enforced posture from the core Agentic LLM Architecture).
- Disabled — use for high-volume, low-latency triage classification where sub-second response matters more than deep reasoning traces.

Whichever framework you choose, keep the same operational guardrails the core CS3 manual specifies for its hosted agents: fixed low temperature, strict JSON-schema output, mandatory rollback procedures on any generated remediation, and analyst-in-the-loop confirmation before execution.

## 8. Model Selection Guide

| Model | Active Params | Function Calling | Multimodal | Best Use in CS3 |
|-------|---------------|------------------|------------|-----------------|
| Gemma-4 26B (MoE) | 4B | Yes (native) | Text + image | Workstation-class deployments; general agentic tasks with a smaller VRAM footprint |
| Gemma-4 31B (Dense) | 31B | Yes (native) | Text + image | Frontier-level reasoning, coding, and complex multi-step agentic workflows |
| Nemotron-3-Nano 30B (hybrid MoE) | 3.5B | Yes | Text | Recommended default for tool-calling-heavy SOAR/agentic workloads; configurable thinking mode for latency tuning |

Rule of thumb: default new on-prem deployments to Nemotron-3-Nano 30B for the Agentic LLM Router (it was designed specifically for agentic use and tool calling), and use Gemma-4 31B as the secondary/fallback model for deeper reasoning or when image evidence (screenshots, network diagrams) needs to be analyzed alongside text telemetry — mirroring the core platform's primary/secondary dispatch pattern in Section 07 of the CS3 Technical Manual, but with both agents now running fully on-prem.

## 9. Safe-Installation Practices (Private-Deployment Hygiene)

Because `cecur-it-cs3` is private and carries install scripts with local system privileges, both sides of the engagement share responsibility for keeping the install path trustworthy.

### 9.1 Provider (CECUR-IT) Responsibilities

- Publish only signed, checksummed releases (Section 2.1); never point customers at an unpinned branch for a production install.
- Keep `install.sh`, `install.ps1`, and `install.command` idempotent and side-effect-scoped: they should create a dedicated, unprivileged service account for Ollama and the CS3 agent processes rather than running long-lived services as root or Administrator.
- Pin exact Ollama and model-runtime versions in `scripts/install-ollama.sh`; never pipe an unpinned latest installer straight into a shell for a production or customer-facing script.
- Ship an SBOM and a documented rollback/uninstall path with every release.
- Keep the air-gap build (`model-bundle.yml`) free of any telemetry, update-check, or phone-home call — a genuinely air-gapped profile should not attempt outbound network access at all, and the wizard should fail loudly if it detects an attempt.

### 9.2 Consumer (Customer) Responsibilities

- Read before you run: review the contents of any fetched script, especially `install.sh` and `install.ps1`, before executing it, rather than piping an unreviewed remote script straight into a shell.
- Verify before you trust: check release checksums and signatures (Section 2.1, Section 6.3) before installing binaries or model bundles, every time, including on internal retransfers.
- Principle of least privilege: run the Ollama service and CS3 agent processes under a dedicated, unprivileged OS account; apply system sandboxing or the Windows-service equivalent.
- Network egress control: for `onprem` (connected) profiles, allow-list only the specific registry and API hosts required; for `airgap` profiles, confirm via firewall rules and, ideally, a packet capture that no outbound attempts occur post-install.
- Secrets discipline: never commit populated `.env` files back to the repo, even to a private fork; rotate any API keys or tokens issued during onboarding once the deployment is stable.
- Bring it under existing controls: enroll the on-prem LLM host itself as a monitored asset in your CS3 Sensor Grid and RBAC and audit framework — the AI infrastructure that powers your SOC should not be a blind spot in that same SOC.
- Patch cadence: track Ollama, the model runtime, and any agent-framework dependencies against your organization's vulnerability management SLA; a private repo does not exempt the stack from your normal patch cycle.
- Compliance mapping: for DoD and Federal environments, map the above controls to your applicable STIGs and NIST 800-53 control set as part of your ATO package; this guide describes engineering practice, not a substitute for your organization's formal authorization process.

## 10. Post-Install Verification & Health Checks

Run these after either path before declaring the deployment ready for use.

### 10.1 Console & API Health (both paths)

```bash
curl -s http://localhost:3000/api/health | jq .
curl -H "Authorization: Bearer $CS3_TOKEN" http://localhost:3000/api/auth/me | jq .
```

Production scale-out installs (Section 6.4) should also confirm the fleet and persistence layers:

```bash
# Fleet summary (agents by status, pending enrollments) — requires an authenticated analyst/admin session
curl -s -H "Authorization: Bearer $CS3_TOKEN" http://localhost:3000/api/fleet/summary | jq .

# PostgreSQL persistence: the audit ledger hash chain must be intact (returns NULL)
docker compose -f deployment/docker/docker-compose.yml exec -T postgres psql -U postgres -d cs3 -c "select cs3.verify_audit_chain();"
```

### 10.2 Ollama & Model Availability (Path B)

```bash
# Confirm the service is up and models are loaded
ollama list

# Exercise the OpenAI-compatible endpoint directly
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "nemotron-3-nano:30b", "messages": [{"role": "user", "content": "Respond with the single word: ready"}]}'
```

Expected: a JSON response containing `"ready"` with no external network calls made — confirm with `sudo lsof -i -P -n | grep ollama` or an equivalent connection listing that Ollama is only bound to loopback (or your approved internal segment).

### 10.3 Agentic LLM Router Wired to Local Models

Confirm the CS3 Agentic LLM Router's primary dispatcher is resolving to the local endpoint rather than an external provider — the router log line on startup should reference `OLLAMA_BASE_URL` (from Section 6.1) rather than a hosted CS3 AI Flash/Chat endpoint. Trigger a test incident analysis through the console and verify the returned JSON matches the standard `AIIncidentAnalysis` schema from the core CS3 manual.

### 10.4 Air-Gap Confirmation (Path B, airgap profile only)

```bash
node scripts/verify-bundle.mjs --status
```

Should report the bundle hash that was verified at install time, the release tag it came from, and confirm no registry pull was attempted during model load.

## 11. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Model load fails / OOM | VRAM below the tier minimum in Section 3 | Drop to Gemma-4 26B MoE or Nemotron-3-Nano, or use a lower-bit quantization |
| `ollama pull` hangs or times out | Registry unreachable from an onprem host that is actually more restricted than expected | Confirm the profile — switch to the airgap path and use a pre-built bundle instead |
| Tool-calling responses malformed | Agent framework not enforcing JSON schema / temperature drifted from 0.2 | Re-check the framework config in Section 7; confirm `temperature: 0.2` and schema enforcement are set |
| High latency on triage tasks | Nemotron-3-Nano thinking mode left enabled | Disable thinking mode for latency-sensitive classification tasks (Section 7.4) |
| `verify-bundle.mjs` reports hash mismatch | Bundle corrupted or tampered in transit, or built from a different release tag | Re-transfer from a known-good source; never bypass this check to "just get it working" |
| Console can't reach the local model | Ollama bound to an unexpected interface, or firewall blocking loopback traffic (rare, but seen behind some host-hardening baselines) | Confirm `OLLAMA_BASE_URL` matches the bound interface; check local firewall rules for loopback exceptions |
| Forwarders get HTTP 401 on ingest after enabling `CS3_INGEST_REQUIRE_KEY` | Endpoint was never enrolled, token expired/already used, or key rotated | Re-enroll the host (`cs3-enroll.mjs`); run the installer with the new one-time token |
| Enrollment claim returns 429 for many hosts at once | Per-IP limiter tripped by a shared NAT/relay | Stagger waves (`cs3_forwarder_batch`) or raise `CS3_FLEET_RATE_LIMIT` |
| PostgreSQL `UPDATE`/`DELETE` on `audit_logs` raises an exception | Working as designed (NIST AU-9 tamper protection) | Archive and retain per `deployment/operations/log-retention-archival.md`; never disable the triggers |
| GPU not detected | Missing/mismatched CUDA driver version | Re-run `scripts/detect-hardware.mjs` and align driver version with the Ollama release's supported CUDA range |

## 12. Appendix

### 12.1 Environment Variable Reference

| Variable | Profile | Purpose |
|----------|---------|---------|
| `CS3_LLM_MODE` | onprem, airgap | `local` — routes the Agentic LLM Router to Ollama instead of external providers |
| `OLLAMA_BASE_URL` | onprem, airgap | Base URL for Ollama's OpenAI-compatible API (default `http://localhost:11434/v1`) |
| `OLLAMA_PRIMARY_MODEL` | onprem, airgap | Tag of the primary agentic model (default `nemotron-3-nano:30b`) |
| `OLLAMA_FALLBACK_MODEL` | onprem, airgap | Tag of the secondary/fallback model (default `gemma4:26b`) |
| `GEMINI_API_KEY` | cloud | CS3 AI Flash hosted API key — left blank in onprem/airgap profiles |
| `DEEPSEEK_API_KEY` | cloud | CS3 AI Chat hosted API key — left blank in onprem/airgap profiles |
| `CS3_AIRGAP_BUNDLE_SHA256` | airgap | Expected checksum of the currently loaded model bundle, checked at every launcher start |
| `CS3_PERSISTENCE` | all | `postgres` enables the PostgreSQL JSONB persistence layer (requires `DATABASE_URL`); default is in-memory |
| `DATABASE_URL` | all (when `CS3_PERSISTENCE=postgres`) | Connection string for the `cs3_app` role (supply the password via your secret store) |
| `CS3_INGEST_REQUIRE_KEY` | all | `true` requires an `X-API-Key` on `/api/cecur/logs/ingest` (shared `SOC_INGESTION_SECRET` or a per-agent key from enrollment) |
| `CS3_INGEST_MAX_BATCH` | all | Maximum events per ingest request (default 1000) |
| `CS3_ENROLL_MAX_BATCH` | all | Maximum agents per bulk-enrollment request (default 1000) |
| `CS3_FLEET_RATE_LIMIT` | all | Per-IP requests per minute on `/api/fleet/*` (default 600) |
| `CS3_JSON_LIMIT` | all | Express JSON body limit (default `2mb`) |

### 12.2 models.json Schema (excerpt)

```json
{
  "models": [
    {
      "id": "gemma4:26b",
      "family": "gemma-4",
      "variant": "MoE",
      "activeParams": "4B",
      "minVramGb": 16,
      "functionCalling": true,
      "multimodal": true,
      "sha256": "<pinned-per-release>"
    },
    {
      "id": "nemotron-3-nano:30b",
      "family": "nemotron-3-nano",
      "variant": "hybrid-MoE",
      "activeParams": "3.5B",
      "minVramGb": 24,
      "functionCalling": true,
      "multimodal": false,
      "thinkingModeConfigurable": true,
      "sha256": "<pinned-per-release>"
    }
  ]
}
```

### 12.3 Related Documentation

For the surrounding CS3 platform architecture referenced throughout this guide — RBAC/RBAM clearance tiers, the Sensor Grid, the Agentic LLM Architecture's dual-agent dispatch pattern, and standard PaaS deployment targets (Docker, Kubernetes, Cloud Run) — see the CS3 Platform: Comprehensive System Literature & Technical Manual, Sections 04, 07, 09, and 10.

Production scale-out documentation in this repository: [`deployment/README.md`](deployment/README.md) (index), [`deployment/operations/README.md`](deployment/operations/README.md) (SOPs), [`deployment/docker/README.md`](deployment/docker/README.md), [`deployment/agents/README.md`](deployment/agents/README.md), [`deployment/terraform/README.md`](deployment/terraform/README.md), and [`deployment/ansible/playbooks/README.md`](deployment/ansible/playbooks/README.md).

### 12.4 Support & Escalation

Route installer or access issues to your CECUR-IT engagement lead through your established contract channel, or to **support@cecur-it.io**; do not file infrastructure credentials or bundle checksums in public issue trackers, even against a private repository's linked project boards.

### 12.5 Testing

`scripts/verify-bundle.mjs` and `scripts/detect-hardware.mjs` each export their pure decision logic (checksum/manifest comparison; VRAM/RAM tier recommendation) for unit testing with Node's built-in test runner — no extra dependencies, consistent with keeping the installer scripts themselves dependency-free:

```bash
node --test scripts/*.test.mjs
```

The console type-check and the deployment artifacts are validated separately (also run by `.github/workflows/deployment-validate.yml`):

```bash
cd demo/demo-100226 && npm install && npx tsc --noEmit        # console
helm lint deployment/helm/cs3 -f deployment/helm/cs3/values-onprem.yaml
kustomize build deployment/kustomize/overlays/onprem >/dev/null
bash deployment/scripts/sync-sql.sh --check                    # Kustomize + Helm SQL copies match the canonical schema
shellcheck deployment/agents/*.sh deployment/scripts/*.sh
(cd deployment/ansible && ansible-playbook --syntax-check -i inventory/example/hosts.yml -e @vars/onprem.yml -e model_bundle=/tmp/x -e cs3_enrollment_file=/tmp/x playbooks/site.yml)
```

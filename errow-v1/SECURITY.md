# Security Policy

CECUR-IT takes the security of errow™ seriously. This document explains how to report
vulnerabilities in errow itself, what you can expect from us, and the security posture of
the platform so that operators and integrators can make informed decisions.

---

## 1. Scope

This policy covers the following components of the errow™ platform:

**In scope**

- The `errow-agent` Python package and CLI (`errow/`, `pyproject.toml`, `uv.lock`)
- The Go Bubble Tea TUI sidecar (`errow/interface/tui/`)
- The local web viewer (`errow/interface/viewer/`, including the prebuilt React frontend)
- The managed cloud CLI client (`errow/interface/cloud/`)
- The sandbox container definitions (`containers/Dockerfile`, `containers/docker-entrypoint.sh`)
- The build, packaging, and installation tooling (`scripts/`, `errow.spec`, `Makefile`)
- The internal offensive agent knowledge packs (`errow/skills/`) and external skills (`skills/`)
- The documentation site (`docs/`)
- The hosted managed platform at `app.errow.ai` and its REST API (see §1.1)

**Out of scope**

- Vulnerabilities in third-party dependencies (report to the upstream project; see §6)
- Vulnerabilities in the Kali Linux base image or Debian packages (report upstream)
- Findings produced by errow against *your* applications — those are assessment results, not
  errow vulnerabilities, and belong in your normal remediation workflow
- Social engineering, physical attacks, or denial-of-service against hosted infrastructure
- Missing security headers or best-practice suggestions with no demonstrated impact
- Reports generated solely by automated scanners without a working proof of concept

### 1.1 Hosted platform

The managed service at `app.errow.ai` is operated by CECUR-IT. Reports against the hosted
platform are welcome and handled under this policy. Please do **not** test against tenant
data, other customers' workspaces, or production accounts you do not own. Use a dedicated
test organization and coordinate timing with us where an attack could affect availability.

---

## 2. Reporting a Vulnerability

**Please do not open a public GitHub issue, pull request, or discussion for security
vulnerabilities.**

Report privately using one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred): use the "Report a vulnerability"
   button under the repository's **Security** tab. This creates a private advisory visible
   only to you and the maintainers.
2. **Email**: security@cecur-it.io — encrypt with our PGP key if the report contains
   exploit code or sensitive data (key fingerprint published at
   https://cecur-it.io/.well-known/security.txt).
3. **security.txt**: https://cecur-it.io/.well-known/security.txt for current contact details
   and policy metadata.

### 2.1 What to include

A good report lets us reproduce and triage quickly. Please include:

- A clear description of the vulnerability and its security impact
- The affected component, version (`errow --version`), and platform/OS
- Step-by-step reproduction instructions, or a minimal proof-of-concept
- Any relevant configuration (LLM provider, sandbox mode, `--workspace-file`, MCP configs)
- Logs, stack traces, or request/response captures — **redact API keys, tokens, and
  customer data** before sending
- Your assessment of severity and, if you have one, a suggested CVSS v3.1 vector
- Whether you intend to publish, and any disclosure timeline you have in mind

If you are unsure whether something is in scope, report it anyway. We would rather triage a
duplicate than miss a real issue.

### 2.2 Do not include

- Live credentials, customer data, or proprietary source code from third parties
- Weaponized exploits beyond what is needed to demonstrate the issue
- Personally identifiable information of third parties

---

## 3. Our Commitment

When you report a vulnerability in good faith under this policy, we commit to:

| Stage | Target |
|---|---|
| Acknowledge receipt | Within 3 business days |
| Initial triage and severity assessment | Within 10 business days |
| Status update cadence | At least every 14 days until resolution |
| Fix or mitigation for Critical/High | Within 30 days where feasible |
| Fix or mitigation for Medium/Low | Within 90 days where feasible |
| Credit in release notes / advisory | On request, at time of disclosure |

Timelines are targets, not guarantees. Complex issues involving the sandbox, the LLM
provider layer, or the hosted platform may take longer; we will tell you if that is the case
and why.

### 3.1 Coordinated disclosure

We follow coordinated disclosure. Our default embargo is **90 days** from acknowledgement,
or sooner if a fix ships. We will:

- Work with you on a disclosure date
- Publish a GitHub Security Advisory (GHSA) with a CVE where warranted
- Credit you by name or handle unless you prefer to remain anonymous
- Notify you before any public statement that references your report

If we have not resolved the issue within 90 days, you may disclose after giving us notice,
provided you do not publish weaponized exploit code or customer data. If the issue is being
actively exploited, we may disclose earlier.

### 3.2 Safe harbor

We will not pursue legal action, or ask law enforcement to investigate, for good-faith
security research conducted under this policy, provided you:

- Act only against systems you own, systems you have explicit permission to test, or the
  hosted platform within the constraints of §1.1
- Do not access, modify, or exfiltrate data belonging to others
- Do not degrade service availability or disrupt other users
- Do not use social engineering against CECUR-IT staff or customers
- Give us reasonable time to remediate before disclosure

This safe harbor applies to research under this policy and does not override applicable law.
If a third party initiates legal action against you for such research, we will make this
policy publicly available to demonstrate your good-faith compliance.

---

## 4. Severity and Triage

We use **CVSS v3.1** as a starting point, adjusted for real-world exploitability and blast
radius. errow's own reporting engine uses the same `cvss` library, and we apply the same
severity-calibration discipline to ourselves that we apply to customers.

| Severity | Examples in errow's context |
|---|---|
| **Critical** | Sandbox escape to host; arbitrary code execution in the Python engine from untrusted LLM output; credential exfiltration from `~/.errow/`; auth bypass on the hosted platform |
| **High** | Prompt-injection leading to unauthorized tool execution against a non-target host; SSRF from the sandbox proxy to cloud metadata; token leakage in logs or SARIF output; cross-tenant access in the viewer or cloud API |
| **Medium** | Local privilege escalation within the container; malicious MCP server causing tool-schema poisoning; source-upload path traversal; CSRF on the viewer beyond the designed token gate |
| **Low** | Information disclosure with limited impact; hardening gaps; issues requiring unrealistic preconditions |

### 4.1 Areas we specifically care about

Because errow is an offensive tool that ingests untrusted input (source code, HTTP traffic,
LLM output, MCP server responses), we are especially interested in reports involving:

- **Sandbox escape and boundary enforcement** — anything that lets a compromised or
  prompt-injected agent reach the host, the Docker socket, or another tenant's workspace
- **Credential handling** — API keys, `errow_API_TOKEN`, ChatGPT OAuth tokens, Caido CA
  material, Stripe Link wallet processes; see §5 for how these are protected
- **Prompt injection and tool-call abuse** — model output that causes privileged tool
  execution, exfiltration, or writes outside the intended scope
- **The metadata read-only remount** — bypasses of `protect_metadata=True` against `.git`,
  `.agents`, `.codex`, or worktree gitdir targets
- **Source-upload packaging** — bypasses of `.gitignore`/`.errowignore`, the exclusion list,
  or the file-count/size limits; signed-URL validation weaknesses
- **Viewer session isolation** — cookie or token weaknesses that break per-port isolation
  or the `SameSite=Strict` guarantee
- **SARIF and report output** — injection into `vulnerabilities.csv` (the `csv_safe`
  neutralization), Markdown fence breakouts (the `safe_fence` widening), or secrets leaking
  into reports and uploads
- **MCP session supervision** — ways to evade quarantine/retirement or to poison the
  dispatch tool schema
- **Turn-guard bypasses** — malformed tool-call JSON, recycled IDs, or stream stalls that
  corrupt session history or cause unsafe replay

---

## 5. Security Design of the Platform

This section documents the controls we rely on, so reporters and operators can evaluate
where the boundaries are.

### 5.1 Execution isolation

- All active reconnaissance and exploit validation run inside a hardened, multi-stage Kali
  container. The runtime runs as a non-root `pentester` user with passwordless sudo limited
  to the operations the tooling requires.
- The container is granted only the capabilities it needs (`cap_net_raw`, `cap_net_admin`,
  `cap_net_bind_service+eip` on nmap). It does **not** receive the Docker socket.
- Host codebases are bind-mounted into `/workspace/<subdir>`. Sensitive metadata directories
  (`.git`, `.agents`, `.codex`, and worktree gitdir targets) are remounted **read-only** so
  agents cannot tamper with repository history or instruction hooks.
- `--workspace-file` archives are staged with `tar --no-same-owner` to avoid ownership
  confusion.
- Container teardown swallows best-effort kill errors only when the socket or container is
  already gone; it does not mask failures that leave a container running.
- The `pentester` UID/GID is remapped at startup to match the host, which prevents
  bind-mount permission conflicts — but note that this means files written by the sandbox
  are owned by your host user. Treat the workspace as writable by the agent by design.

**Known limitation:** The sandbox is a Docker container, not a hardened VM or
microVM. A kernel-level container escape or a Docker daemon compromise is out of the
container's threat model. If you need stronger isolation, run errow inside a dedicated VM
or a hardened container runtime (gVisor, Kata, Firecracker-backed services), and do not
co-locate the Docker daemon with sensitive workloads.

### 5.2 Network and proxy

- Caido runs inside the container on port 48080 with guest access enabled **inside the
  container only**. Do not expose port 48080 to untrusted networks.
- A 10-year ECDSA P-256 Root CA is generated at image build time, trusted in the system
  store and Chromium's NSS database, and used to intercept traffic for analysis. The CA
  private key lives at `/app/certs/ca.key` inside the image. **Anyone with the image or
  container access can mint certificates trusted by that container.** Treat the image as
  sensitive and do not reuse the CA outside the sandbox.
- `HTTP_PROXY`/`HTTPS_PROXY` are exported system-wide with `localhost` and `127.0.0.1`
  excluded. Agents can therefore reach link-local and cloud metadata endpoints unless you
  restrict egress at the network layer. **We recommend blocking `169.254.169.254` and
  equivalent metadata addresses at the host firewall** when running against cloud-hosted
  targets.

### 5.3 Credential handling

- Persistent CLI configuration is written to `~/.errow/cli-config.json` with `0600`
  permissions. Environment variables always take precedence over persisted values, and
  changing `errow_LLM` drops stale stored keys or base URLs.
- Credentials are validated with `check_header_safe_credentials`, which rejects non-ASCII
  smart quotes and zero-width characters that could corrupt HTTP headers.
- ChatGPT subscription credentials are stored in `~/.errow/subscription-auth.json` with
  cross-process token-rotation locks.
- The managed cloud CLI stores tokens in `~/.errow/platform-auth.json` bound to the issuing
  `app_url`, preventing token exfiltration to a different `--app-url`. The
  `X-errow-Workspace` header is pinned per process to prevent cross-org races.
- The Stripe machine-payments bridge injects `errow_API_TOKEN` server-side in an ephemeral
  loopback proxy; the token never enters the Node.js wallet subprocess, which runs in a
  sanitized environment.
- Wire-level request logging deliberately excludes prompt and completion text, capturing
  only metadata (latency, TTFT, sizes, status, provider request IDs, token usage).
- On Windows, the TUI loopback listener is authenticated with a one-time token and cloud
  credentials are stripped from the child environment. On POSIX, the TUI uses an inherited
  file descriptor.

**Operator responsibility:** `~/.errow/` contains credentials. Protect it with filesystem
permissions, avoid syncing it to shared storage, and rotate keys if a machine is lost.

### 5.4 Untrusted input handling

errow treats the following as untrusted: target source code, HTTP traffic captured by the
proxy, LLM output, MCP server responses, uploaded archives, and Markdown/HTML rendered in
the viewer and PDF reports.

Controls include:

- **Turn guards** cap tool calls per assistant turn (default 32), repair malformed tool-call
  IDs, and wrap malformed argument JSON so strict gateways cannot be tricked into unsafe
  replay.
- **Stream watchdogs** abandon and retry stalled SSE connections that keep TCP alive
  without emitting tokens.
- **Tool output bounding** truncates oversized outputs and spills full text to
  `/workspace/.errow-tool-output/`, preventing context-window abuse.
- **MCP supervision** classifies failures, honors `Retry-After`, quarantines flapping
  servers, and permanently retires connections after 401/403 or three quarantine strikes.
- **Report output sanitization** uses `csv_safe` to neutralize `=`, `+`, `-`, `@` formula
  injection, and `safe_fence` to widen Markdown fences so embedded code cannot break out.
- **SARIF uploads** strip weaponized `poc_script_code` bodies.
- **Viewer access** is gated by a per-port `HttpOnly; SameSite=Strict` session cookie minted
  only when visiting the tokened bootstrap URL.
- **PDF generation** is tested against hostile Markdown inputs.

**Prompt injection is inherent to the product.** errow intentionally feeds untrusted text to
LLMs and asks them to act. The sandbox boundary, not the model, is the security control. Do
not run errow with access to credentials or networks beyond what the assessment requires.

### 5.5 Source upload (cloud)

- Deterministic ZIP packaging honors `.gitignore` and `.errowignore`, excludes hidden
  directories, symlinks, build/dependency folders, nested archives (by suffix and magic
  bytes), and common credential paths.
- Limits: 20,000 files, 25 MiB per file, 250 MiB expanded, 50 MiB compressed.
- Two-step digest-bound approval: `--dry-run --show-files --json` followed by
  `--approve-sha256`.
- Signed upload URLs are validated against same-origin or `.supabase.co` storage with
  `allow_redirects=False`.
- Ambiguous launch outcomes retain staged uploads with recovery instructions.

### 5.6 Build and supply chain

- The wheel builder and PyInstaller **fail closed** if the Go TUI sidecar is missing, so no
  release ships without the interactive terminal UI.
- The Go sidecar is built with `CGO_ENABLED=0` and stripped symbols.
- Static analysis and security linting run in CI: ruff (including flake8-bandit and
  bugbear), bandit, mypy, and pyright in strict mode.
- The test suite (51 modules) covers budget lifecycles, cost tracking, context compaction,
  tool-call repair across 18 provider routes, MCP quarantine recovery, threat-model and
  coverage ledgers, SARIF/STRIDE tagging, encrypted PDF generation against hostile inputs,
  viewer cookie isolation, TUI wire-protocol conformance, and cloud upload/payment security.

---

## 6. Third-Party and Dependency Vulnerabilities

errow depends on a large toolchain, including ProjectDiscovery tools, Caido, Semgrep,
Trivy, Gitleaks, TruffleHog, LiteLLM, the OpenAI SDK, and Go and React libraries. If you
find a vulnerability in a dependency:

- Report it to the upstream project first, following their policy.
- If the issue is exploitable *through* errow in a way the upstream project does not cover
  (for example, an unsafe default in how errow invokes the tool, or a missing quarantine
  path), report it to us as well.

Vulnerabilities in the Kali Linux base image or Debian packages should go to Kali or Debian.

---

## 7. What We Ask of Operators

errow is a powerful offensive tool. Running it safely is a shared responsibility.

- **Scope tightly.** Point errow only at assets you own or are authorized to test. Use the
  threat model and coverage ledger to record what was in scope.
- **Isolate the daemon.** Do not run errow against a Docker daemon that also hosts
  production workloads. Prefer a dedicated VM or CI runner.
- **Restrict egress.** Block cloud metadata endpoints and unnecessary outbound ranges at the
  network layer; the in-container proxy will not do this for you.
- **Protect `~/.errow/`.** It holds API keys, subscription tokens, and cloud tokens.
- **Treat the CA as sensitive.** The sandbox CA key can mint certificates trusted inside the
  container. Do not extract or reuse it.
- **Review before you upload.** Use `--dry-run --show-files --json` and inspect the digest
  before approving cloud uploads.
- **Keep the platform updated.** `errow` checks for self-updates; apply them, and pin
  container image digests in CI.
- **Do not expose the viewer or Caido publicly.** Bind them to loopback and use the tokened
  bootstrap URL.
- **Rotate credentials** after any suspected compromise, and review `~/.errow/` logs for
  unexpected provider requests.

---

## 8. Incident Response

If you become aware of an active exploitation of errow or the hosted platform, contact
security@cecur-it.io immediately and mark the message **URGENT — ACTIVE INCIDENT**.
Include what you observed, the affected component, and any indicators of compromise.

For hosted-platform incidents, we will coordinate containment, notify affected customers as
required by applicable law, and publish a post-incident summary where appropriate.

---

## 9. Recognition

We are happy to credit reporters in GitHub Security Advisories and release notes. Let us know
how you would like to be attributed, or ask to remain anonymous. We do not currently operate
a paid bounty program; we may offer swag or other recognition at our discretion.

---

## 10. Policy Changes

We may update this policy as the platform evolves. Material changes will be noted in the
repository changelog and, where relevant, in release notes. The current version is always
the one in this file on the default branch.

---

## 11. Contact

- **Security reports:** security@cecur-it.io (or GitHub Private Vulnerability Reporting)
- **security.txt:** https://cecur-it.io/.well-known/security.txt
- **Licensing and legal:** legal@cecur-it.io
- **General support:** support@cecur-it.io

Thank you for helping keep errow and its users safe.

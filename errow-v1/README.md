# CECUR-IT | PTaaS | errow™

**Autonomous penetration testing with coordinated AI agents.**

errow is a penetration-testing-as-a-service (PTaaS) platform built on the open-source
`errow-agent` v1.7.0 codebase. Instead of stopping at static
pattern matches, errow coordinates offensive-security agents in an isolated, instrumented
runtime. Agents analyze source code, interact with running applications, and validate
reported vulnerabilities with working proof-of-concept (PoC) exploits.

The same reasoning engine and artifact formats power two ways to run assessments:

- **Self-hosted CLI:** run scans in local Docker sandboxes, using your own LLM provider
  credentials or ChatGPT Plus/Pro subscription authentication.
- **errow Cloud:** run assessments on managed infrastructure through app.errow.ai, with
  team dashboards, pull-request gates, and enterprise compliance reporting.

## At a glance

- Multi-agent reconnaissance, source analysis, and exploit validation.
- Isolated Kali Linux sandbox with an HTTP interception proxy and curated security tools.
- Model routing across OpenAI-compatible APIs, more than 100 LiteLLM providers, and
  ChatGPT subscription authentication.
- Evidence-backed vulnerability and dependency reports, coverage tracking, SARIF, and
  encrypted PDF exports.
- CLI, interactive terminal UI, local web viewer, and managed cloud workflows.

## Running errow

The self-hosted CLI runs assessments in Docker and needs a configured model provider or
ChatGPT subscription authentication. The release installer detects the operating system
and architecture, configures common shell PATH profiles, and pre-pulls the sandbox
image. The sandbox can also be built locally with `scripts/docker.sh`. Provider setup,
CLI options, and scan modes are covered by the documentation site.

## Architecture

### Configuration, models, and context

Configuration lives in `errow/config/`. Pydantic settings combine environment variables
with persistent JSON overrides in `~/.errow/cli-config.json` (mode `0600`); environment
values take precedence. Settings cover LLM routing, deduplication, context budgets,
runtime, integrations, and telemetry. The dedupe model can use separate credentials,
base URLs, headers, and request-body fields. Changing the configured LLM clears stale
stored credentials and endpoints. The nested groups are `LLMSettings`,
`DedupeSettings`, `ContextSettings`, `RuntimeSettings`, `IntegrationSettings`, and
`TelemetrySettings`; integrations include Exa, Perplexity, and Postman API keys.

The model layer uses the native OpenAI SDK for `openai/...` models and LiteLLM for
providers such as OpenRouter, Anthropic, Vertex AI, Bedrock, Ollama, Z.AI, and DeepSeek.
`errow_API_TYPE` can override the OpenAI API selection. Every resolved model receives a
turn guard with configurable first-event, idle, and total stream timeouts that:

- Watches streaming first-event, idle, and total timeouts so stalled requests can be
  abandoned and retried.
- Caps tool calls per assistant turn (32 by default).
- Repairs blank, missing, or reused tool-call IDs and keeps paired tool outputs aligned.
- Wraps malformed, truncated, deeply nested, or non-finite JSON tool arguments before
  saving history, avoiding replay failures with strict OpenAI-compatible gateways.

`LLM_DISABLE_STREAMING=true` selects single-request, non-streaming calls. OpenRouter
streaming cost and upstream-provider usage are tracked, and
`errow_OPENROUTER_STICKY_SESSIONS` can enable deterministic per-agent session IDs for
prompt-cache affinity. ChatGPT Plus/Pro authentication uses OAuth 2.0 PKCE and
cross-process token-rotation locks; the Codex backend's streaming requirements and
non-retryable cybersecurity-content blocks are handled explicitly. Subscription
credentials are stored in `~/.errow/subscription-auth.json`.

Context management in `errow/llm/` obtains model limits from LiteLLM, strips the
`chatgpt/` prefix when looking up limits, and falls back to UTF-8 byte length for token
estimates. It compacts older turns into checkpoint summaries before context limits are
exceeded, including untyped OpenRouter overflow errors, without splitting parallel
function-call/output pairs. Structured request diagnostics capture latency,
time-to-first-token, sizes, status, request IDs, token usage, and upstream provider
names—not prompt or completion text. Heavy imports are warmed in a background thread
and synchronized before use.

### Agents and runtime

`errow/core/` and `errow/agents/` build sandbox agents with filesystem and shell
capabilities, bounded tool output, and argument coercion for nullish strings and
JSON-encoded values. Truncated JSON arguments prompt a reissue; image viewing is
disabled for text-only models. System prompts combine up to five requested skills with
baseline analysis and severity-calibration guidance, white-box and diff-scope overlays,
and cache markers for Anthropic and Bedrock.

The coordinator manages a directed agent graph, mailboxes, wait states, recovery,
budgets, and persisted state in `.state/agents.json`. History uses short-lived SQLite
file handles so parked agents do not exhaust descriptors. Usage hooks track tokens and
per-agent turns, warn at 70%, 85%, and 95% of configured limits, and enforce stop or
pause policies. In headless stop mode, subagents stop at 90% of the budget so the root
agent can report findings within the remaining reserve. Recovery handles transient API
and network failures, multimodal rejection, interrupted stream persistence, agents
that stop without invoking a tool, and parent/child wait-state transitions.

The Docker runtime resolves the daemon from `DOCKER_HOST` or the active Docker context,
including Docker Desktop, OrbStack, and Colima sockets and TLS configuration. It can
reuse containers, mount a codebase under `/workspace`, stage workspace-file archives,
and bring up the proxy concurrently. Sensitive repository metadata—including `.git`,
agent instruction directories, and worktree gitdir targets—is remounted read-only.
Deferred sessions initialize the agent runtime while container startup continues in the
background.

### Sandboxed security tooling

Reconnaissance, source analysis, and exploit validation run inside the multi-stage Kali
Linux image in `containers/Dockerfile`, initialized by
`containers/docker-entrypoint.sh`. A Go builder stage compiles static ProjectDiscovery
and security utilities without carrying its build cache into the runtime image. The
runtime uses a non-root `pentester` account, remaps its UID/GID to match host-mounted
files, and grants narrowly scoped raw-socket capabilities to the required tools.

The image includes Nmap, ncat, ndiff, SQLMap, Nuclei, httpx, Katana, vulnx/cvemap,
gospider, interactsh-client, govulncheck, subfinder, naabu, ffuf, Wapiti, and Arjun,
dirsearch, and wafw00f isolated with pipx. Static, AST, and secret analysis includes
Semgrep, Bandit, Trivy, Gitleaks, TruffleHog, Retire, ESLint, JSHint, js-beautify,
ast-grep, and tree-sitter with Java, JavaScript, Python, Go, Bash, JSON, YAML, and
TypeScript/TSX grammars. Chromium and agent-browser support headless testing; additional
scripts include JS-Snooper, jsniper.sh, and jwt_tool. Caido's guest API and a dedicated
Python environment support safe proxy inspection and replay. At startup the entrypoint
launches Caido, waits for its GraphQL endpoint, configures HTTP(S) proxy variables while excluding
localhost, and trusts the test Root CA in the system and Chromium certificate stores.
Browser screenshots are stored under
`/workspace/.agent-browser-screenshots`; idle browser daemons are reclaimed after
180 seconds.

### Tools, findings, and coverage

Tools in `errow/tools/` share output truncation and storage: oversized results are
bounded for the model while the full output is saved under
`/workspace/.errow-tool-output/`. Agent tools include shell and filesystem operations,
HTTP proxy and sitemap inspection, and multi-agent creation, messaging, waiting, and
shutdown. The proxy interface supports listing requests with HTTPQL, viewing and
replaying requests, listing the sitemap, viewing sitemap entries, and inspecting scope
rules. Replays recompute `Content-Length` and remove `Transfer-Encoding` when a body
changes. Agent coordination includes `create_agent`, `send_message_to_agent`,
`wait_for_agents`, `stop_agent`, and `agent_finish`; duplicate waits queued in one model
turn are collapsed, and child completion lists its report IDs. Proxy operations are
serialized for concurrency-safe Caido GraphQL access.

Run-scoped tools maintain a shared threat model and a coverage ledger. Threat-model
sections cover overview, trust boundaries and assumptions, attack surface and attacker
stories, and severity calibration. Paths and URLs are normalized to identify the same
target across local checkouts and remote URLs; agents can append attributed amendments.
Coverage entries track `reported`, `no_issue_found`, `ruled_out`, `not_applicable`, or
`needs_follow_up`, retaining outcome history and requiring evidence for claimed closure.
`finish_scan` surfaces unrecorded coverage and does not complete while child agents are
still running.

Vulnerability reports require a working PoC, evidence, assumptions, counterevidence,
confidence, severity-change conditions, and fix effort. Lower-confidence findings need
a rationale. An eight-metric CVSS 3 breakdown is computed deterministically; zero CIA
impact is informational. Caido exchange IDs are verified against the active project,
and code changes require fix verification. Findings are deduplicated before they are
committed. Dependency reports require a verified `CVE-*` ID, package name, installed
version, ecosystem, repository-relative manifest path, advisory CVSS, reachability and
evidence, plus contextual CVSS reasoning grounded in a source-to-sink trace.

Reports can be updated, deleted with transactional disk rollback, listed, and retrieved.
`errow/report/` atomically writes run metadata, Markdown findings, JSON, and CSV. Markdown
fences widen to safely contain embedded code; CSV values are neutralized against
spreadsheet formula injection. SARIF 2.1.0 output includes CWE rules, STRIDE tags,
deterministic fingerprints for alert stickiness, code fixes, and Git provenance.
Coverage results can emit non-failing pass, open, and not-applicable results. External
SARIF uploads omit PoC script bodies. Coverage artifacts distinguish agent-reported
ledger entries from machine-observed runtime facts, call out unrecorded risks and silent
subagents, and remain incomplete if the budget is exhausted or agents are unfinished.
Finding Markdown, JSON, CSV, and SARIF artifacts are accompanied by `coverage.json`;
finding details include dynamic Markdown fences to contain hostile embedded content.

Token and pricing ledgers track input, cached, and output usage, reconcile provider
streaming costs with LiteLLM estimates, account for OpenRouter upstream costs, and
measure per-agent prompt-cache misses.

### MCP and web research

Model Context Protocol servers can be configured in `~/.errow/mcp-servers.json` or
provided with `--mcp-config`. Local stdio and remote HTTP connections are supervised
without adding each server's tool schema to every model request. Agents discover and
invoke tools through generic dispatch operations. Supervised sessions classify
authentication, permission, rate-limit, server, timeout, transport, and protocol
failures; honor `Retry-After`; quarantine flapping servers for 30 seconds; and retire
connections after authentication failures or repeated quarantine strikes.

Web research prefers Exa when `EXA_API_KEY` is set and otherwise falls back to
Perplexity. Workflow tools also support skills, notes, todos, agent reasoning, and
interactive user input.

## Interfaces and distribution

### CLI and terminal UI

The `errow` command validates model credentials, performs a bounded preflight, supports
interactive session resumption, and dispatches to headless or interactive execution.
Headless runs exit with status 0 for a clean result, 1 for an error, and 2 when findings
match `--fail-on`.

The Go Bubble Tea terminal UI is a sidecar connected to Python over a length-prefixed
Protocol v3 socket. POSIX uses an inherited file descriptor; Windows uses a loopback
listener with a one-time token and a child environment stripped of cloud credentials.
The UI renders setup, agent status and transcripts, image previews, findings, and slash
commands. Python streams collection bootstraps and incremental state updates, sanitizing
ANSI and OSC sequences.

### Local web viewer and cloud CLI

`errow view` serves the prebuilt React viewer locally. A tokened bootstrap URL mints a
per-port `HttpOnly`, `SameSite=Strict` session cookie. The viewer shows the live agent
graph, transcripts, and findings; supports agent steering; verifies email before
unlocking historical runs; and generates AES-encrypted PDF reports.

`errow cloud <resource> <verb>` exposes the REST operations defined by the cloud
specification, including scans, findings, repositories, schedules, pull-request reviews,
domains, billing, chat, knowledge, organizations, integrations, connectors, webhooks,
analytics, audit, tokens, supply chain, uploads, and workspaces. Device login
stores tokens bound to their issuing app URL. Workspace headers are pinned per process,
and scope presets offer recommended, minimal, and full access.

Cloud source uploads are deterministic ZIP archives that honor `.gitignore` and
`.errowignore` while excluding hidden directories, symlinks, build artifacts, nested
archives, and common credential paths. Limits are enforced for file count, individual
file size (20,000 files, 25 MiB per file, 250 MiB expanded, and 50 MiB compressed). A
dry-run digest and explicit
`--approve-sha256` approval bind approval to the exact file set. Signed upload URLs are
validated against the allowed origin or Supabase storage, redirects are disabled, and
staged files remain available with recovery instructions if scan launch status is
ambiguous.

The Stripe machine-payments bridge handles HTTP 402 top-up challenges through an
ephemeral loopback proxy. It injects the API token server-side while invoking the
wallet CLI in a sanitized subprocess environment, keeping the token out of the Node.js
wallet process.

### Build and package

The development environment uses Python 3.12+, Go 1.24+, `uv`, and Hatchling. The
`pyproject.toml` package is `errow-agent` v1.7.0 and exposes
`errow.interface.main:main` as the `errow` command. Runtime dependencies include
`openai-agents[litellm]` (>=0.19.0,<0.20), `openai` (>=2.45.0,<3), `litellm`
(>=1.101.0), `google-auth`, `boto3`, Docker (>=7.1.0), `caido-sdk-client` (>=0.2.0),
`cvss` (>=3.2), Pydantic and pydantic-settings, plus reportlab, pypdf, and cryptography
(>=48.0.1,<49). The cryptography cap supports macOS universal2 wheel compatibility.

`make check-all` runs Ruff, strict mypy and Pyright checks, and Bandit. Make targets
also build, test, and lint the Go TUI, rebuild the web viewer, and package wheels.
Pre-commit hooks enforce the repository's code-quality checks.

Release builds use `scripts/build.sh`, `scripts/tui_sidecar_hook.py`, and `errow.spec`.
The Go sidecar is compiled with CGO disabled and stripped symbols; wheel and PyInstaller
builds fail if the binary is missing. PyInstaller bundles the Python entrypoint, TUI,
skills, prompt templates, viewer assets, and required dynamic submodules while excluding
development and sandbox-only packages. `scripts/install.sh` supports OS and architecture
detection, including macOS Rosetta, shell PATH setup for zsh, bash, fish, and CI, and
removal of conflicting legacy installations.

## Skills and documentation

External coding-agent skills in `skills/` can be installed into Claude Code, Cursor,
Codex, and Gemini CLI with `npx skills add useerrow/errow`. The nine packages are
`penetration-testing-with-errow`, `managed-pentesting-with-errow`,
`fix-security-vulnerabilities-with-errow`, `ci-security-scanning-with-errow`,
`application-security-testing`, `web-app-penetration-testing`,
`api-security-testing`, `owasp-top-10-testing` (OWASP Top 10:2025), and
`find-security-vulnerabilities-in-code`.

Internal agent skills in `errow/skills/` load into system prompts or on demand. They cover vulnerability classes, frameworks, protocols, clouds, reconnaissance and
analysis workflows, and tools. Vulnerability playbooks include argument injection,
JWT authentication, authorization, browser security, business logic, CSRF, header
injection, request smuggling, IDOR, information disclosure, deserialization, file
uploads, prompt injection, mass assignment, NoSQL and SQL injection, open redirects,
path traversal, prototype pollution, race conditions, RCE, semantic confusion, SSRF,
SSTI, subdomain takeover, weak passwords, XSS, and XXE. Technology and cloud playbooks
include Django, FastAPI, NestJS, Next.js, Active Directory, Auth0, Electron, Firebase,
Grafana/Prometheus, LLM applications, Supabase, GraphQL, OAuth, AWS, Azure, and
Kubernetes. Tooling and workflow skills cover browser automation, ffuf, httpx, Hurl,
hypothesis testing, Katana, naabu, Nmap, Nuclei, Python/Caido, Semgrep, SQLMap,
subfinder, asset discovery, infrastructure lifecycle, API specs, dependency CVEs, npm
confusion, source-aware SAST and discovery, counterevidence, severity calibration, and
fix verification.

The Mintlify documentation site under `docs/` includes quickstarts, CLI and scan-mode
guides, provider setup, local viewer usage, CI/CD integrations, MCP configuration, and
errow Cloud documentation.

## Benchmarks and verification

The documented XBOW (XBEN) web security benchmark result is 100 of 104 challenges
(96%): 100% Easy, 96% Medium, and 75% Hard. Black-box runs averaged about 19 minutes
per challenge.

The test suite comprises 51 pytest and pytest-asyncio modules. Coverage includes agent
budget lifecycles, model routing and streaming repair, cost tracking, context
compaction, MCP supervision, threat models and coverage ledgers, SARIF, encrypted PDF
reports, viewer session isolation, Python/Go TUI protocol conformance, cloud source
uploads, and the payments bridge.

## License

See LICENSE.md

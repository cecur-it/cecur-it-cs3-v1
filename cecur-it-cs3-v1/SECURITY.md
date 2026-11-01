# Security Policy

## Reporting a Vulnerability

`cecur-it-cs3` is a private installation repository with install scripts that
run with local system privileges (creating service accounts, writing
systemd/launchd units, modifying Windows local accounts and environment
variables). Treat any issue in `scripts/`, `install.*`, or `cs3-launcher.mjs`
as security-sensitive.

- Do **not** open a public issue for a suspected vulnerability.
- Report it privately to your CECUR-IT engagement lead through your
  established contract channel, to **contact@cecur-it.io**, or via GitHub's
  private vulnerability reporting feature on this repository (Security tab →
  "Report a vulnerability") if enabled for your org.
- Include: affected file(s)/profile (cloud | onprem | airgap), reproduction
  steps, the platform (Linux/macOS/Windows) and version, and the potential
  impact (privilege escalation, secret exposure, supply-chain, etc.).
- **Never** file credentials, API keys, populated `.env` contents, bundle
  checksums, or bundle manifests in any public tracker or project board —
  even one linked from this private repository. Route that material only
  through the engagement lead or `contact@cecur-it.io`, using an encrypted
  channel where available.

We aim to acknowledge reports within 3 business days and to provide a
remediation timeline within 10 business days, prioritized by severity.

## Supported Versions

Only the latest tagged release of `cecur-it-cs3` is supported. Security fixes
are backported to a prior release only when a customer's ATO/change-control
window requires it — coordinate with your engagement lead.

## Security Controls Already Built Into This Repository

These are enforced by the tooling itself, not just documented practice:

- **Fail-closed profile isolation** — `cs3-launcher.mjs` refuses to start if
  the selected profile's `.env` contains forbidden keys from another profile
  (e.g. cloud API keys inside an airgap/onprem `.env`), or is missing a
  required value for the selected profile.
- **Mandatory bundle verification** — the `airgap` profile always runs
  `scripts/verify-bundle.mjs` before any other action and refuses to proceed
  on a checksum or release-tag mismatch.
- **No secrets in source** — `.env` is generated locally by
  `onboarding/wizard.mjs`, written with `0600` permissions, and excluded via
  `.gitignore`. Never commit a populated `.env`.
- **Least privilege by default** — `scripts/install-ollama.sh` and
  `install.ps1` create a dedicated, unprivileged service account
  (`cs3-ollama`) rather than running inference as root/Administrator, and
  bind the Ollama endpoint to loopback only.
- **Pinned versions** — Ollama and llama.cpp versions are pinned constants in
  their respective install scripts (`OLLAMA_PINNED_VERSION`,
  `LLAMA_CPP_PINNED_TAG`), reviewed and updated deliberately rather than
  tracking `latest`.
- **Signed, checksummed releases** — `.github/workflows/release.yml`
  publishes `SHA256SUMS` and an SBOM with every tagged release.

## Repository Access Model

- `cecur-it-cs3` is private. Access is restricted to CECUR-IT platform
  engineering, security review, and the specific customer engagement team
  provisioned for a given deployment.
- Changes to `scripts/`, `onboarding/wizard.config.json`, and
  `.github/workflows/` are routed to platform security review via
  `.github/CODEOWNERS` and require their approval before merge.
- Branch protection (configured on the hosting platform, not in this
  repository — see `README.md` § "Branch Protection Expectations") requires
  two reviewers for changes to install scripts or onboarding, passing lint /
  SCA / secret-scanning status checks, and disallows force pushes or direct
  commits to `main` or release branches.
- All commits and pull requests are scanned for secrets before merge; a
  detected secret blocks merge and must be rotated, not just removed from the
  diff (git history retains it otherwise).

## Software Bill of Materials

Every tagged release published by `.github/workflows/release.yml` includes a
CycloneDX SBOM alongside the `SHA256SUMS` manifest and, where feasible, a
Sigstore/cosign signature, so a customer can run their own vulnerability
review before installing anything from the bundle.

## Compliance Claims

This repository documents the engineering controls that support a customer's
authorization package (access control, audit logging, bundle/checksum
verification, unprivileged service accounts, and so on). It does not restate
CECUR-IT's public marketing claims (e.g. first-pass 3PAO/C3PAO rates, SPRS
scores) as engineering facts, and it does not attest to or substitute for a
customer's own formal authorization (ATO) decision, CMMC 2.0 Level 2
assessment, or SPRS submission — those are established solely by the
customer's own assessment process.

## Reporting a Vulnerability in a Dependency

Run `npm audit` (if a `package.json`/lockfile is present in your checked-out
release) or review the SBOM published with the release, and report findings
the same way as above.

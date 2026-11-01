# Welcome to the CS3 Platform Installer

CS3 Platform is produced and maintained by **CECUR-IT** and is engineered
against NIST SP 800-53 Rev. 5 (High), NIST SP 800-171 Rev. 3, FedRAMP High,
and DoD IL5/6 control baselines.

You are about to configure a CS3 Platform deployment using the private
`cecur-it-cs3` installation repository. This wizard enforces the security
controls described in the CS3 Installation Guide (see the repository
`README.md`) by construction — it will only ever ask for the credentials and
settings that are valid for the deployment profile you selected.

## New to CS3? Look, listen, or try it before you install it

- **See the console first, no install required:** the hosted demonstration
  console at <https://demo.cecur-it.io/> lets an evaluator walk through the
  CS3 ESOC Console UI before committing to a deployment.
- **Listen before you install:** <https://audio.cecur-it.io/> is a narrated
  platform overview an operator can listen to end-to-end before running this
  wizard — useful for a first pass through the concepts below.
- **Company site:** <https://cecur-it.io/>

## Deployment profiles

- **cloud** — CS3 Cloud (PaaS). The CS3 ESOC Console and Agentic LLM Router
  call CS3-hosted models (CS3 AI Flash / CS3 AI Chat). Requires
  `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, and your CS3 tenant identifiers.
- **onprem** — Connected on-prem. All inference runs locally against Ollama;
  no hosted model keys are collected or stored.
- **airgap** — Fully disconnected. Requires a bundle that has already been
  verified by `scripts/verify-bundle.mjs`; no registry pulls or telemetry are
  permitted at any point.

## Before you continue

- Do not run this wizard with a bundle or credential set intended for a
  different profile — each profile's `.env` is generated from a distinct
  template and the wizard actively blanks out fields that do not apply.
- The `.env` file produced by this wizard is written to the repository root
  and is excluded from version control by `.gitignore`. Never commit a
  populated `.env`.
- For `airgap`, make sure the verified bundle path is available locally
  before starting; the wizard will not proceed without it.

> This installer describes engineering practice. It does not attest to, or
> substitute for, your organization's formal authorization (ATO) decision.

Press Enter to continue, or Ctrl+C to abort at any time.

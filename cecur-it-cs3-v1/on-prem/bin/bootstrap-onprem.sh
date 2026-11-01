#!/usr/bin/env bash
# on-prem/bin/bootstrap-onprem.sh
#
# Thin orchestration wrapper around the existing installer/deployment entry points for the
# "onprem" profile. This script does not implement installation logic itself -- it sequences
# calls into tooling that already exists elsewhere in the repository:
#
#   1. onboarding/wizard.mjs --profile onprem   (populate .env, reject forbidden keys)
#   2. scripts/install-ollama.sh                (local model runtime, Path B)
#   3. deployment/docker OR deployment/ansible  (stack provisioning, selected via --vehicle)
#   4. on-prem/bin/preflight-check.sh           (fail-closed final gate)
#
# Usage:
#   bootstrap-onprem.sh --vehicle docker [--non-interactive]
#   bootstrap-onprem.sh --vehicle ansible --inventory <path> [--non-interactive]
#   bootstrap-onprem.sh --skip-wizard --skip-ollama   # re-run just provisioning + preflight
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VEHICLE=""
INVENTORY=""
NON_INTERACTIVE="false"
SKIP_WIZARD="false"
SKIP_OLLAMA="false"

usage() {
  cat <<'EOF'
Usage: bootstrap-onprem.sh --vehicle <docker|ansible> [options]

Options:
  --vehicle docker|ansible   Provisioning path (required unless both --skip-wizard
                             and --skip-ollama are given, in which case only
                             preflight-check.sh is run).
  --inventory PATH           Ansible inventory file (required when --vehicle ansible).
  --non-interactive          Pass through to onboarding/wizard.mjs.
  --skip-wizard              Skip onboarding/wizard.mjs (assume .env already populated).
  --skip-ollama              Skip scripts/install-ollama.sh (e.g. hardware already prepared).
  -h, --help                 Show this help text.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --vehicle) VEHICLE="$2"; shift 2 ;;
    --inventory) INVENTORY="$2"; shift 2 ;;
    --non-interactive) NON_INTERACTIVE="true"; shift ;;
    --skip-wizard) SKIP_WIZARD="true"; shift ;;
    --skip-ollama) SKIP_OLLAMA="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$VEHICLE" ] && { [ "$SKIP_WIZARD" != "true" ] || [ "$SKIP_OLLAMA" != "true" ]; }; then
  echo "error: --vehicle <docker|ansible> is required" >&2
  usage
  exit 1
fi

if [ "$VEHICLE" = "ansible" ] && [ -z "$INVENTORY" ]; then
  echo "error: --vehicle ansible requires --inventory <path>" >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "== Step 1/4: onboarding wizard (profile: onprem) =="
if [ "$SKIP_WIZARD" = "true" ]; then
  echo "skipped (--skip-wizard)"
else
  WIZARD_ARGS=(onboarding/wizard.mjs --profile onprem)
  [ "$NON_INTERACTIVE" = "true" ] && WIZARD_ARGS+=(--non-interactive)
  node "${WIZARD_ARGS[@]}"
fi

echo "== Step 2/4: local Ollama runtime (Path B) =="
if [ "$SKIP_OLLAMA" = "true" ]; then
  echo "skipped (--skip-ollama)"
else
  scripts/install-ollama.sh
fi

echo "== Step 3/4: stack provisioning (vehicle: ${VEHICLE:-none}) =="
case "$VEHICLE" in
  docker)
    (
      cd deployment/docker
      docker compose --profile siem up -d
    )
    ;;
  ansible)
    ansible-playbook -i "$INVENTORY" deployment/ansible/playbooks/site.yml \
      -e @deployment/ansible/vars/onprem.yml
    ;;
  "")
    echo "skipped (no --vehicle given; --skip-wizard and --skip-ollama were both set)"
    ;;
  *)
    echo "error: unknown --vehicle '${VEHICLE}' (expected docker or ansible)" >&2
    exit 1
    ;;
esac

echo "== Step 4/4: preflight check =="
set -a
# shellcheck disable=SC1091 # these files are generated at deploy time, not present at lint time
[ -f "$REPO_ROOT/.env" ] && source "$REPO_ROOT/.env"
# shellcheck disable=SC1091
[ -f "$REPO_ROOT/deployment/docker/.env" ] && source "$REPO_ROOT/deployment/docker/.env"
set +a
"$REPO_ROOT/on-prem/bin/preflight-check.sh"

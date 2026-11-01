#!/usr/bin/env bash
# on-prem/bin/enroll-real-endpoints.sh
#
# Thin wrapper around deployment/agents/cs3-enroll.mjs with on-prem-appropriate defaults.
# Refuses to run against a hosts file that looks like a placeholder/sample (to stop an
# operator from accidentally "enrolling" fictitious endpoints and believing the fleet is real).
#
# Usage:
#   enroll-real-endpoints.sh --url https://cs3.example.internal --file hosts.csv [--group prod] [--dry-run]
#   enroll-real-endpoints.sh ... --force   # bypass the placeholder-file heuristic
#
# Authentication is taken from the environment exactly as cs3-enroll.mjs expects
# (CS3_TOKEN, or CS3_USERNAME + CS3_PASSWORD) -- never pass secrets on the command line.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PASSTHROUGH_ARGS=()
FILE=""
FORCE="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; PASSTHROUGH_ARGS+=(--file "$2"); shift 2 ;;
    --force) FORCE="true"; shift ;;
    *) PASSTHROUGH_ARGS+=("$1"); shift ;;
  esac
done

if [ -z "$FILE" ]; then
  echo "error: --file <hosts.csv|hosts.json> is required" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "error: hosts file not found: $FILE" >&2
  exit 1
fi

# Heuristic placeholder/sample detection: these tokens show up in example data, never in a
# real fleet inventory. This is advisory, not a security control -- it exists purely to catch
# the "demo hosts.csv copy-pasted into prod" mistake before tokens are minted and wasted.
PLACEHOLDER_PATTERN='example\.(com|internal|org)|sample[-_]?host|test[-_]?host|host[0-9]\.local|placeholder|changeme|REPLACE_ME|TODO'
if grep -Eiq "$PLACEHOLDER_PATTERN" "$FILE"; then
  MATCHES="$(grep -Eio "$PLACEHOLDER_PATTERN" "$FILE" | sort -u | paste -sd, -)"
  if [ "$FORCE" != "true" ]; then
    echo "error: '$FILE' looks like a placeholder/sample hosts file (matched: ${MATCHES})." >&2
    echo "       Replace it with your real endpoint inventory, or re-run with --force to override." >&2
    exit 1
  fi
  echo "warning: '$FILE' matched placeholder patterns (${MATCHES}) but --force was given; proceeding." >&2
fi

echo "Enrolling real endpoints from: $FILE"
node "$REPO_ROOT/deployment/agents/cs3-enroll.mjs" bulk "${PASSTHROUGH_ARGS[@]}"

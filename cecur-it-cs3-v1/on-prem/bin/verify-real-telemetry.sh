#!/usr/bin/env bash
# on-prem/bin/verify-real-telemetry.sh
#
# Smoke test that proves telemetry ingested from a real endpoint is (a) visible through the
# console's hot-cache API immediately, and (b) durably indexed in OpenSearch when
# CS3_INDEXER_ENABLED=true -- i.e. it survives a console process restart, unlike the demo's
# simulateTick() loop or the bare in-memory db.cecurLogs ring buffer.
#
# IMPORTANT: GET /api/cecur/logs (demo/demo-100226/server/routes/cecur.ts) only ever reads the
# in-memory hot cache (db.cecurLogs), by design, for low-latency "recent events" views -- it does
# NOT read back from OpenSearch. So after a console restart, the hot cache is empty again even
# though the durably indexed copy in OpenSearch is untouched. This script therefore verifies
# durability by querying OpenSearch directly, not by re-polling the console API after restart.
#
# Usage:
#   verify-real-telemetry.sh --url https://cs3.example.internal --ingest-key <key> [--agent-id <id>]
#
# Requires: curl. CECUR_INDEXER_URL/CECUR_INDEXER_USERNAME/CECUR_INDEXER_PASSWORD from the
# environment are used for the durability check (same variables the console itself uses).
set -euo pipefail

URL=""
INGEST_KEY=""
AGENT_ID="on-prem-verify-agent"
BEARER_TOKEN="${CS3_TOKEN:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --ingest-key) INGEST_KEY="$2"; shift 2 ;;
    --agent-id) AGENT_ID="$2"; shift 2 ;;
    --token) BEARER_TOKEN="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: verify-real-telemetry.sh --url <console-url> --ingest-key <key> [--agent-id <id>] [--token <bearer>]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$URL" ] || [ -z "$INGEST_KEY" ]; then
  echo "error: --url and --ingest-key are required" >&2
  exit 1
fi

MARKER="onprem-verify-$(date +%s)-$$"
echo "== Step 1: ingest a uniquely marked real event =="
INGEST_RESPONSE="$(curl -fsS -m 10 -X POST "${URL%/}/api/cecur/logs/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${INGEST_KEY}" \
  -d "{\"agentId\":\"${AGENT_ID}\",\"agentName\":\"${AGENT_ID}\",\"source\":\"syslog\",\"severity\":\"info\",\"message\":\"${MARKER}\"}")"
echo "  response: ${INGEST_RESPONSE}"
if ! echo "$INGEST_RESPONSE" | grep -q '"success":true'; then
  echo "error: ingest did not report success" >&2
  exit 1
fi
DURABLE_INDEXING_REPORTED="$(echo "$INGEST_RESPONSE" | grep -o '"indexed":[a-z]*' | cut -d: -f2)"

echo "== Step 2: confirm it is visible via GET /api/cecur/logs (hot cache) =="
if [ -z "$BEARER_TOKEN" ]; then
  echo "  [SKIP] no --token/CS3_TOKEN provided; cannot call the authenticated logs API."
else
  LOGS_RESPONSE="$(curl -fsS -m 10 "${URL%/}/api/cecur/logs?search=${MARKER}&limit=5" \
    -H "Authorization: Bearer ${BEARER_TOKEN}")"
  if echo "$LOGS_RESPONSE" | grep -q "$MARKER"; then
    echo "  [PASS] marker found in hot cache"
  else
    echo "  [FAIL] marker NOT found in hot cache" >&2
    exit 1
  fi
fi

echo "== Step 3: confirm durable indexing (OpenSearch), independent of console process state =="
if [ "$DURABLE_INDEXING_REPORTED" != "true" ]; then
  echo "  [INFO] console reported indexed=false (CS3_INDEXER_ENABLED is not 'true' on this console)."
  echo "         This event lives ONLY in the 300-row in-memory hot cache and will be lost on restart."
  echo "         Set CS3_INDEXER_ENABLED=true to close this gap before accepting production fleet traffic."
  exit 0
fi

if [ -z "${CECUR_INDEXER_URL:-}" ]; then
  echo "  [SKIP] CECUR_INDEXER_URL not set in this shell; cannot query OpenSearch directly to confirm durability." >&2
  exit 1
fi

AUTH_ARGS=()
[ -n "${CECUR_INDEXER_USERNAME:-}" ] && AUTH_ARGS=(-u "${CECUR_INDEXER_USERNAME}:${CECUR_INDEXER_PASSWORD:-}")
INSECURE_ARGS=()
[ "${CECUR_INDEXER_TLS_INSECURE:-false}" = "true" ] && INSECURE_ARGS=(-k)

# Give the fire-and-forget bulk indexer a moment to complete before querying.
sleep 2
SEARCH_RESPONSE="$(curl -fsS -m 10 "${AUTH_ARGS[@]}" "${INSECURE_ARGS[@]}" \
  -X POST "${CECUR_INDEXER_URL%/}/cs3-logs/_search" \
  -H "Content-Type: application/json" \
  -d "{\"query\":{\"match_phrase\":{\"message\":\"${MARKER}\"}}}")"
if echo "$SEARCH_RESPONSE" | grep -q "$MARKER"; then
  echo "  [PASS] marker found durably indexed in OpenSearch (cs3-logs alias)."
  echo "         This event will survive a console restart -- real, durable, non-mock telemetry confirmed."
  exit 0
else
  echo "  [FAIL] marker NOT found in OpenSearch within the wait window. Response:" >&2
  echo "$SEARCH_RESPONSE" >&2
  exit 1
fi

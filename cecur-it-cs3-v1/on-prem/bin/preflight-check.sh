#!/usr/bin/env bash
# on-prem/bin/preflight-check.sh
#
# Fail-closed go/no-go gate for on-prem CS3 installs. Exits non-zero (and prints
# remediation text) the moment any invariant required for a real, on-prem, non-mock
# deployment is violated. Intended to be run:
#   - manually before go-live (see ../checklists/go-live-checklist.md)
#   - at the end of bootstrap-onprem.sh
#   - in CI/ops automation as a final gate
#
# Checks performed:
#   1. CS3_DEMO_MODE must be unset or "false"           (server/profile.ts#isDemoMode)
#   2. CS3_PROFILE must be "onprem" or "airgap"          (server/profile.ts#getDeploymentProfile)
#   3. CS3_INGEST_REQUIRE_KEY must be "true"             (server/fleet/enrollment.ts requireIngestKey)
#   4. GEMINI_API_KEY / DEEPSEEK_API_KEY must be blank   (hosted-model keys are rejected on-prem)
#   5. If CS3_INDEXER_ENABLED=true, CECUR_INDEXER_URL must be set and reachable
#      (server/integrations/opensearchSink.ts)
#
# This script only reads environment variables already present in its own process
# environment -- source your deployment's .env file before running it, e.g.:
#   set -a; source .env; set +a; on-prem/bin/preflight-check.sh
set -uo pipefail

FAILED=0
pass() { printf '  [PASS] %s\n' "$1"; }
fail() { printf '  [FAIL] %s\n' "$1"; printf '         %s\n' "$2"; FAILED=1; }

echo "CS3 on-prem preflight check"
echo "============================"

# 1. Demo mode must be off.
if [ "${CS3_DEMO_MODE:-false}" = "true" ]; then
  fail "CS3_DEMO_MODE=true" \
       "Unset CS3_DEMO_MODE or set it to 'false'. Demo mode seeds mock data and runs a simulated tick loop (server/db.ts, server.ts) -- never valid for an on-prem install of real endpoints."
else
  pass "CS3_DEMO_MODE is unset/false"
fi

# 2. Deployment profile must be onprem or airgap.
PROFILE="${CS3_PROFILE:-cloud}"
case "$PROFILE" in
  onprem|airgap)
    pass "CS3_PROFILE=${PROFILE}"
    ;;
  *)
    fail "CS3_PROFILE=${PROFILE}" \
         "Set CS3_PROFILE=onprem (or airgap) before launching the console. See demo/demo-100226/server/profile.ts."
    ;;
esac

# 3. Ingest key enforcement must be on, or no real fleet can be trusted.
if [ "${CS3_INGEST_REQUIRE_KEY:-false}" = "true" ]; then
  pass "CS3_INGEST_REQUIRE_KEY=true"
else
  fail "CS3_INGEST_REQUIRE_KEY=${CS3_INGEST_REQUIRE_KEY:-<unset>}" \
       "Set CS3_INGEST_REQUIRE_KEY=true. Without it, /api/cecur/logs/ingest accepts events from any caller without a per-agent key (server/fleet/enrollment.ts#requireIngestKey)."
fi

# 4. Hosted model keys must be blank on-prem/airgap.
for key in GEMINI_API_KEY DEEPSEEK_API_KEY; do
  val="${!key:-}"
  if [ -n "$val" ]; then
    fail "${key} is set" \
         "Blank ${key}. On-prem/airgap profiles must route LLM calls to a local Ollama instance only (root README.md Path B); hosted-model keys indicate an unintended cloud dependency."
  else
    pass "${key} is blank"
  fi
done

# 5. If durable indexing is enabled, the indexer must actually be reachable.
if [ "${CS3_INDEXER_ENABLED:-false}" = "true" ]; then
  if [ -z "${CECUR_INDEXER_URL:-}" ]; then
    fail "CS3_INDEXER_ENABLED=true but CECUR_INDEXER_URL is empty" \
         "Set CECUR_INDEXER_URL to your OpenSearch/Wazuh Indexer endpoint (deployment/operations/opensearch-cluster.md)."
  else
    AUTH_ARGS=()
    if [ -n "${CECUR_INDEXER_USERNAME:-}" ]; then
      AUTH_ARGS=(-u "${CECUR_INDEXER_USERNAME}:${CECUR_INDEXER_PASSWORD:-}")
    fi
    INSECURE_ARGS=()
    if [ "${CECUR_INDEXER_TLS_INSECURE:-false}" = "true" ]; then
      INSECURE_ARGS=(-k)
    fi
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS -m 5 "${AUTH_ARGS[@]}" "${INSECURE_ARGS[@]}" "${CECUR_INDEXER_URL%/}/_cluster/health" >/dev/null 2>&1; then
        pass "CECUR_INDEXER_URL (${CECUR_INDEXER_URL}) is reachable"
      else
        fail "CECUR_INDEXER_URL (${CECUR_INDEXER_URL}) is not reachable" \
             "Confirm the indexer container/service is up (deployment/docker --profile siem) and credentials/TLS settings are correct."
      fi
    else
      echo "  [SKIP] curl not found -- cannot verify indexer reachability; verify manually."
    fi
  fi
else
  echo "  [INFO] CS3_INDEXER_ENABLED is not 'true' -- durable OpenSearch indexing is off; events will"
  echo "         only live in the in-memory 300-row hot cache. Not a hard failure, but review"
  echo "         on-prem/server-extensions/README.md before accepting real fleet traffic at scale."
fi

echo "============================"
if [ "$FAILED" -ne 0 ]; then
  echo "Preflight FAILED. Fix the items above before going live."
  exit 1
fi
echo "Preflight PASSED."
exit 0

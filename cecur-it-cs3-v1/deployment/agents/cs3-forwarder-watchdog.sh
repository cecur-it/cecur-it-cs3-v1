#!/usr/bin/env bash
# Cecur CS3 forwarder watchdog — health check + bounded auto-remediation.
# Runs every minute from cecur-forwarder-watchdog.timer (Linux). Windows equivalent: the
# "CecurForwarderWatchdog" scheduled task registered by Install-CecurForwarder.ps1.
#
# Remediation ladder (never destructive; escalates by logging at crit so SIEM rules can alert):
#   1. service inactive                -> start/restart
#   2. local /api/v1/health failing x3 -> restart
#   3. > MAX_RESTARTS restarts in 1h   -> stop auto-restarting, log CRIT (needs a human)
# Console unreachability is reported but NOT remediated locally: restarting cannot fix it and
# the filesystem buffer already protects the data.
set -uo pipefail

STATE_DIR=/var/lib/cecur-forwarder/watchdog
HEALTH_URL="${CS3_HEALTH_URL:-http://127.0.0.1:2020/api/v1/health}"
MAX_RESTARTS="${CS3_WATCHDOG_MAX_RESTARTS:-5}"
FAIL_THRESHOLD="${CS3_WATCHDOG_FAIL_THRESHOLD:-3}"
BUFFER_WARN_MB="${CS3_WATCHDOG_BUFFER_WARN_MB:-3072}"
CERT_WARN_DAYS="${CS3_WATCHDOG_CERT_WARN_DAYS:-14}"
SERVICE=cecur-forwarder.service

install -d -m 0700 "$STATE_DIR"
say() { logger -t cs3-forwarder-watchdog -p "daemon.$1" -- "$2"; echo "[$1] $2"; }

restarts_last_hour() {
  local now cutoff n=0 ts
  now=$(date +%s); cutoff=$((now - 3600))
  [[ -f $STATE_DIR/restarts ]] || { echo 0; return; }
  while read -r ts; do [[ $ts =~ ^[0-9]+$ ]] && ((ts >= cutoff)) && n=$((n + 1)); done < "$STATE_DIR/restarts"
  echo "$n"
}

remediate() {
  local reason=$1 n
  n=$(restarts_last_hour)
  if ((n >= MAX_RESTARTS)); then
    say crit "restart budget exhausted ($n in 1h) — not restarting; manual intervention needed. Reason: $reason"
    return 1
  fi
  say warning "restarting $SERVICE: $reason"
  # Trim the ledger to the last hour, then append.
  local cutoff=$(($(date +%s) - 3600))
  { [[ -f $STATE_DIR/restarts ]] && awk -v c="$cutoff" '$1 >= c' "$STATE_DIR/restarts"; date +%s; } > "$STATE_DIR/restarts.new"
  mv -f "$STATE_DIR/restarts.new" "$STATE_DIR/restarts"
  systemctl restart "$SERVICE"
}

# 1. Is the unit running?
if ! systemctl is-active --quiet "$SERVICE"; then
  remediate "service not active"
  exit 0
fi

# 2. Local health endpoint (Fluent Bit reports unhealthy on repeated output errors).
if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
  echo 0 > "$STATE_DIR/fails"
else
  fails=$(( $(cat "$STATE_DIR/fails" 2>/dev/null || echo 0) + 1 ))
  echo "$fails" > "$STATE_DIR/fails"
  say notice "health check failed ($fails/$FAIL_THRESHOLD)"
  if ((fails >= FAIL_THRESHOLD)); then
    echo 0 > "$STATE_DIR/fails"
    remediate "health endpoint failing $fails consecutive checks"
    exit 0
  fi
fi

# 3. Report-only checks.
if [[ -r /etc/cecur/forwarder.env ]]; then
  # shellcheck disable=SC1091
  . /etc/cecur/forwarder.env
  if [[ -n "${CS3_HOST:-}" ]] && ! curl -fsS --max-time 8 --cacert "${CS3_CA_FILE:-/etc/ssl/certs/ca-certificates.crt}" \
      "https://${CS3_HOST}:${CS3_PORT:-443}/api/health" >/dev/null 2>&1; then
    say warning "console ${CS3_HOST}:${CS3_PORT:-443} unreachable; events are buffering on disk"
  fi
fi

buf_mb=$(du -sm /var/lib/cecur-forwarder/buffer 2>/dev/null | cut -f1)
if [[ -n "$buf_mb" ]] && ((buf_mb > BUFFER_WARN_MB)); then
  say warning "buffer is ${buf_mb}MB (> ${BUFFER_WARN_MB}MB): console backpressure or prolonged outage"
fi

for crt in /etc/cecur/pki/ca.pem /etc/cecur/pki/agent.crt; do
  [[ -s $crt ]] || continue
  if ! openssl x509 -checkend $((CERT_WARN_DAYS * 86400)) -noout -in "$crt" >/dev/null 2>&1; then
    say warning "certificate $crt expires within ${CERT_WARN_DAYS} days (or is invalid): rotate per operations/certificate-rotation.md"
  fi
done
exit 0

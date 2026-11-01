#!/usr/bin/env bash
# Cecur CS3 — Linux forwarder installer (Fluent Bit + systemd + watchdog timer).
#
# Usage (as root):
#   CS3_ENROLL_TOKEN=<one-time token> ./install-forwarder.sh \
#       --console-url https://cs3.example.internal --agent-id <agentId> \
#       [--ca-file ./internal-ca.pem] [--pin-sha256 <base64 spki hash>] \
#       [--fluent-bit-pkg ./fluent-bit_3.x_amd64.deb --fluent-bit-sha256 <hex>] [--dry-run]
#   ./install-forwarder.sh --uninstall
#
# The enrollment token is single use; it is read from CS3_ENROLL_TOKEN or --token-file, never
# from argv (which is visible in `ps`). Re-running without a token keeps the existing credentials.
set -euo pipefail
umask 077

readonly CONF_DIR=/etc/cecur
readonly DATA_DIR=/var/lib/cecur-forwarder
readonly ENV_FILE="$CONF_DIR/forwarder.env"
readonly FB_BIN=/opt/fluent-bit/bin/fluent-bit
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

console_url="${CS3_URL:-}"; agent_id=""; token_file=""; ca_file=""; pin=""
fb_pkg=""; fb_sha=""; dry_run=0; uninstall=0

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "[cecur-forwarder] $*" >&2; }
run() { if ((dry_run)); then echo "DRY-RUN: $*" >&2; else "$@"; fi; }

while (($#)); do
  case "$1" in
    --console-url) console_url="${2:?}"; shift 2 ;;
    --agent-id) agent_id="${2:?}"; shift 2 ;;
    --token-file) token_file="${2:?}"; shift 2 ;;
    --ca-file) ca_file="${2:?}"; shift 2 ;;
    --pin-sha256) pin="${2:?}"; shift 2 ;;
    --fluent-bit-pkg) fb_pkg="${2:?}"; shift 2 ;;
    --fluent-bit-sha256) fb_sha="${2:?}"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    --uninstall) uninstall=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run as root"
command -v systemctl >/dev/null || die "systemd is required"

if ((uninstall)); then
  log "uninstalling"
  for u in cecur-forwarder-watchdog.timer cecur-forwarder-watchdog.service cecur-forwarder.service; do
    systemctl disable --now "$u" 2>/dev/null || true
  done
  rm -f /etc/systemd/system/cecur-forwarder*.service /etc/systemd/system/cecur-forwarder-watchdog.timer \
        /usr/local/sbin/cs3-forwarder-watchdog.sh
  systemctl daemon-reload
  rm -rf "$CONF_DIR" "$DATA_DIR"
  log "removed (Fluent Bit package left in place)"
  exit 0
fi

[[ -n "$console_url" ]] || die "--console-url (or CS3_URL) is required"
[[ "$console_url" =~ ^https://([A-Za-z0-9.-]+)(:([0-9]{1,5}))?/?$ ]] \
  || die "console URL must look like https://host[:port] (plaintext HTTP is refused)"
cs3_host="${BASH_REMATCH[1]}"; cs3_port="${BASH_REMATCH[3]:-443}"
base="https://${cs3_host}:${cs3_port}"
[[ -z "$pin" || "$pin" =~ ^[A-Za-z0-9+/=]{44}$ ]] || die "--pin-sha256 must be a base64 SHA-256 SPKI hash (44 chars)"

install -d -m 0750 "$CONF_DIR" "$DATA_DIR" "$DATA_DIR/buffer"
install -d -m 0750 "$CONF_DIR/pki"
if [[ -n "$ca_file" ]]; then
  [[ -r "$ca_file" ]] || die "cannot read CA file $ca_file"
  run install -m 0644 "$ca_file" "$CONF_DIR/pki/ca.pem"
fi
ca_path="$CONF_DIR/pki/ca.pem"
[[ -s "$ca_path" ]] || ca_path=/etc/ssl/certs/ca-certificates.crt   # fall back to the system trust store

# ---- 1. Fluent Bit ------------------------------------------------------------------------------
if [[ ! -x "$FB_BIN" ]]; then
  if [[ -n "$fb_pkg" ]]; then
    [[ -r "$fb_pkg" ]] || die "cannot read $fb_pkg"
    if [[ -n "$fb_sha" ]]; then
      echo "$fb_sha  $fb_pkg" | sha256sum --check --status || die "Fluent Bit package checksum mismatch"
    else
      log "WARNING: --fluent-bit-sha256 not given; package integrity is not verified"
    fi
    if command -v dpkg >/dev/null; then run dpkg -i "$fb_pkg"
    elif command -v rpm >/dev/null; then run rpm -Uvh "$fb_pkg"
    else die "no dpkg/rpm available to install $fb_pkg"; fi
  elif command -v apt-get >/dev/null && apt-cache policy fluent-bit 2>/dev/null | grep -q Candidate; then
    run apt-get install -y fluent-bit
  elif command -v dnf >/dev/null && dnf -q list available fluent-bit >/dev/null 2>&1; then
    run dnf install -y fluent-bit
  else
    die "Fluent Bit is not installed and no package source is configured. Provide --fluent-bit-pkg (air-gapped) or mirror the Fluent Bit repo internally."
  fi
  # Package units may auto-enable the stock service; we run our own instance.
  run systemctl disable --now fluent-bit.service 2>/dev/null || true
fi

# ---- 2. Enrollment (one-time token -> per-agent ingest key) -------------------------------------
token="${CS3_ENROLL_TOKEN:-}"
[[ -z "$token" && -n "$token_file" ]] && token="$(tr -d '\r\n' < "$token_file")"

if [[ -n "$token" ]]; then
  [[ -n "$agent_id" ]] || die "--agent-id is required when enrolling"
  [[ "$agent_id" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || die "invalid agent id"
  [[ "$token" =~ ^[A-Za-z0-9._~+/=-]{8,128}$ ]] || die "enrollment token has unexpected characters"
  log "claiming enrollment for $agent_id"
  curl_args=(-fsS --max-time 30 --proto '=https' --tlsv1.2 -X POST -H 'Content-Type: application/json' --data @-)
  [[ -s "$CONF_DIR/pki/ca.pem" ]] && curl_args+=(--cacert "$CONF_DIR/pki/ca.pem")
  [[ -n "$pin" ]] && curl_args+=(--pinnedpubkey "sha256//$pin")
  if ((dry_run)); then
    log "DRY-RUN: would POST $base/api/fleet/enroll/claim"
    ingest_key="dry-run"
  else
    # Token goes via stdin (not argv) so it never appears in the process list.
    resp="$(printf '{"agentId":"%s","token":"%s"}' "$agent_id" "$token" \
      | curl "${curl_args[@]}" "$base/api/fleet/enroll/claim")" || die "enrollment claim failed (expired/used token, TLS trust or pin mismatch?)"
    ingest_key="$(printf '%s' "$resp" | sed -n 's/.*"ingestKey" *: *"\([A-Za-z0-9._~-]*\)".*/\1/p')"
    [[ -n "$ingest_key" ]] || die "console response did not include an ingest key"
  fi
  unset token
  {
    echo "CS3_HOST=$cs3_host"
    echo "CS3_PORT=$cs3_port"
    echo "CS3_AGENT_ID=$agent_id"
    echo "CS3_HOSTNAME=$(hostname -f 2>/dev/null || hostname)"
    echo "CS3_INGEST_KEY=$ingest_key"
    echo "CS3_CA_FILE=$ca_path"
    echo "CS3_PIN_SHA256=$pin"
  } > "$ENV_FILE.new"
  run chmod 0600 "$ENV_FILE.new"
  run mv -f "$ENV_FILE.new" "$ENV_FILE"
elif [[ -s "$ENV_FILE" ]]; then
  log "no token supplied; keeping existing credentials in $ENV_FILE"
else
  die "no enrollment token (CS3_ENROLL_TOKEN / --token-file) and no existing credentials"
fi

# ---- 3. Config, units, watchdog -----------------------------------------------------------------
run install -m 0640 "$SRC_DIR/templates/fluent-bit-linux.conf" "$CONF_DIR/fluent-bit.conf"
run install -m 0644 "$SRC_DIR/systemd/cecur-forwarder.service" /etc/systemd/system/cecur-forwarder.service
run install -m 0644 "$SRC_DIR/systemd/cecur-forwarder-watchdog.service" /etc/systemd/system/cecur-forwarder-watchdog.service
run install -m 0644 "$SRC_DIR/systemd/cecur-forwarder-watchdog.timer" /etc/systemd/system/cecur-forwarder-watchdog.timer
run install -m 0755 "$SRC_DIR/cs3-forwarder-watchdog.sh" /usr/local/sbin/cs3-forwarder-watchdog.sh

run systemctl daemon-reload
run systemctl enable --now cecur-forwarder.service cecur-forwarder-watchdog.timer
if ((dry_run)); then log "dry run complete"; exit 0; fi

sleep 3
systemctl is-active --quiet cecur-forwarder.service || { journalctl -u cecur-forwarder -n 20 --no-pager >&2; die "forwarder failed to start"; }
log "installed and running (agent $(sed -n 's/^CS3_AGENT_ID=//p' "$ENV_FILE"))"

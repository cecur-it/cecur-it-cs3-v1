#!/usr/bin/env bash
#
# scripts/install-ollama.sh — installs a pinned version of Ollama as a
# hardened, loopback-only service running under a dedicated, non-root
# service account (cs3-ollama). Idempotent: safe to re-run.
#
# Supported platforms: Linux (systemd) and macOS (launchd). Windows is
# handled natively by install.ps1, not this script.
#
# Usage:
#   sudo scripts/install-ollama.sh [--profile cloud|onprem|airgap] [--offline-binary <path>] [--status]
#
# Environment overrides:
#   OLLAMA_PINNED_VERSION   Overrides the pinned version below.
#   OLLAMA_OFFLINE_BINARY   Same as --offline-binary; required for the
#                           airgap profile since it must never fetch from
#                           the network.
set -euo pipefail

# --- Pin the exact Ollama release qualified for this CS3 release. ---------
# 0.40.5 is the 2026 release qualified for Gemma-4 / Nemotron-3-Nano support.
# Keep install.ps1 ($OllamaPinnedVersion) in lockstep with this value.
OLLAMA_PINNED_VERSION="${OLLAMA_PINNED_VERSION:-0.40.5}"

SERVICE_USER="cs3-ollama"
SERVICE_GROUP="cs3-ollama"
SERVICE_HOME="/var/lib/cs3-ollama"
SYSTEMD_UNIT_PATH="/etc/systemd/system/cs3-ollama.service"
LAUNCHD_PLIST_PATH="/Library/LaunchDaemons/com.cecur-it.cs3-ollama.plist"
OLLAMA_BIND_ADDR="127.0.0.1:11434"
OLLAMA_BIN_PATH="/usr/local/bin/ollama"

PROFILE=""
OFFLINE_BINARY="${OLLAMA_OFFLINE_BINARY:-}"
STATUS_ONLY="false"

log()  { printf '[install-ollama] %s\n' "$1"; }
warn() { printf '[install-ollama][warn] %s\n' "$1" >&2; }
die()  { printf '[install-ollama][FAIL] %s\n' "$1" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --offline-binary) OFFLINE_BINARY="$2"; shift 2 ;;
    --status) STATUS_ONLY="true"; shift ;;
    *) warn "Ignoring unrecognized argument: $1"; shift ;;
  esac
done

detect_os() {
  case "$(uname -s)" in
    Linux) echo "linux" ;;
    Darwin) echo "darwin" ;;
    *) echo "unsupported" ;;
  esac
}

report_status() {
  local os_name; os_name="$(detect_os)"
  if command -v ollama >/dev/null 2>&1; then
    log "ollama binary: $(command -v ollama) ($(ollama --version 2>/dev/null || echo 'version unknown'))"
  else
    log "ollama binary: not installed"
  fi
  if [[ "$os_name" == "linux" ]] && command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active cs3-ollama.service >/dev/null 2>&1; then
      log "cs3-ollama.service: active"
    else
      log "cs3-ollama.service: inactive"
    fi
  elif [[ "$os_name" == "darwin" ]]; then
    if launchctl list | grep -q com.cecur-it.cs3-ollama; then
      log "com.cecur-it.cs3-ollama: loaded"
    else
      log "com.cecur-it.cs3-ollama: not loaded"
    fi
  fi
}

if [[ "$STATUS_ONLY" == "true" ]]; then
  report_status
  exit 0
fi

OS_NAME="$(detect_os)"
if [[ "$OS_NAME" == "unsupported" ]]; then
  die "Unsupported platform for install-ollama.sh: $(uname -s). Use install.ps1 on Windows."
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "This script must be run as root (it creates a system user and a service unit). Re-run with sudo."
fi

# --- Idempotent: dedicated, unprivileged service account -------------------
ensure_service_account() {
  if [[ "$OS_NAME" == "linux" ]]; then
    if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
      log "Creating dedicated system account: $SERVICE_USER"
      useradd --system --no-create-home --home-dir "$SERVICE_HOME" --shell /usr/sbin/nologin "$SERVICE_USER"
    else
      log "Service account $SERVICE_USER already exists — skipping creation."
    fi
    mkdir -p "$SERVICE_HOME"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$SERVICE_HOME"
    chmod 750 "$SERVICE_HOME"
  elif [[ "$OS_NAME" == "darwin" ]]; then
    if ! dscl . -read "/Users/_${SERVICE_USER}" >/dev/null 2>&1; then
      log "Creating dedicated macOS service account: _${SERVICE_USER}"
      local next_uid
      next_uid=$(dscl . -list /Users UniqueID | awk '{print $2}' | sort -n | tail -1)
      next_uid=$((next_uid + 1))
      dscl . -create "/Users/_${SERVICE_USER}"
      dscl . -create "/Users/_${SERVICE_USER}" UniqueID "$next_uid"
      dscl . -create "/Users/_${SERVICE_USER}" PrimaryGroupID 1
      dscl . -create "/Users/_${SERVICE_USER}" UserShell /usr/bin/false
      dscl . -create "/Users/_${SERVICE_USER}" NFSHomeDirectory "$SERVICE_HOME"
    else
      log "Service account _${SERVICE_USER} already exists — skipping creation."
    fi
    mkdir -p "$SERVICE_HOME"
    chown -R "_${SERVICE_USER}" "$SERVICE_HOME" 2>/dev/null || true
  fi
}

# --- Idempotent: install the pinned Ollama binary ---------------------------
install_ollama_binary() {
  local installed_version=""
  if command -v ollama >/dev/null 2>&1; then
    installed_version="$(ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  fi

  if [[ "$installed_version" == "$OLLAMA_PINNED_VERSION" ]]; then
    log "Ollama $OLLAMA_PINNED_VERSION already installed — skipping (idempotent)."
    return
  fi

  if [[ -n "$OFFLINE_BINARY" ]]; then
    # Airgap path: never touch the network. The binary must already be
    # pre-staged (e.g. extracted from a verified air-gap bundle).
    [[ -f "$OFFLINE_BINARY" ]] || die "OLLAMA_OFFLINE_BINARY/--offline-binary path not found: $OFFLINE_BINARY"
    log "Installing Ollama from offline binary (no network access): $OFFLINE_BINARY"
    install -m 0755 "$OFFLINE_BINARY" "$OLLAMA_BIN_PATH"
    return
  fi

  if [[ "${PROFILE}" == "airgap" ]]; then
    die "Profile is 'airgap' but no offline binary was provided (--offline-binary / OLLAMA_OFFLINE_BINARY). Refusing to fetch from the network."
  fi

  command -v curl >/dev/null 2>&1 || die "curl is required to fetch the pinned Ollama installer."

  log "Downloading the official Ollama installer (pinned to version $OLLAMA_PINNED_VERSION) for review before execution..."
  local installer_tmp
  installer_tmp="$(mktemp /tmp/ollama-install-XXXXXX.sh)"
  curl -fsSL https://ollama.com/install.sh -o "$installer_tmp"
  log "Installer downloaded to $installer_tmp — review it before it is executed."
  chmod +x "$installer_tmp"
  OLLAMA_VERSION="$OLLAMA_PINNED_VERSION" bash "$installer_tmp"
  rm -f "$installer_tmp"
}

# --- Idempotent: hardened systemd unit (Linux), bound to loopback only -----
write_systemd_unit() {
  local desired_unit
  desired_unit="$(cat <<EOF
[Unit]
Description=CS3 Ollama (hardened, loopback-only, non-root)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
Environment=OLLAMA_HOST=${OLLAMA_BIND_ADDR}
Environment=HOME=${SERVICE_HOME}
Environment=OLLAMA_MODELS=${SERVICE_HOME}/.ollama/models
ExecStart=${OLLAMA_BIN_PATH} serve
Restart=on-failure
RestartSec=5

# --- Hardening (defense in depth) ---
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=false
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=${SERVICE_HOME}
CapabilityBoundingSet=
LockPersonality=true
MemoryDenyWriteExecute=true
RestrictRealtime=true
RestrictSUIDSGID=true
SystemCallFilter=@system-service

[Install]
WantedBy=multi-user.target
EOF
)"

  if [[ -f "$SYSTEMD_UNIT_PATH" ]] && diff -q <(echo "$desired_unit") "$SYSTEMD_UNIT_PATH" >/dev/null 2>&1; then
    log "systemd unit already up to date — skipping rewrite (idempotent)."
  else
    log "Writing hardened systemd unit to $SYSTEMD_UNIT_PATH"
    echo "$desired_unit" > "$SYSTEMD_UNIT_PATH"
    chmod 644 "$SYSTEMD_UNIT_PATH"
    systemctl daemon-reload
  fi

  if systemctl is-active cs3-ollama.service >/dev/null 2>&1; then
    log "cs3-ollama.service already active — skipping restart (idempotent). Run with --status to inspect."
  else
    systemctl enable --now cs3-ollama.service
    log "cs3-ollama.service enabled and started, bound to ${OLLAMA_BIND_ADDR}."
  fi
}

# --- Idempotent: hardened launchd job (macOS), bound to loopback only ------
write_launchd_plist() {
  local desired_plist
  desired_plist="$(cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cecur-it.cs3-ollama</string>
  <key>UserName</key>
  <string>_${SERVICE_USER}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OLLAMA_HOST</key>
    <string>${OLLAMA_BIND_ADDR}</string>
    <key>OLLAMA_MODELS</key>
    <string>${SERVICE_HOME}/.ollama/models</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>${OLLAMA_BIN_PATH}</string>
    <string>serve</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${SERVICE_HOME}/cs3-ollama.log</string>
  <key>StandardErrorPath</key>
  <string>${SERVICE_HOME}/cs3-ollama.err.log</string>
</dict>
</plist>
EOF
)"

  if [[ -f "$LAUNCHD_PLIST_PATH" ]] && diff -q <(echo "$desired_plist") "$LAUNCHD_PLIST_PATH" >/dev/null 2>&1; then
    log "launchd plist already up to date — skipping rewrite (idempotent)."
  else
    log "Writing hardened launchd job to $LAUNCHD_PLIST_PATH"
    echo "$desired_plist" > "$LAUNCHD_PLIST_PATH"
    chmod 644 "$LAUNCHD_PLIST_PATH"
    launchctl unload "$LAUNCHD_PLIST_PATH" >/dev/null 2>&1 || true
  fi

  if launchctl list | grep -q com.cecur-it.cs3-ollama; then
    log "com.cecur-it.cs3-ollama already loaded — skipping (idempotent)."
  else
    launchctl load -w "$LAUNCHD_PLIST_PATH"
    log "com.cecur-it.cs3-ollama loaded, bound to ${OLLAMA_BIND_ADDR}."
  fi
}

main() {
  log "Target platform: $OS_NAME | pinned version: $OLLAMA_PINNED_VERSION | profile: ${PROFILE:-<none>}"
  ensure_service_account
  install_ollama_binary
  if [[ "$OS_NAME" == "linux" ]]; then
    command -v systemctl >/dev/null 2>&1 || die "systemd (systemctl) is required on Linux for the hardened unit."
    write_systemd_unit
  else
    write_launchd_plist
  fi
  log "Done. Ollama is bound to ${OLLAMA_BIND_ADDR} (loopback only) under the ${SERVICE_USER} account."
}

main

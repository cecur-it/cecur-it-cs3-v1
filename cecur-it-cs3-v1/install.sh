#!/usr/bin/env bash
#
# install.sh — Linux (and Raspberry Pi) OS-specific installer script for the
# CS3 Platform, covering all three deployment profiles (cloud | onprem |
# airgap). This script is invoked BY cs3-launcher.mjs after the onboarding
# wizard has populated .env — it is not normally run directly by an
# operator. It performs the OS-level provisioning step for the profile
# already selected and validated by the launcher.
#
# Usage (as invoked by cs3-launcher.mjs):
#   install.sh --profile <cloud|onprem|airgap> [--bundle <path>]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

PROFILE=""
BUNDLE=""

log()  { printf '[install.sh] %s\n' "$1"; }
warn() { printf '[install.sh][warn] %s\n' "$1" >&2; }
die()  { printf '[install.sh][FAIL] %s\n' "$1" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --bundle) BUNDLE="$2"; shift 2 ;;
    *) warn "Ignoring unrecognized argument: $1"; shift ;;
  esac
done

[[ -n "$PROFILE" ]] || die "--profile is required (cloud | onprem | airgap)."
[[ -f .env ]] || die ".env not found. Run cs3-launcher.mjs first so the onboarding wizard can populate it."

set -a
# shellcheck disable=SC1091
source .env
set +a

start_soc_console() {
  local image="${CS3_CONSOLE_IMAGE:?CS3_CONSOLE_IMAGE not set in .env}"
  local port="${CS3_CONSOLE_PORT:-3000}"
  if ! command -v docker >/dev/null 2>&1; then
    warn "docker not found on PATH. Skipping ESOC Console container start — install Docker and re-run, or start it manually:"
    if [[ "$PROFILE" == "cloud" ]]; then
      warn "  docker run -d --name cs3-soc-console --env-file .env -p ${port}:3000 ${image}"
    else
      warn "  docker run -d --name cs3-soc-console --env-file .env --network host -e PORT=${port} ${image}"
    fi
    return
  fi
  if docker inspect cs3-soc-console >/dev/null 2>&1; then
    log "cs3-soc-console container already exists — restarting (idempotent)."
    docker rm -f cs3-soc-console >/dev/null 2>&1 || true
  fi
  if [[ "$PROFILE" == "airgap" ]]; then
    log "Airgap profile: expecting ${image} to already be loaded locally (docker load), not pulled from a registry."
    docker image inspect "$image" >/dev/null 2>&1 || warn "Image ${image} is not present locally. Load it with 'docker load -i <offline-image.tar>' from the verified bundle before this step."
  fi
  if ! docker image inspect "$image" >/dev/null 2>&1 && [[ "$PROFILE" != "airgap" ]]; then
    log "Image ${image} not found locally — trying registry pull, then local build from demo/demo-100226."
    docker pull "$image" >/dev/null 2>&1 || docker build -t "$image" "$REPO_ROOT/demo/demo-100226" || warn "Could not pull or build ${image}."
  fi
  # Ollama is deliberately bound to 127.0.0.1 on the host (see scripts/install-ollama.sh). A bridged
  # container's 127.0.0.1 is the container itself, so on onprem/airgap the console shares the host
  # network namespace (Linux only) and reaches OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 unchanged.
  # The listen port is then set through PORT because -p mappings are ignored with --network host.
  local net_args=(-p "${port}:3000")
  if [[ "$PROFILE" != "cloud" ]]; then
    net_args=(--network host -e "PORT=${port}")
  fi
  log "Starting CS3 ESOC Console container (${image}) on port ${port}..."
  docker run -d --name cs3-soc-console --env-file .env "${net_args[@]}" "$image" || warn "Failed to start ESOC Console container; see docker logs for details."
}

install_onprem_ollama_and_models() {
  log "Installing pinned Ollama with hardened systemd unit..."
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    warn "Not running as root — attempting with sudo. Re-run this installer via cs3-launcher.mjs as root/sudo if this fails."
    sudo "$REPO_ROOT/scripts/install-ollama.sh" --profile "$PROFILE"
  else
    "$REPO_ROOT/scripts/install-ollama.sh" --profile "$PROFILE"
  fi

  if command -v ollama >/dev/null 2>&1; then
    for model in "${OLLAMA_PRIMARY_MODEL:-}" "${OLLAMA_FALLBACK_MODEL:-}"; do
      [[ -n "$model" ]] || continue
      log "Pulling approved model tag: $model"
      ollama pull "$model" || warn "Failed to pull $model — confirm registry access and the tag in onboarding/models.json."
    done
  else
    warn "ollama binary not found after install step; skipping model pull."
  fi
}

install_airgap_ollama_and_models() {
  [[ -n "$BUNDLE" ]] || die "airgap profile requires --bundle <path>; this should already be guaranteed by cs3-launcher.mjs."
  [[ -n "${CS3_AIRGAP_BUNDLE_SHA256:-}" ]] || die "CS3_AIRGAP_BUNDLE_SHA256 missing from .env; refusing to load an unverified bundle."

  log "Extracting verified bundle (no registry pull will be attempted): $BUNDLE"
  local staging_dir
  staging_dir="$(mktemp -d /tmp/cs3-airgap-XXXXXX)"
  tar -xf "$BUNDLE" -C "$staging_dir"

  local offline_binary=""
  if [[ -f "$staging_dir/bin/ollama" ]]; then
    offline_binary="$staging_dir/bin/ollama"
  fi

  log "Installing Ollama (offline) with hardened systemd unit..."
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    sudo "$REPO_ROOT/scripts/install-ollama.sh" --profile airgap ${offline_binary:+--offline-binary "$offline_binary"}
  else
    "$REPO_ROOT/scripts/install-ollama.sh" --profile airgap ${offline_binary:+--offline-binary "$offline_binary"}
  fi

  local models_target="/var/lib/cs3-ollama/.ollama/models"
  if [[ -d "$staging_dir/models" ]]; then
    log "Loading models directly into the local Ollama store from the bundle (no registry pull): $models_target"
    if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
      sudo mkdir -p "$models_target"
      sudo cp -a "$staging_dir/models/." "$models_target/"
      sudo chown -R cs3-ollama:cs3-ollama "$models_target"
    else
      mkdir -p "$models_target"
      cp -a "$staging_dir/models/." "$models_target/"
      chown -R cs3-ollama:cs3-ollama "$models_target"
    fi
  else
    warn "Bundle did not contain a models/ directory; nothing to load."
  fi

  if [[ -d "$staging_dir/images" ]] && command -v docker >/dev/null 2>&1; then
    for img in "$staging_dir"/images/*.tar; do
      [[ -f "$img" ]] || continue
      log "Loading offline console image: $img"
      docker load -i "$img" || warn "Failed to docker load $img."
    done
  fi

  rm -rf "$staging_dir"

  if [[ "${CS3_TELEMETRY_ENABLED:-false}" != "false" || "${CS3_UPDATE_CHECK_ENABLED:-false}" != "false" ]]; then
    die "Telemetry/update checks must be disabled on the airgap profile (.env). Refusing to proceed."
  fi
  log "Telemetry and update checks confirmed disabled for this airgap install."
}

case "$PROFILE" in
  cloud)
    start_soc_console
    ;;
  onprem)
    install_onprem_ollama_and_models
    start_soc_console
    ;;
  airgap)
    install_airgap_ollama_and_models
    start_soc_console
    ;;
  *)
    die "Unknown profile: $PROFILE"
    ;;
esac

log "Linux installer finished for profile: $PROFILE"

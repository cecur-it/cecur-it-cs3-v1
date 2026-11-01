#!/usr/bin/env bash
#
# install.command — macOS (Finder double-clickable) OS-specific installer
# script for the CS3 Platform, covering all three deployment profiles
# (cloud | onprem | airgap). This script is invoked BY cs3-launcher.mjs
# after the onboarding wizard has populated .env — it is not normally run
# directly by an operator, though double-clicking it in Finder (or running
# it from Terminal) with the same flags works too.
#
# Usage (as invoked by cs3-launcher.mjs):
#   install.command --profile <cloud|onprem|airgap> [--bundle <path>]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

PROFILE=""
BUNDLE=""

log()  { printf '[install.command] %s\n' "$1"; }
warn() { printf '[install.command][warn] %s\n' "$1" >&2; }
die()  { printf '[install.command][FAIL] %s\n' "$1" >&2; exit 1; }

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

ensure_docker_desktop_running() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker Desktop CLI (docker) not found on PATH. Install Docker Desktop for Mac and re-run."
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log "Docker Desktop does not appear to be running — attempting to start it..."
    open -a Docker >/dev/null 2>&1 || true
    for _ in $(seq 1 30); do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
  fi
  docker info >/dev/null 2>&1
}

start_soc_console() {
  local image="${CS3_CONSOLE_IMAGE:?CS3_CONSOLE_IMAGE not set in .env}"
  local port="${CS3_CONSOLE_PORT:-3000}"
  if ! ensure_docker_desktop_running; then
    warn "Skipping ESOC Console container start. Start Docker Desktop and run manually:"
    warn "  docker run -d --name cs3-soc-console --env-file .env -p ${port}:3000 --add-host=host.docker.internal:host-gateway -e OLLAMA_BASE_URL=http://host.docker.internal:11434/v1 ${image}"
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
  # Docker Desktop runs containers in a VM, so --network host would not reach the macOS host. Ollama is
  # bound to 127.0.0.1 on the host (see scripts/install-ollama.sh); Docker Desktop forwards
  # host.docker.internal to the host's loopback, so point the console there on onprem/airgap.
  local net_args=(-p "${port}:3000")
  if [[ "$PROFILE" != "cloud" ]]; then
    net_args+=(--add-host=host.docker.internal:host-gateway -e "OLLAMA_BASE_URL=http://host.docker.internal:11434/v1")
  fi
  log "Starting CS3 ESOC Console container (${image}) on port ${port}..."
  docker run -d --name cs3-soc-console --env-file .env "${net_args[@]}" "$image" || warn "Failed to start ESOC Console container; see docker logs for details."
}

install_onprem_ollama_and_models() {
  log "Installing pinned Ollama with hardened launchd job..."
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    log "Elevating via sudo to create the dedicated service account and launchd job (you may be prompted for your password)."
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

  log "Installing Ollama (offline) with hardened launchd job..."
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    sudo "$REPO_ROOT/scripts/install-ollama.sh" --profile airgap ${offline_binary:+--offline-binary "$offline_binary"}
  else
    "$REPO_ROOT/scripts/install-ollama.sh" --profile airgap ${offline_binary:+--offline-binary "$offline_binary"}
  fi

  local models_target="/var/lib/cs3-ollama/.ollama/models"
  if [[ -d "$staging_dir/models" ]]; then
    log "Loading models directly into the local Ollama store from the bundle (no registry pull): $models_target"
    sudo mkdir -p "$models_target"
    sudo cp -a "$staging_dir/models/." "$models_target/"
    sudo chown -R "_cs3-ollama" "$models_target" 2>/dev/null || true
  else
    warn "Bundle did not contain a models/ directory; nothing to load."
  fi

  if [[ -d "$staging_dir/images" ]] && docker info >/dev/null 2>&1; then
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

log "macOS installer finished for profile: $PROFILE"

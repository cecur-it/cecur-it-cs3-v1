#!/usr/bin/env bash
#
# scripts/install-llama.cpp.sh — optional llama.cpp fallback for hosts that
# cannot run Ollama's CUDA/Metal-accelerated builds well (e.g. non-NVIDIA
# GPUs, CPU-only edge collectors). Builds a pinned tag from source into a
# user-local prefix. Idempotent: safe to re-run.
#
# Usage:
#   scripts/install-llama.cpp.sh [--prefix <dir>] [--status]
set -euo pipefail

# Pin the exact llama.cpp tag validated by platform security review before
# any production or customer-facing rollout.
LLAMA_CPP_PINNED_TAG="${LLAMA_CPP_PINNED_TAG:-b4000}"
LLAMA_CPP_REPO_URL="${LLAMA_CPP_REPO_URL:-https://github.com/ggerganov/llama.cpp.git}"

PREFIX="${LLAMA_CPP_PREFIX:-$HOME/.cs3/llama.cpp}"
STATUS_ONLY="false"

log()  { printf '[install-llama.cpp] %s\n' "$1"; }
warn() { printf '[install-llama.cpp][warn] %s\n' "$1" >&2; }
die()  { printf '[install-llama.cpp][FAIL] %s\n' "$1" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --status) STATUS_ONLY="true"; shift ;;
    *) warn "Ignoring unrecognized argument: $1"; shift ;;
  esac
done

VERSION_FILE="$PREFIX/.cs3-installed-tag"
SRC_DIR="$PREFIX/src"
BIN_DIR="$PREFIX/bin"

report_status() {
  if [[ -f "$VERSION_FILE" ]]; then
    log "installed tag: $(cat "$VERSION_FILE") at $PREFIX"
  else
    log "not installed (no build found at $PREFIX)"
  fi
}

if [[ "$STATUS_ONLY" == "true" ]]; then
  report_status
  exit 0
fi

detect_backend() {
  case "$(uname -s)" in
    Darwin)
      echo "metal" ;;
    Linux)
      if command -v nvidia-smi >/dev/null 2>&1; then
        echo "cuda"
      else
        echo "cpu"
      fi
      ;;
    *)
      echo "cpu" ;;
  esac
}

require_tools() {
  local missing=()
  for tool in git cmake cc; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    die "Missing required build tools: ${missing[*]}. Install a C/C++ toolchain, cmake, and git first."
  fi
}

main() {
  if [[ -f "$VERSION_FILE" ]] && [[ "$(cat "$VERSION_FILE")" == "$LLAMA_CPP_PINNED_TAG" ]]; then
    log "llama.cpp $LLAMA_CPP_PINNED_TAG already built at $PREFIX — skipping (idempotent)."
    exit 0
  fi

  require_tools

  local backend
  backend="$(detect_backend)"
  log "Building llama.cpp @ $LLAMA_CPP_PINNED_TAG with backend: $backend"

  mkdir -p "$PREFIX"
  if [[ -d "$SRC_DIR/.git" ]]; then
    log "Existing checkout found — fetching pinned tag (idempotent)."
    git -C "$SRC_DIR" fetch --tags --depth 1 origin "$LLAMA_CPP_PINNED_TAG"
    git -C "$SRC_DIR" checkout "$LLAMA_CPP_PINNED_TAG"
  else
    git clone --branch "$LLAMA_CPP_PINNED_TAG" --depth 1 "$LLAMA_CPP_REPO_URL" "$SRC_DIR"
  fi

  local cmake_flags=("-DCMAKE_BUILD_TYPE=Release")
  case "$backend" in
    cuda) cmake_flags+=("-DGGML_CUDA=ON") ;;
    metal) cmake_flags+=("-DGGML_METAL=ON") ;;
    *) cmake_flags+=("-DGGML_CUDA=OFF" "-DGGML_METAL=OFF") ;;
  esac

  cmake -S "$SRC_DIR" -B "$SRC_DIR/build" "${cmake_flags[@]}"
  cmake --build "$SRC_DIR/build" --config Release -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"

  mkdir -p "$BIN_DIR"
  find "$SRC_DIR/build/bin" -maxdepth 1 -type f -perm -u+x -exec cp {} "$BIN_DIR/" \; 2>/dev/null || true

  echo "$LLAMA_CPP_PINNED_TAG" > "$VERSION_FILE"
  log "Done. Binaries installed to $BIN_DIR (add it to PATH to use llama-cli / llama-server)."
}

main

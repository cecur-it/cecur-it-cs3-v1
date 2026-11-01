#!/usr/bin/env bash
# Kustomize and Helm both refuse symlinks/paths outside their root (a Helm symlink is dropped from the
# packaged chart, leaving the cs3-pg-init ConfigMap empty), so the canonical PostgreSQL init scripts
# (deployment/docker/postgres/init) are COPIED into:
#   deployment/kustomize/components/postgres/sql
#   deployment/helm/cs3/files/sql
#   deployment/scripts/sync-sql.sh          # refresh copies
#   deployment/scripts/sync-sql.sh --check  # fail (exit 1) when copies are stale, missing or symlinks (CI)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$here/docker/postgres/init"
dsts=("$here/kustomize/components/postgres/sql" "$here/helm/cs3/files/sql")
mode="${1:-sync}"

if [[ "$mode" == "--check" ]]; then
  rc=0
  for dst in "${dsts[@]}"; do
    for f in "$src"/*; do
      t="$dst/$(basename "$f")"
      if [[ -L "$t" ]]; then echo "symlink (must be a regular copy): $t"; rc=1; continue; fi
      cmp -s "$f" "$t" || { echo "stale: $t"; rc=1; }
    done
  done
  exit "$rc"
fi
for dst in "${dsts[@]}"; do
  mkdir -p "$dst"
  for f in "$src"/*; do
    rm -f "$dst/$(basename "$f")"
  done
  files=("$src"/*)
  cp -p "${files[@]}" "$dst/"
  echo "synced ${#files[@]} files to $dst"
done

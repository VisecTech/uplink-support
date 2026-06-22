#!/bin/sh
# uplink-support — post-build symlink fix (mirrors Counter's).
#
# Next.js 'output: standalone' emits .next/standalone/server.js but expects
# .next/static and public/ as siblings of it at runtime.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d ".next/standalone" ]; then
  echo "[post-build] .next/standalone does not exist (skipping)"
  exit 0
fi

ln -snf "$ROOT/.next/static" .next/standalone/.next/static
ln -snf "$ROOT/public"       .next/standalone/public

# Defensive: fill any server-chunk tracing gaps (see Counter's note).
if [ -d ".next/server/chunks" ] && [ -d ".next/standalone/.next/server/chunks" ]; then
  rsync -a --quiet ".next/server/chunks/" ".next/standalone/.next/server/chunks/"
fi
echo "[post-build] symlinked static + public into .next/standalone/"

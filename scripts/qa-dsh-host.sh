#!/usr/bin/env bash
#
# qa:dsh-host — REAL DSH host/profile composition lane (NOT the renderer smoke).
#
# Verifies with a fresh DSH_HOME + scratch profile + packed @dshelm/dsh bundle:
#   1. profile tree composes the dshelm bundle row (--dump-config)
#   2. the plugin tree loads past the loader (boot no longer fails at the
#      dshelm entry; Config Standard-Schema + inject gates are real-loader
#      contracts, verified in the hardening round)
#   3. the client manifest (dsh.client inject/platform) is present in the
#      installed package
#
# The interactive Web shell itself is TTY-only and the published client
# runtime (@deepseek-ai/dsh-client-runtime@0.0.1-rc.1) depends on the
# unpublished @deepseek-ai/dsh-compact — see docs/decisions/master contract
# blockers. The renderer smoke (qa:web-renderer) proves DOM/rendering only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACK_DIR="$(mktemp -d)"
HOME_DIR="$(mktemp -d)"
export DSH_HOME="$HOME_DIR"

trap 'rm -rf "$PACK_DIR" "$HOME_DIR"' EXIT

echo "== packing @dshelm/dsh =="
(cd "$ROOT/packages/dsh" && pnpm pack --pack-destination "$PACK_DIR" >/dev/null)
DSH_TARBALL="$(ls "$PACK_DIR"/*.tgz | head -1)"

echo "== fresh profile + npm install of packed tarballs =="
mkdir -p "$DSH_HOME/profiles/dshelm-qa"
cd "$DSH_HOME/profiles/dshelm-qa"
cat > package.json <<EOF
{
  "name": "dsh-profile-dshelm-qa",
  "private": true,
  "dependencies": {},
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@dshelm/dsh"] } }
}
EOF
(cd "$ROOT/packages/core" && pnpm pack --pack-destination "$PACK_DIR" >/dev/null)
CORE_TARBALL="$(ls "$PACK_DIR"/*core*.tgz | head -1)"
npm install --no-audit --no-fund "$CORE_TARBALL" "$DSH_TARBALL" >/dev/null 2>&1

echo "== dump-config: dshelm bundle row =="
dsh --profile dshelm-qa --dump-config | grep -A2 '# == @dshelm/dsh'

echo "== client manifest present =="
node -e "const m = require('./node_modules/@dshelm/dsh/package.json'); if (!m.dsh?.client?.inject?.includes('@deepseek-ai/dsh-client-runtime')) process.exit(1); console.log('dsh.client.inject:', m.dsh.client.inject.join(', '))"

echo "== client bundle registers under __ModuleLoader__ with the package id =="
node "$ROOT/scripts/verify-client-bundle.js" ./node_modules/@dshelm/dsh/lib/client.js

echo "== plugin tree load (fail loud; web app is TTY-only, so a live boot is
expected to run until the timeout) =="
set +e
timeout 12 dsh --profile dshelm-qa >/tmp/dshelm-qa-boot.log 2>&1
BOOT_EXIT=$?
set -e
if [ "$BOOT_EXIT" -eq 124 ]; then
  echo 'boot: OK (app ran until timeout — plugin tree loaded, no loader error for entry dshelm)'
elif [ "$BOOT_EXIT" -eq 0 ]; then
  echo "FAIL: boot exited 0 unexpectedly (no app should exit cleanly without args)" >&2
  cat /tmp/dshelm-qa-boot.log >&2
  exit 1
else
  echo "FAIL: boot exited $BOOT_EXIT (loader/config error — see log)" >&2
  cat /tmp/dshelm-qa-boot.log >&2
  exit 1
fi

echo 'qa:dsh-host OK'
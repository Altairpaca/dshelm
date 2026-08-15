#!/usr/bin/env bash
# Apply / rollback the DSH preset-mount guard on the global install.
#
# Background: `agent-presets` mounts a session preset through the Cordis
# loader. If any preset row's apply never settles (sync loop or a
# never-resolving async effect), `mountPreset` hangs forever — `session.create`
# never returns, no error is logged server-side, and the Web UI appears stuck
# ("卡死") with no session ever created. This guard races the mount against a
# 10 s timeout and fails loud, naming the still-pending rows.
#
# Files patched (global Bun install):
#   @deepseek-ai/dsh-agent-presets/lib/index.js
#
# Usage:
#   bash apply.sh              apply (idempotent)
#   bash apply.sh --rollback   restore pristine .orig copy
#
# After applying: restart `dsh web`. Re-run after any
# `bun add -g @deepseek-ai/dsh` reinstall.
set -euo pipefail

ROOT="${DSH_GLOBAL_ROOT:-$HOME/.bun/install/global/node_modules/@deepseek-ai}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="dsh-agent-presets/lib/index.js"
MARKER='preset "'
SRC="$HERE/dsh-agent-presets_lib_index.js"
ORIG="$HERE/dsh-agent-presets_lib_index.js.orig"
DST="$ROOT/$TARGET"

[ -f "$DST" ] || { echo "SKIP (missing): $DST — is DSH installed globally?" >&2; exit 1; }

if [ "${1:-}" = "--rollback" ]; then
  cp "$ORIG" "$DST"
  echo "rolled back: $DST"
  echo "Done. Restart the DSH web server."
  exit 0
fi

if grep -qF 'preset-mount guard' "$DST"; then
  echo "already patched: $DST"
  exit 0
fi

cp "$ORIG" "$DST.dsh-preset-mount-guard.bak"
cp "$SRC" "$DST"
if ! node --check "$DST" >/dev/null 2>&1; then
  echo "ERROR: syntax check failed — restoring backup" >&2
  mv "$DST.dsh-preset-mount-guard.bak" "$DST"
  exit 1
fi
echo "patched: $DST (pristine backup at $DST.dsh-preset-mount-guard.bak)"
echo "Done. Restart the DSH web server."

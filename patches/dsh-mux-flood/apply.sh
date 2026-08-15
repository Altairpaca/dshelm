#!/usr/bin/env bash
# Apply / rollback the DSH mux-flood fix on the global install.
#
# Background: DSH 0.1.0-rc.6 (the latest published release) streams EVERY
# session/event of EVERY session to EVERY connected /api/events.mux client,
# token-chunk by token-chunk, with an unbounded FrameQueue and no per-session
# subscription. Under heavy parallel streaming the browser main thread is
# starved: streaming text keeps updating, but New Session and page refresh
# stop responding ("卡死"). This patch coalesces consecutive token deltas of
# the same block into one wire frame (lossless — the client stitcher
# concatenates per index/type) and bounds the queue.
#
# Files patched (global Bun install):
#   @deepseek-ai/dsh-host-apiproxy/lib/index.js        (server mux)
#   @deepseek-ai/dsh-client-connection/lib/client.js   (muxFrameSchema)
#   @deepseek-ai/dsh-client-runtime/lib/client.js      (batch apply)
#
# Usage:
#   bash apply.sh              apply (idempotent)
#   bash apply.sh --rollback   restore pristine .orig copies
#
# After applying: restart `dsh web` and hard-refresh the browser
# (Ctrl+Shift+R). Any `bun add -g @deepseek-ai/dsh` reinstall wipes the
# patch; re-run this script afterwards (and rebuild node-pty if needed).
set -euo pipefail

ROOT="${DSH_GLOBAL_ROOT:-$HOME/.bun/install/global/node_modules/@deepseek-ai}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

declare -A FILES=(
  [dsh-host-apiproxy/lib/index.js]="dsh-host-apiproxy_lib_index.js"
  [dsh-client-connection/lib/client.js]="dsh-client-connection_lib_client.js"
  [dsh-client-runtime/lib/client.js]="dsh-client-runtime_lib_client.js"
)

# Unique marker introduced by this patch in every touched file.
MARKER='session/events'

if [ "${1:-}" = "--rollback" ]; then
  for target in "${!FILES[@]}"; do
    dst="$ROOT/$target"
    [ -f "$dst" ] || { echo "SKIP (missing): $dst" >&2; continue; }
    cp "$HERE/${FILES[$target]}.orig" "$dst"
    echo "rolled back: $dst"
  done
  echo "Done. Restart the DSH web server."
  exit 0
fi

for target in "${!FILES[@]}"; do
  src="$HERE/${FILES[$target]}"
  dst="$ROOT/$target"
  if [ ! -f "$dst" ]; then
    echo "SKIP (missing): $dst — is DSH installed globally?" >&2
    exit 1
  fi
  if grep -qF "$MARKER" "$dst"; then
    echo "already patched: $dst"
    continue
  fi
  # Backup = pristine original (guaranteed rollback), not the current file.
  cp "$HERE/${FILES[$target]}.orig" "$dst.dsh-mux-flood.bak"
  cp "$src" "$dst"
  if ! node --check "$dst" >/dev/null 2>&1; then
    echo "ERROR: syntax check failed after patching $dst — restoring backup" >&2
    mv "$dst.dsh-mux-flood.bak" "$dst"
    exit 1
  fi
  echo "patched: $dst (pristine backup at $dst.dsh-mux-flood.bak)"
done

echo
echo "Done. Restart the DSH web server, then hard-refresh the browser."

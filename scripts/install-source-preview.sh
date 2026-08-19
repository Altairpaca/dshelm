#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACK_DIR="$(mktemp -d -t dshelm-source-preview-XXXXXX)"
UNPACK_DIR="$PACK_DIR/unpack"

cleanup() {
  rm -r "$PACK_DIR"
}
trap cleanup EXIT

if ! command -v dsh >/dev/null 2>&1; then
  echo 'DSHelm preview requires the DSH CLI on PATH.' >&2
  echo 'Install or verify DSH first: npx @deepseek-ai/dsh --version' >&2
  exit 1
fi

echo '== Pack local DSHelm workspace packages =='
pnpm --dir "$ROOT_DIR/packages/core" pack --pack-destination "$PACK_DIR" >/dev/null
pnpm --dir "$ROOT_DIR/packages/model-knowledge" pack --pack-destination "$PACK_DIR" >/dev/null
pnpm --dir "$ROOT_DIR/packages/dsh" pack --pack-destination "$PACK_DIR" >/dev/null

CORE_TGZ="$(find "$PACK_DIR" -maxdepth 1 -name 'dshelm-core-*.tgz' -print -quit)"
KNOWLEDGE_TGZ="$(find "$PACK_DIR" -maxdepth 1 -name 'dshelm-model-knowledge-*.tgz' -print -quit)"
DSH_TGZ="$(find "$PACK_DIR" -maxdepth 1 -name 'dshelm-dsh-*.tgz' -print -quit)"

if [[ -z "$CORE_TGZ" || -z "$KNOWLEDGE_TGZ" || -z "$DSH_TGZ" ]]; then
  echo 'Failed to pack one or more DSHelm workspace packages.' >&2
  exit 1
fi

# The public @dshelm packages do not exist until the alpha release. Rewrite
# only this temporary tarball so DSH can install the local preview atomically.
mkdir -p "$UNPACK_DIR"
tar -xzf "$DSH_TGZ" -C "$UNPACK_DIR"
node - "$UNPACK_DIR/package/package.json" "$CORE_TGZ" "$KNOWLEDGE_TGZ" <<'NODE'
const fs = require('node:fs')
const [manifestPath, coreTarball, knowledgeTarball] = process.argv.slice(2)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
manifest.dependencies['@dshelm/core'] = `file:${coreTarball}`
manifest.dependencies['@dshelm/model-knowledge'] = `file:${knowledgeTarball}`
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
NODE

PREVIEW_TGZ="$PACK_DIR/dshelm-dsh-source-preview.tgz"
tar -czf "$PREVIEW_TGZ" -C "$UNPACK_DIR" package

echo '== Install the dshelm DSH profile =='
export DSHELM_DSH_BUNDLE_SPECS="$CORE_TGZ,$KNOWLEDGE_TGZ,$PREVIEW_TGZ"
node "$ROOT_DIR/packages/cli/dist/index.js" init --yes

echo
echo 'DSHelm source preview is ready.'
echo 'Next: dsh --profile dshelm --dump-config'
echo 'Then: dsh --profile dshelm'

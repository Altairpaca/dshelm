#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP_ROOT="$(mktemp -d -t dshelm-pack-install-XXXXXX)"
PACK_DIR="$TMP_ROOT/pack"
FRESH_DIR="$TMP_ROOT/fresh"
DSH_CLI_DIR="$TMP_ROOT/dsh-cli"
trap 'rm -rf "$TMP_ROOT"' EXIT

pnpm build
node scripts/pack-publishable.mjs "$PACK_DIR"
PACK_MANIFEST="$PACK_DIR/pack-manifest.json"

package_tarball() {
  node - "$PACK_MANIFEST" "$1" <<'NODE'
const fs = require('node:fs')
const [manifestPath, name] = process.argv.slice(2)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const entry = manifest.packages.find((item) => item.name === name)
if (!entry) {
  console.error(`package ${name} is missing from ${manifestPath}`)
  process.exit(1)
}
process.stdout.write(entry.tarball)
NODE
}

mapfile -t ALL_TARBALLS < <(node - "$PACK_MANIFEST" <<'NODE'
const fs = require('node:fs')
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
for (const entry of manifest.packages) console.log(entry.tarball)
NODE
)

CORE_TGZ="$(package_tarball '@dshelm/core')"
MODEL_KNOWLEDGE_TGZ="$(package_tarball '@dshelm/model-knowledge')"
DSH_TGZ="$(package_tarball '@dshelm/dsh')"
CLI_TGZ="$(package_tarball 'dshelm')"

mkdir -p "$FRESH_DIR" "$DSH_CLI_DIR"
npm install --prefix "$DSH_CLI_DIR" --no-audit --no-fund @deepseek-ai/dsh@0.1.0-rc.7 >/dev/null

cd "$FRESH_DIR"
npm init -y >/dev/null
npm install --no-audit --no-fund "${ALL_TARBALLS[@]}" >/dev/null

node -e "import('@dshelm/core').then(m => { if (!m.resolvePolicy) process.exit(1) })"
node -e "import('@dshelm/dsh').then(m => { if (!m.DSHelmPolicyService) process.exit(1) })"
node -e "if (!require.resolve('dshelm').endsWith('/dist/index.js')) process.exit(1)"

CLI_BIN="$FRESH_DIR/node_modules/dshelm/dist/index.js"
test -f "$CLI_TGZ"
bash "$ROOT/scripts/qa-clean-install.sh" \
  "$CLI_BIN" \
  "$CORE_TGZ" \
  "$MODEL_KNOWLEDGE_TGZ" \
  "$DSH_TGZ" \
  "$DSH_CLI_DIR/node_modules/.bin/dsh"
node "$ROOT/scripts/verify-client-bundle.js"

echo 'qa:pack-install OK'

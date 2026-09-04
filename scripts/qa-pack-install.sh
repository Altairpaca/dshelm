#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP_ROOT="$(mktemp -d -t dshelm-pack-install-XXXXXX)"
PACK_DIR="$TMP_ROOT/pack"
FRESH_DIR="$TMP_ROOT/fresh"
DSH_CLI_DIR="$TMP_ROOT/dsh-cli"
trap 'rm -rf "$TMP_ROOT"' EXIT

DSH_VERSION="$(node -e "const c=require('./compatibility.json'); if(typeof c.tested?.dshPackages!=='string'||!c.tested.dshPackages) process.exit(1); process.stdout.write(c.tested.dshPackages)")"

stage() {
  printf '\n==> qa:pack-install: %s\n' "$1"
}

stage "build workspace"
pnpm build
stage "pack publishable packages"
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

ALL_TARBALLS=()
while IFS= read -r tarball; do
  ALL_TARBALLS+=("$tarball")
done < <(node - "$PACK_MANIFEST" <<'NODE'
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
stage "install external DSH compatibility target ($DSH_VERSION)"
# Keep the DSH CLI in an isolated prefix, but use pnpm so Actions can reuse the
# already-restored content-addressed store instead of cold-resolving the large
# release graph through a separate npm cache on every PR. pnpm 11 requires
# dependency build approvals in pnpm-workspace.yaml; keep this allowlist narrow
# rather than enabling arbitrary transitive build scripts.
printf '{"private":true}\n' > "$DSH_CLI_DIR/package.json"
cat > "$DSH_CLI_DIR/pnpm-workspace.yaml" <<'YAML'
allowBuilds:
  '@deepseek-ai/dsh-subprocess-local': true
  '@google/genai': true
  koffi: true
  node-pty: true
  protobufjs: true
YAML
pnpm --dir "$DSH_CLI_DIR" add --save-exact --prefer-offline "@deepseek-ai/dsh@$DSH_VERSION"
test -x "$DSH_CLI_DIR/node_modules/.bin/dsh"

cd "$FRESH_DIR"
stage "initialize fresh consumer project"
npm init -y >/dev/null
stage "install packed DSHelm workspace packages"
NPM_CONFIG_FETCH_TIMEOUT=45000 \
NPM_CONFIG_FETCH_RETRIES=1 \
npm install --no-audit --no-fund --loglevel=warn "${ALL_TARBALLS[@]}"

stage "verify packed package exports"
node -e "import('@dshelm/core').then(m => { if (!m.resolvePolicy) process.exit(1) })"
node -e "import('@dshelm/model-knowledge').then(m => { if (!m.knowledgeBundleFromAhiSummaries) process.exit(1) })"
node -e "import('@dshelm/dsh').then(m => { if (!m.DSHelmPolicyService) process.exit(1) })"
node -e "if (!require.resolve('dshelm').endsWith('/dist/index.js')) process.exit(1)"

CLI_BIN="$FRESH_DIR/node_modules/dshelm/dist/index.js"
test -f "$CLI_TGZ"
stage "run clean-install journey"
bash "$ROOT/scripts/qa-clean-install.sh" \
  "$CLI_BIN" \
  "$CORE_TGZ" \
  "$MODEL_KNOWLEDGE_TGZ" \
  "$DSH_TGZ" \
  "$DSH_CLI_DIR/node_modules/.bin/dsh"
stage "verify client bundle"
node "$ROOT/scripts/verify-client-bundle.js"

echo "qa:pack-install OK (DSH $DSH_VERSION)"

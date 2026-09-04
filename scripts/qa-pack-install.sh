#!/usr/bin/env bash
set -euo pipefail

WITH_DSH_RELEASE=false
case "${1:-}" in
  "") ;;
  --with-dsh-release) WITH_DSH_RELEASE=true ;;
  *)
    echo "usage: $0 [--with-dsh-release]" >&2
    exit 2
    ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP_ROOT="$(mktemp -d -t dshelm-pack-install-XXXXXX)"
PACK_DIR="$TMP_ROOT/pack"
FRESH_DIR="$TMP_ROOT/fresh"
DSH_CLI_DIR="$TMP_ROOT/dsh-cli"
trap 'rm -rf "$TMP_ROOT"' EXIT

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

mkdir -p "$FRESH_DIR"
cd "$FRESH_DIR"
stage "initialize fresh consumer project"
printf '{"private":true}\n' > package.json
# The tarballs contain publish-ready semver references to sibling @dshelm
# packages. Before those packages exist on npm, model one atomic release set by
# overriding every packed package name to the exact tarball produced above.
# External dependencies are deliberately not overridden.
node - "$PACK_MANIFEST" "$FRESH_DIR/pnpm-workspace.yaml" <<'NODE'
const fs = require('node:fs')
const [manifestPath, outputPath] = process.argv.slice(2)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const quote = (value) => JSON.stringify(value)
const lines = ["packages:", "  - '.'", 'overrides:']
for (const entry of manifest.packages) {
  lines.push(`  ${quote(entry.name)}: ${quote(`file:${entry.tarball}`)}`)
}
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`)
NODE

stage "resolve and install packed DSHelm workspace packages"
# This lane verifies the publishable tarballs, their real external runtime
# dependency graph, and package exports in an isolated consumer. Reuse the
# Actions-restored pnpm content-addressed store so the check is deterministic
# and does not cold-resolve the same DSH graph through an unrelated npm cache.
# Third-party lifecycle/native install scripts are intentionally excluded here;
# the published DSH compatibility lane below owns that separate failure domain.
pnpm add --save-exact --prefer-offline --ignore-scripts "${ALL_TARBALLS[@]}"

stage "verify packed package exports"
node -e "import('@dshelm/core').then(m => { if (!m.resolvePolicy) process.exit(1) })"
node -e "import('@dshelm/model-knowledge').then(m => { if (!m.knowledgeBundleFromAhiSummaries) process.exit(1) })"
node -e "import('@dshelm/dsh').then(m => { if (!m.DSHelmPolicyService) process.exit(1) })"
node -e "if (!require.resolve('dshelm').endsWith('/dist/index.js')) process.exit(1)"
CLI_BIN="$FRESH_DIR/node_modules/dshelm/dist/index.js"
test -f "$CLI_TGZ"

stage "verify client bundle"
node "$ROOT/scripts/verify-client-bundle.js"
echo "qa:pack-install OK"

if [[ "$WITH_DSH_RELEASE" != true ]]; then
  exit 0
fi

DSH_VERSION="$(node -e "const c=require('$ROOT/compatibility.json'); if(typeof c.tested?.dshPackages!=='string'||!c.tested.dshPackages) process.exit(1); process.stdout.write(c.tested.dshPackages)")"
mkdir -p "$DSH_CLI_DIR"
stage "install external DSH compatibility target ($DSH_VERSION)"
# The published DSH CLI has a large, partly native dependency graph. Keep it
# isolated from the package-closure gate and explicitly review every package
# allowed to execute an install script. Version matchers intentionally make
# upstream semver drift fail closed instead of granting future versions script
# execution automatically.
printf '{"private":true}\n' > "$DSH_CLI_DIR/package.json"
cat > "$DSH_CLI_DIR/pnpm-workspace.yaml" <<'YAML'
allowBuilds:
  '@deepseek-ai/dsh-subprocess-local@0.1.0-rc.8': true
  '@google/genai@1.52.0': true
  'koffi@3.2.0': true
  'node-pty@1.2.0-beta.15': true
  'protobufjs@7.6.6': true
YAML
pnpm --dir "$DSH_CLI_DIR" add --save-exact --prefer-offline "@deepseek-ai/dsh@$DSH_VERSION"
test -x "$DSH_CLI_DIR/node_modules/.bin/dsh"

stage "run published DSH clean-install journey"
bash "$ROOT/scripts/qa-clean-install.sh" \
  "$CLI_BIN" \
  "$CORE_TGZ" \
  "$MODEL_KNOWLEDGE_TGZ" \
  "$DSH_TGZ" \
  "$DSH_CLI_DIR/node_modules/.bin/dsh"

echo "qa:dsh-release-compat OK (DSH $DSH_VERSION)"

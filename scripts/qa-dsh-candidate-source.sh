#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

stage() {
  printf '\n==> qa:dsh-candidate-source: %s\n' "$1"
}

CANDIDATE_VERSION="$(node - <<'NODE'
const fs = require('node:fs')
const manifest = JSON.parse(fs.readFileSync('compatibility-candidates.json', 'utf8'))
const candidate = manifest.candidates.find((item) => item.runtime === '@deepseek-ai/dsh' && item.state !== 'ready')
if (!candidate?.version) throw new Error('no active @deepseek-ai/dsh candidate')
process.stdout.write(candidate.version)
NODE
)"
TESTED_VERSION="$(node -e "const c=require('./compatibility.json'); process.stdout.write(c.tested.dshPackages)")"

if [[ "$CANDIDATE_VERSION" == "$TESTED_VERSION" ]]; then
  echo "candidate must differ from tested baseline ($TESTED_VERSION)" >&2
  exit 1
fi

stage "prepare transient package graph for DSH $CANDIDATE_VERSION"
node - "$CANDIDATE_VERSION" <<'NODE'
const fs = require('node:fs')
const candidate = process.argv[2]

function read(path) { return JSON.parse(fs.readFileSync(path, 'utf8')) }
function write(path, value) { fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`) }
function pinDshDependencies(manifest) {
  for (const bucket of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = manifest[bucket]
    if (!deps) continue
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@deepseek-ai/dsh-')) deps[name] = candidate
    }
  }
}

// Qualify the plugin inside the exact published DSH host cohort. Current DSH
// prerelease packages publish workspace peers as stable-looking ranges such as
// `>=0.1.5 <0.2.0-0`; those ranges do not themselves select 0.1.5-rc.1 from
// the `next` dist-tag. A real DSH installation provides those peers through
// the host package graph, so the transient workspace must model that host
// rather than asking pnpm to invent a future stable peer.
const rootPath = 'package.json'
const root = read(rootPath)
root.devDependencies ??= {}
root.devDependencies['@deepseek-ai/dsh'] = candidate
write(rootPath, root)

const dshPath = 'packages/dsh/package.json'
const dsh = read(dshPath)
pinDshDependencies(dsh)
for (const obsolete of [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-slots',
]) delete dsh.dependencies?.[obsolete]
dsh.dependencies['@deepseek-ai/dsh-api-session-controller'] = candidate
dsh.dependencies['@deepseek-ai/dsh-client-ui-renderer'] = candidate
dsh.dsh.client.inject = [
  '@deepseek-ai/dsh-api-session-controller',
  '@deepseek-ai/dsh-client-ui-renderer',
]
write(dshPath, dsh)

const cliPath = 'packages/cli/package.json'
const cli = read(cliPath)
pinDshDependencies(cli)
// DSH 0.1.5's pi-ai adapter and upstream workspace are qualified on 0.85.1;
// DSHelm CLI directly consumes providers/all for OAuth discovery, so the
// transient graph aligns that direct dependency instead of testing a mixed
// 0.82.1/0.85.1 catalog generation.
cli.dependencies['@earendil-works/pi-ai'] = '0.85.1'
write(cliPath, cli)
NODE

stage "seed exact candidate release-age exclusions"
# The repository intentionally reviews fresh dependencies before allowing them
# into the verified graph. This candidate lane has a different purpose: inspect
# the exact, explicitly selected same-day DSH prerelease. pnpm can auto-add new
# package names to minimumReleaseAgeExclude during a non-frozen install, but
# names already represented by an older verified-version entry are not always
# duplicated for the candidate. Add only those exact candidate counterparts in
# this disposable checkout. Never disable minimum-release-age globally and
# never use a wildcard that would approve future DSH versions.
node - "$TESTED_VERSION" "$CANDIDATE_VERSION" <<'NODE'
const fs = require('node:fs')
const [tested, candidate] = process.argv.slice(2)
const path = 'pnpm-workspace.yaml'
const input = fs.readFileSync(path, 'utf8')
const lines = input.split('\n')
const escaped = tested.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pattern = new RegExp(`^(\\s*-\\s*['\"]?)(@deepseek-ai/dsh-[^@'\"]+)@${escaped}(['\"]?\\s*)$`)
const candidates = []
for (const line of lines) {
  const match = line.match(pattern)
  if (match) candidates.push(`${match[1]}${match[2]}@${candidate}${match[3]}`)
}
if (candidates.length === 0) throw new Error(`no verified DSH release-age exclusions found for ${tested}`)

// Insert the candidate entries at the end of minimumReleaseAgeExclude instead
// of appending them at EOF, where YAML would interpret them as belonging to a
// later top-level key if one is added in the future.
const keyIndex = lines.findIndex((line) => line.trim() === 'minimumReleaseAgeExclude:')
if (keyIndex < 0) throw new Error('minimumReleaseAgeExclude section missing')
let end = keyIndex + 1
while (end < lines.length && (lines[end].trim() === '' || /^\s+-\s/.test(lines[end]))) end += 1
const existing = new Set(lines.slice(keyIndex + 1, end).map((line) => line.trim()))
const additions = candidates.filter((line) => !existing.has(line.trim()))
lines.splice(end, 0, ...additions)
fs.writeFileSync(path, lines.join('\n'))
console.log(`seeded ${additions.length} exact ${candidate} release-age exclusions`)
NODE

stage "resolve transient candidate graph"
# The committed lockfile and package manifests remain the verified rc.7 graph.
# This install mutates only the disposable Actions checkout. Lifecycle/native
# scripts are excluded: this lane proves package availability + source/type
# compatibility; clean runtime installation is a separate evidence gate.
pnpm install --no-frozen-lockfile --ignore-scripts

stage "assert candidate graph is coherent"
node - "$CANDIDATE_VERSION" <<'NODE'
const fs = require('node:fs')
const candidate = process.argv[2]
const root = JSON.parse(fs.readFileSync('package.json', 'utf8'))
if (root.devDependencies?.['@deepseek-ai/dsh'] !== candidate) {
  throw new Error(`root host=${root.devDependencies?.['@deepseek-ai/dsh']}, expected ${candidate}`)
}
for (const path of ['packages/dsh/package.json', 'packages/cli/package.json']) {
  const manifest = JSON.parse(fs.readFileSync(path, 'utf8'))
  for (const bucket of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(manifest[bucket] ?? {})) {
      if (name.startsWith('@deepseek-ai/dsh-') && version !== candidate) {
        throw new Error(`${path}: ${name}=${version}, expected ${candidate}`)
      }
    }
  }
}
const dsh = JSON.parse(fs.readFileSync('packages/dsh/package.json', 'utf8'))
if (dsh.dependencies['@deepseek-ai/dsh-client-runtime']) throw new Error('legacy dsh-client-runtime survived candidate transform')
const expectedInject = ['@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-client-ui-renderer']
if (JSON.stringify(dsh.dsh.client.inject) !== JSON.stringify(expectedInject)) {
  throw new Error(`unexpected current client inject graph: ${JSON.stringify(dsh.dsh.client.inject)}`)
}
NODE

stage "typecheck candidate workspace"
pnpm typecheck
stage "build candidate workspace"
pnpm build
stage "run compatibility-sensitive contracts"
pnpm vitest run \
  packages/dsh/tests/dsh-request-contract.test.ts \
  packages/dsh/tests/host-composition.test.ts \
  packages/dsh/tests/vertical-slice.test.ts \
  packages/dsh/tests/keyless-vertical-slice.test.ts \
  packages/dsh/tests/session-log-compat.test.ts \
  packages/dsh/tests/subagent-015-compat.test.ts \
  packages/dsh/tests/client-native-panel.test.ts \
  packages/model-knowledge/tests/knowledge.test.ts \
  packages/cli/tests/user-commands.test.ts
stage "verify built client artifact"
node scripts/verify-client-bundle.js

echo "qa:dsh-candidate-source OK (candidate $CANDIDATE_VERSION; tested baseline remains $TESTED_VERSION)"

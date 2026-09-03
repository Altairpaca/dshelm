import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const graph = JSON.parse(readFileSync('release-packages.json', 'utf8'))
const root = JSON.parse(readFileSync('package.json', 'utf8'))
const failures = []

if (graph.schemaVersion !== 1) failures.push('release-packages.json: schemaVersion must be 1')
if (!Array.isArray(graph.packages) || graph.packages.length === 0) {
  failures.push('release-packages.json: packages must be a non-empty array')
}

const graphEntries = Array.isArray(graph.packages) ? graph.packages : []
const names = graphEntries.map((entry) => entry.name)
const directories = graphEntries.map((entry) => entry.directory)
if (new Set(names).size !== names.length) failures.push('release-packages.json: package names must be unique')
if (new Set(directories).size !== directories.length) failures.push('release-packages.json: package directories must be unique')

const workspacePackageDirs = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join('packages', entry.name, 'package.json')))
  .map((entry) => `packages/${entry.name}`)
  .sort()
const graphPackageDirs = [...directories].sort()
if (JSON.stringify(workspacePackageDirs) !== JSON.stringify(graphPackageDirs)) {
  failures.push(
    `release-packages.json: package directories must match packages/* workspaces; workspace=${workspacePackageDirs.join(', ')} graph=${graphPackageDirs.join(', ')}`,
  )
}

const manifests = []
for (const entry of graphEntries) {
  if (typeof entry.name !== 'string' || entry.name.length === 0) {
    failures.push('release-packages.json: every package requires a non-empty name')
    continue
  }
  if (typeof entry.directory !== 'string' || !existsSync(join(entry.directory, 'package.json'))) {
    failures.push(`release-packages.json: ${entry.name} has invalid directory ${entry.directory ?? '<missing>'}`)
    continue
  }
  const manifest = JSON.parse(readFileSync(join(entry.directory, 'package.json'), 'utf8'))
  manifests.push({ entry, manifest })
}

const internalNames = new Set(manifests.map(({ manifest }) => manifest.name))
const releaseIndex = new Map(graphEntries.map((entry, index) => [entry.name, index]))

for (const { entry, manifest } of manifests) {
  const dir = entry.directory
  const fail = (message) => failures.push(`${dir}/package.json: ${message}`)

  if (manifest.name !== entry.name) fail(`name ${manifest.name ?? '<missing>'} does not match release graph ${entry.name}`)
  if (manifest.version !== root.version) fail(`version ${manifest.version ?? '<missing>'} does not match workspace ${root.version}`)
  if (typeof manifest.description !== 'string' || manifest.description.trim().length < 12) fail('missing useful description')
  if (manifest.license !== 'Apache-2.0') fail('license must be Apache-2.0')
  if (manifest.private === true) fail('publishable package must not be private')

  if (manifest.repository?.type !== 'git') fail('repository.type must be git')
  if (manifest.repository?.url !== 'https://github.com/Altairpaca/dshelm.git') fail('repository.url must point to the canonical repository')
  if (manifest.repository?.directory !== dir) fail(`repository.directory must be ${dir}`)
  if (manifest.homepage !== 'https://github.com/Altairpaca/dshelm#readme') fail('homepage must point to the project README')
  if (manifest.bugs?.url !== 'https://github.com/Altairpaca/dshelm/issues') fail('bugs.url must point to GitHub Issues')

  if (manifest.engines?.node !== '>=22.19.0') fail('engines.node must match the supported Node baseline')
  if (manifest.publishConfig?.access !== 'public') fail('publishConfig.access must be public')
  if (!Array.isArray(manifest.files) || !manifest.files.includes('dist')) fail('files must include dist to keep the published surface bounded')
  if (!existsSync(join(dir, 'README.md'))) fail('package-level README.md is required for the npm landing page')

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dependency, range] of Object.entries(manifest[section] ?? {})) {
      if (!internalNames.has(dependency)) continue
      if (range !== 'workspace:*') fail(`${section}.${dependency} must use workspace:* before packing`)
      if ((releaseIndex.get(dependency) ?? Infinity) >= (releaseIndex.get(manifest.name) ?? -1)) {
        fail(`${section}.${dependency} must appear earlier in release-packages.json publish order`)
      }
    }
  }
}

const cli = manifests.find(({ manifest }) => manifest.name === 'dshelm')?.manifest
if (cli?.bin?.dshelm !== './dist/index.js') failures.push('packages/cli/package.json: bin.dshelm must point to ./dist/index.js')

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`package metadata OK (${manifests.length} publishable packages @ ${root.version}; release order verified)`)

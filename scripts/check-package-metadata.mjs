import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const packageDirs = [
  'packages/auth',
  'packages/cli',
  'packages/compat-omo',
  'packages/core',
  'packages/dsh',
  'packages/model-knowledge',
]

const root = JSON.parse(readFileSync('package.json', 'utf8'))
const manifests = packageDirs.map((dir) => ({
  dir,
  manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')),
}))

const internalNames = new Set(manifests.map(({ manifest }) => manifest.name))
const failures = []

for (const { dir, manifest } of manifests) {
  const fail = (message) => failures.push(`${dir}/package.json: ${message}`)

  if (!manifest.name) fail('missing name')
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
      if (internalNames.has(dependency) && range !== 'workspace:*') {
        fail(`${section}.${dependency} must use workspace:* before packing`)
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

console.log(`package metadata OK (${manifests.length} publishable packages @ ${root.version})`)

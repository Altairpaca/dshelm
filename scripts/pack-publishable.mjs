import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { parse, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const rawDestination = process.argv[2] === '--' ? process.argv[3] : process.argv[2]
const destination = resolve(rawDestination ?? '.release-pack')
const repositoryRoot = resolve('.')
const graph = JSON.parse(readFileSync('release-packages.json', 'utf8'))
const root = JSON.parse(readFileSync('package.json', 'utf8'))

if (graph.schemaVersion !== 1 || !Array.isArray(graph.packages) || graph.packages.length === 0) {
  throw new Error('release-packages.json must contain schemaVersion=1 and a non-empty packages array')
}

if (destination === repositoryRoot || destination === parse(destination).root) {
  throw new Error(`refusing unsafe pack destination: ${destination}`)
}
if (existsSync(destination)) {
  const existing = readdirSync(destination)
  if (existing.length > 0) {
    throw new Error(`pack destination must be empty: ${destination} contains ${existing.length} entries`)
  }
} else {
  mkdirSync(destination, { recursive: true })
}

const packed = []
for (const entry of graph.packages) {
  const manifest = JSON.parse(readFileSync(`${entry.directory}/package.json`, 'utf8'))
  if (manifest.name !== entry.name) {
    throw new Error(`${entry.directory}/package.json name ${manifest.name ?? '<missing>'} does not match release graph ${entry.name}`)
  }
  if (manifest.version !== root.version) {
    throw new Error(`${entry.name} version ${manifest.version ?? '<missing>'} does not match workspace ${root.version}`)
  }

  const before = new Set(readdirSync(destination))
  const result = spawnSync(
    'pnpm',
    ['--filter', entry.name, 'pack', '--pack-destination', destination],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`pnpm pack failed for ${entry.name} with exit ${result.status ?? 'unknown'}`)
  }

  const created = readdirSync(destination).filter((file) => file.endsWith('.tgz') && !before.has(file))
  if (created.length !== 1) {
    throw new Error(`expected exactly one tarball for ${entry.name}; created ${created.length}: ${created.join(', ') || '<none>'}`)
  }

  packed.push({
    name: entry.name,
    directory: entry.directory,
    version: manifest.version,
    tarball: resolve(destination, created[0]),
  })
}

const output = {
  schemaVersion: 1,
  workspaceVersion: root.version,
  generatedAt: new Date().toISOString(),
  packages: packed,
}
const manifestPath = resolve(destination, 'pack-manifest.json')
writeFileSync(manifestPath, `${JSON.stringify(output, null, 2)}\n`)

console.log(`packed ${packed.length} publishable packages @ ${root.version}`)
console.log(manifestPath)

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  const args = { mode: 'dry-run', tag: 'alpha', report: 'npm-release-report.json' }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    if (key === '--manifest') { args.manifest = value; i += 1; continue }
    if (key === '--mode') { args.mode = value; i += 1; continue }
    if (key === '--tag') { args.tag = value; i += 1; continue }
    if (key === '--confirm-version') { args.confirmVersion = value; i += 1; continue }
    if (key === '--report') { args.report = value; i += 1; continue }
    throw new Error(`unknown argument: ${key}`)
  }
  if (!args.manifest) throw new Error('--manifest is required')
  if (!['dry-run', 'publish'].includes(args.mode)) throw new Error('--mode must be dry-run or publish')
  if (!/^[a-zA-Z0-9._-]+$/.test(args.tag)) throw new Error('--tag contains unsupported characters')
  return args
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
  })
  if (result.error) throw result.error
  return result
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`could not parse ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const canonicalRepositoryUrls = new Set([
  'https://github.com/Altairpaca/dshelm.git',
  'git+https://github.com/Altairpaca/dshelm.git',
])

function registryMetadata(name, version) {
  const spec = `${name}@${version}`
  const versionResult = run('npm', ['view', spec, 'version', '--json'], { capture: true })
  if (versionResult.status !== 0) return undefined
  const registryVersion = parseJsonOutput(versionResult, `npm view version output for ${spec}`)
  const repositoryResult = run('npm', ['view', spec, 'repository.url', '--json'], { capture: true })
  if (repositoryResult.status !== 0) {
    throw new Error(`${spec} exists but repository.url could not be read; refusing to resume across an unverifiable package`)
  }
  const repositoryUrl = parseJsonOutput(repositoryResult, `npm view repository.url output for ${spec}`)
  return { version: registryVersion, repositoryUrl }
}

function assertExistingPackageIsOurs(entry, metadata) {
  if (metadata?.version !== entry.version) {
    throw new Error(`registry returned unexpected version for ${entry.name}: ${metadata?.version ?? '<missing>'}`)
  }
  if (typeof metadata.repositoryUrl !== 'string' || !canonicalRepositoryUrls.has(metadata.repositoryUrl)) {
    throw new Error(`${entry.name}@${entry.version} already exists with unexpected repository ${metadata.repositoryUrl ?? '<missing>'}`)
  }
}

function waitForRegistry(entry) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const metadata = registryMetadata(entry.name, entry.version)
    if (metadata !== undefined) {
      assertExistingPackageIsOurs(entry, metadata)
      return metadata
    }
    if (attempt < 8) sleep(5_000)
  }
  throw new Error(`${entry.name}@${entry.version} was published but did not become visible in the registry within 35 seconds`)
}

const args = parseArgs(process.argv.slice(2))
const root = JSON.parse(readFileSync('package.json', 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(args.manifest), 'utf8'))
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.packages) || manifest.packages.length === 0) {
  throw new Error('pack manifest must contain schemaVersion=1 and a non-empty packages array')
}
if (manifest.workspaceVersion !== root.version) {
  throw new Error(`pack manifest version ${manifest.workspaceVersion} does not match workspace ${root.version}`)
}
if (args.mode === 'publish' && args.confirmVersion !== root.version) {
  throw new Error(`publish requires --confirm-version ${root.version}`)
}

const reportPath = resolve(args.report)
const report = {
  schemaVersion: 1,
  mode: args.mode,
  tag: args.tag,
  version: root.version,
  startedAt: new Date().toISOString(),
  packages: [],
}
function persistReport() {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}
persistReport()

for (const entry of manifest.packages) {
  if (entry.version !== root.version) throw new Error(`${entry.name} tarball version ${entry.version} does not match ${root.version}`)
  const tarball = resolve(entry.tarball)
  const existing = registryMetadata(entry.name, entry.version)

  if (args.mode === 'dry-run') {
    if (existing !== undefined) {
      assertExistingPackageIsOurs(entry, existing)
      report.packages.push({ name: entry.name, version: entry.version, action: 'already-published' })
      persistReport()
      console.log(`==> ${entry.name}@${entry.version}: already published by this repository`)
      continue
    }
    console.log(`==> ${entry.name}@${entry.version}: npm publish --dry-run`)
    const dryRun = run('npm', ['publish', tarball, '--dry-run', '--access', 'public', '--tag', args.tag])
    if (dryRun.status !== 0) throw new Error(`npm publish --dry-run failed for ${entry.name}`)
    report.packages.push({ name: entry.name, version: entry.version, action: 'dry-run-ok' })
    persistReport()
    continue
  }

  if (existing !== undefined) {
    assertExistingPackageIsOurs(entry, existing)
    console.log(`==> ${entry.name}@${entry.version}: already published; resuming after it`)
    report.packages.push({ name: entry.name, version: entry.version, action: 'already-published' })
    persistReport()
    continue
  }

  console.log(`==> ${entry.name}@${entry.version}: publishing with dist-tag ${args.tag}`)
  const published = run('npm', ['publish', tarball, '--access', 'public', '--tag', args.tag])
  if (published.status !== 0) throw new Error(`npm publish failed for ${entry.name}`)
  const pending = { name: entry.name, version: entry.version, action: 'publish-command-ok-awaiting-registry' }
  report.packages.push(pending)
  persistReport()
  waitForRegistry(entry)
  pending.action = 'published'
  persistReport()
}

report.completedAt = new Date().toISOString()
persistReport()
console.log(`npm release ${args.mode} completed for ${manifest.packages.length} packages @ ${root.version}`)

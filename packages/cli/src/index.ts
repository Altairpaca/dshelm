/**
 * dshelm doctor — environment + distribution diagnostics.
 *
 * Reports: DSH/Cordis/DSHelm versions, installed ecosystem capabilities,
 * a keyless runtime seam probe (policy resolution, exact-model validation,
 * reasoning efforts, host service, projection), provider/model support,
 * OmO workspace presence, and known upstream blockers.
 *
 * Exit codes: 0 = usable, 1 = hard failure (DSHelm itself broken or probe
 * failed). PARTIAL/BLOCKED rows never fail the run by themselves.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { type PolicyDocument } from '@dshelm/core'
import { DSHelmPolicyService, dshelmControlPlaneProjection } from '@dshelm/dsh'
import { authCommand, explainCommand, initCommand, knowledgeCommand, modelsCommand, uninstallCommand } from './command-handlers.ts'

const require = createRequire(import.meta.url)

type Row = { check: string; status: 'OK' | 'PARTIAL' | 'BLOCKED' | 'FAIL' | 'INFO'; detail: string }

function pkgVersion(spec: string): string | undefined {
  try {
    const pkg = require(spec + '/package.json') as { version?: string }
    return pkg.version
  } catch {
    return undefined
  }
}

function sh(command: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync(command, args, { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, out: out.trim() }
  } catch (error) {
    return { ok: false, out: String((error as { stderr?: Buffer }).stderr ?? '') }
  }
}

/** Probe adapter: every model valid, reasoning efforts exposed. */
class ProbeAdapter extends LlmAdapter {
  override providerInfo(provider: string) { return { id: provider, name: provider } }
  override listModels() {
    return Promise.resolve([
      { provider: 'dshelm-probe', id: 'probe-pro', name: 'Probe Pro' },
      { provider: 'dshelm-probe', id: 'probe-flash', name: 'Probe Flash' },
    ])
  }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: { efforts: [{ id: 'off' as never, name: 'Off' }, { id: 'high' as never, name: 'High' }], defaultEffort: 'off' as never },
    })
  }
  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    const text = 'probe'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 5 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const probePolicy: PolicyDocument = {
  profiles: {
    planner: { id: 'planner', reasoning: 'high', candidates: [{ provider: 'dshelm-probe', model: 'probe-pro' }] },
  },
  agents: { planner: { id: 'planner', role: 'planner', profile: 'planner' } },
  categories: { plan: { id: 'plan', agent: 'planner' } },
}

async function probeRuntime(): Promise<{ rows: Row[]; failed: boolean }> {
  const rows: Row[] = []
  let failed = false
  try {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SystemPrompt, { persona: '' })
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SessionProjectionRegistry)
    ctx.llm.registerAdapter(['dshelm-probe'], new ProbeAdapter())
    const service = new DSHelmPolicyService(ctx, { layers: () => ({ defaults: probePolicy as unknown as Record<string, unknown> }), llm: ctx.llm })
    rows.push({ check: 'Host service (dshelm.policy)', status: 'OK', detail: 'registered and resolving' })
    const resolved = await service.resolve({ category: 'plan' })
    rows.push({
      check: 'Policy resolution + Resolution Trace',
      status: 'OK',
      detail: `category=plan → ${resolved.provider}/${resolved.model} reasoning=${resolved.reasoning ?? 'default'} candidates=${resolved.trace.candidates.length}`,
    })
    const info = await ctx.llm.resolveModelInfo('dshelm-probe', 'probe-pro')
    const efforts = info.reasoning?.efforts.map((e) => e.id).join(',') ?? 'none'
    rows.push({ check: 'Exact-model validation (resolveModelInfo)', status: 'OK', detail: `probe-pro valid; reasoning efforts: ${efforts}` })
    const session = ctx.sessions.create(SessionId('dshelm-doctor-probe'))
    const disposeProjection = ctx.sessionProjections.register(dshelmControlPlaneProjection)
    const snapshot = {
      version: 1 as const,
      request: { category: 'plan' },
      roles: [{ role: 'planner', category: 'plan', agent: 'planner', profile: 'planner', provider: 'dshelm-probe', model: 'probe-pro' }],
      inspector: { request: 'plan', trace: resolved.trace },
      source: 'host:doctor',
    }
    session.append('dshelm/control-plane', snapshot)
    const cut = ctx.sessionProjections.snapshot(session)
    rows.push({
      check: 'Host→client projection transport',
      status: cut.values['dshelm.controlPlane'] === undefined ? 'FAIL' : 'OK',
      detail: cut.values['dshelm.controlPlane'] === undefined ? 'projection value missing' : 'dshelm.controlPlane folded',
    })
    disposeProjection()
  } catch (error) {
    failed = true
    rows.push({ check: 'Runtime probe', status: 'FAIL', detail: error instanceof Error ? error.message : String(error) })
  }
  return { rows, failed }
}

export async function doctor(): Promise<number> {
  const rows: Row[] = []
  let failed = false

  // Versions
  const dshCli = sh('dsh', ['--version'])
  rows.push({
    check: 'DSH CLI',
    status: dshCli.ok ? 'OK' : 'BLOCKED',
    detail: dshCli.ok ? dshCli.out : 'dsh CLI not on PATH (' + (dshCli.out.split('\n')[0] ?? '') + ')',
  })
  const dshPackage = pkgVersion('@deepseek-ai/dsh-llm')
  rows.push({ check: 'DSH package runtime', status: dshPackage === undefined ? 'BLOCKED' : 'OK', detail: dshPackage ?? 'not installed' })
  rows.push({ check: 'Cordis', status: pkgVersion('@deepseek-ai/cordis') === undefined ? 'BLOCKED' : 'OK', detail: pkgVersion('@deepseek-ai/cordis') ?? 'not installed' })
  rows.push({ check: 'DSHelm Core', status: pkgVersion('@dshelm/core') === undefined ? 'FAIL' : 'OK', detail: pkgVersion('@dshelm/core') ?? 'not installed' })
  rows.push({ check: 'DSHelm DSH adapter', status: pkgVersion('@dshelm/dsh') === undefined ? 'FAIL' : 'OK', detail: pkgVersion('@dshelm/dsh') ?? 'not installed' })
  if (pkgVersion('@dshelm/core') === undefined || pkgVersion('@dshelm/dsh') === undefined) failed = true

  // Ecosystem capabilities
  const agentTeams = pkgVersion('@nanmicoder/dsh-agent-teams')
  rows.push({ check: 'AgentTeams', status: agentTeams === undefined ? 'INFO' : 'OK', detail: agentTeams === undefined ? 'not installed (optional backend)' : agentTeams })
  const memory = pkgVersion('@deepseek-ai/dsh-mneme') ?? pkgVersion('@deepseek-ai/dsh-context')
  rows.push({ check: 'Memory provider', status: memory === undefined ? 'INFO' : 'OK', detail: memory ?? 'none installed (one active source recommended)' })
  const omoDir = join(homedir(), '.omo')
  rows.push({ check: 'OmO workspace (~/.omo)', status: existsSync(omoDir) ? 'PARTIAL' : 'INFO', detail: existsSync(omoDir) ? 'present — migration candidate (read-only)' : 'absent' })
  rows.push({
    check: 'DSH Web client runtime',
    status: 'PARTIAL',
    detail: `client bundles require the DSH Web shell; ${dshPackage ?? 'DSH package'} client runtime published (no dsh-compact dep) — see verified-stack.md`,
  })
  rows.push({ check: 'Sisyphus presets', status: 'PARTIAL', detail: 'SUL-1.0 reference; detect/support, never copy (source-ledger.md)' })
  rows.push({ check: 'Oh-My-DSH', status: 'PARTIAL', detail: 'capability library, unlicensed → reference only (source-ledger.md)' })

  // Runtime probe
  const probe = await probeRuntime()
  rows.push(...probe.rows)
  if (probe.failed) failed = true

  // Output
  const width = Math.max(...rows.map((row) => row.check.length + 2))
  console.log('DSHelm doctor\n')
  for (const row of rows) {
    const icon = row.status === 'OK' ? '✓' : row.status === 'PARTIAL' ? '◐' : row.status === 'BLOCKED' ? '⛔' : row.status === 'FAIL' ? '✗' : '·'
    console.log(`${icon} ${row.check.padEnd(width)} ${row.status.padEnd(8)} ${row.detail}`)
  }
  console.log(`\nResult: ${failed ? 'FAILURES PRESENT' : 'usable'} (PARTIAL/BLOCKED rows are informational)`)
  return failed ? 1 : 0
}

import { migrateOmo, parseOmoConfigFile, renderReport } from '@dshelm/compat-omo'

/** dshelm migrate omo — read-only OmO config migration (dry-run by default). */
async function migrateOmoCommand(args: string[]): Promise<number> {
  const configIndex = args.indexOf('--config')
  const configPath = configIndex >= 0 ? args[configIndex + 1] ?? '' : join(homedir(), '.omo', 'omo.jsonc')
  const write = args.includes('--write')
  const outIndex = args.indexOf('--out')
  const outPath = outIndex >= 0 ? args[outIndex + 1] ?? '.dshelm/config.jsonc' : '.dshelm/config.jsonc'
  if (!existsSync(configPath)) {
    console.error(`migrate: OmO config not found at ${configPath} (pass --config <path>)`)
    return 1
  }
  const doc = await parseOmoConfigFile(configPath)
  const { policy, report } = migrateOmo(doc, configPath)
  console.log(renderReport(report))
  if (!write) {
    console.log('\nDry run — nothing written. Re-run with --write to emit ' + outPath)
    return 0
  }
  if (existsSync(outPath)) {
    console.error(`migrate: refusing to overwrite existing ${outPath} (merge is a later increment)`)
    return 1
  }
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(outPath.slice(0, outPath.lastIndexOf('/')), { recursive: true })
  writeFileSync(outPath, JSON.stringify(policy, null, 2) + '\n')
  console.log(`Wrote ${outPath} (${report.counts.SUPPORTED + report.counts.MAPPED} mapped entities)`)
  return 0
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const rest = process.argv.slice(3)
  if (command === 'doctor') {
    process.exitCode = await doctor()
    return
  }
  if (command === 'migrate' && rest[0] === 'omo') {
    process.exitCode = await migrateOmoCommand(rest.slice(1))
    return
  }
  if (command === 'auth') {
    process.exitCode = await authCommand(rest)
    return
  }
  if (command === 'models') {
    process.exitCode = modelsCommand(rest)
    return
  }
  if (command === 'explain') {
    process.exitCode = await explainCommand(rest[0])
    return
  }
  if (command === 'knowledge') {
    process.exitCode = knowledgeCommand(rest)
    return
  }
  if (command === 'init') {
    process.exitCode = await initCommand(rest)
    return
  }
  if (command === 'uninstall') {
    process.exitCode = await uninstallCommand(rest)
    return
  }
  console.log('DSHelm CLI\n\nUsage: dshelm init [--yes] | dshelm uninstall --yes [--purge-credentials] | dshelm auth <list|status|login|logout> [resource] | dshelm models <inspect|explain> [provider/model] | dshelm explain <provider>/<model> | dshelm knowledge status | dshelm doctor | dshelm migrate omo [--config <path>] [--write] [--out <path>]\n')
}

await main()

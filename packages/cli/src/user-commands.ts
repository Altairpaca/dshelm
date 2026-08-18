import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { rm, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { defaultCredentialStorePath } from '@dshelm/auth'
import type { AuthProbeContext, AuthRegistry, AuthStatusResult } from '@dshelm/auth'
import { formatAuthStatus } from './auth-discovery.ts'
import { BASELINE_KNOWLEDGE_BUNDLE, explainModel, knowledgeStatus, type EvidenceLayer, type KnowledgeBundle } from '@dshelm/model-knowledge'

export type InitProfile = {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly dsh: { readonly available: boolean; readonly version: string | null }
  readonly dshProfile: { readonly path: string; readonly bundles: readonly string[] }
  readonly auth: readonly {
    readonly resourceId: string
    readonly product: string
    readonly methodId: string
    readonly status: AuthStatusResult['status']
    readonly authOwner: AuthStatusResult['authOwner']
    readonly detail: string
  }[]
  readonly topology: {
    readonly strategy: 'resource-aware'
    readonly authenticatedResources: readonly string[]
    readonly executionLanes: readonly {
      readonly name: 'coordinator' | 'parallel-worker' | 'verifier'
      readonly candidateResources: readonly string[]
    }[]
  }
}

export type CommandContext = {
  readonly cwd: string
  readonly now: () => Date
}

const evidenceLayers = ['runtime', 'official', 'community', 'empirical'] as const satisfies readonly EvidenceLayer[]

const initProfileSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  dsh: z.object({ available: z.boolean(), version: z.string().nullable() }),
  dshProfile: z.object({ path: z.string(), bundles: z.array(z.string()) }),
  auth: z.array(z.object({
    resourceId: z.string(),
    product: z.string(),
    methodId: z.string(),
    status: z.enum(['available', 'authenticated', 'expired', 'action-required', 'unsupported', 'unknown']),
    authOwner: z.enum(['dshelm', 'provider', 'product', 'host', 'gateway', 'none']),
    detail: z.string(),
  })),
  topology: z.object({
    strategy: z.literal('resource-aware'),
    authenticatedResources: z.array(z.string()),
    executionLanes: z.array(z.object({
      name: z.enum(['coordinator', 'parallel-worker', 'verifier']),
      candidateResources: z.array(z.string()),
    })),
  }),
})

export function authLines(statuses: readonly AuthStatusResult[]): readonly string[] {
  return statuses.map(formatAuthStatus)
}

export function modelInspectLines(bundle: KnowledgeBundle): readonly string[] {
  return bundle.records.map((record) => {
    const runtime = record.hard.runtimeReady === true ? 'runtime-ready' : 'knowledge-only'
    const layers = [...new Set(record.evidence.map((evidence) => evidence.layer))].sort().join(',')
    return `${record.provider}/${record.model} ${runtime} evidence=${layers} ${record.displayName}`
  })
}

export function modelExplainLines(bundle: KnowledgeBundle, reference: string): readonly string[] {
  const separator = reference.indexOf('/')
  if (separator <= 0 || separator === reference.length - 1) return [`invalid model reference "${reference}"; expected <provider>/<model>`]
  const provider = reference.slice(0, separator)
  const model = reference.slice(separator + 1)
  const explanation = explainModel(bundle, provider, model)
  if (!explanation.found) return [`${reference}: no evidence record`]
  const layers = evidenceLayers
    .map((layer) => ({ layer, ids: explanation.evidenceByLayer[layer] }))
    .filter((entry) => entry.ids.length > 0)
    .map((entry) => `${entry.layer}=${entry.ids.join(',')}`)
    .join(' ')
  return [
    `${reference} ${explanation.displayName}`,
    `hard=${JSON.stringify(explanation.hard)}`,
    `evidence=${layers || 'none'}`,
    `adaptationHints=${explanation.adaptationHints.length}`,
  ]
}

export function knowledgeStatusLines(bundle: KnowledgeBundle, now: Date): readonly string[] {
  const status = knowledgeStatus(bundle, now)
  return [`knowledge=${status.status} records=${status.recordCount} staleEvidence=${status.staleEvidenceCount} remoteExecutableCode=${status.remoteExecutableCode}`]
}

function probeDsh() {
  try {
    const output = execFileSync('dsh', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 }).trim()
    if (output.length === 0) return { available: true, version: null }
    const version = output.split('\n')[0]
    return version === undefined ? { available: true, version: null } : { available: true, version }
  } catch (error) {
    if (error instanceof Error) return { available: false, version: null }
    throw error
  }
}

function makeTopology(statuses: readonly AuthStatusResult[]): InitProfile['topology'] {
  const authenticatedResources = [...new Set(statuses.filter((status) => status.status === 'authenticated').map((status) => status.resourceId))].sort()
  const lanes: InitProfile['topology']['executionLanes'] = [
    { name: 'coordinator', candidateResources: authenticatedResources },
    { name: 'parallel-worker', candidateResources: authenticatedResources },
    { name: 'verifier', candidateResources: authenticatedResources },
  ]
  return { strategy: 'resource-aware', authenticatedResources, executionLanes: lanes }
}

export async function initProfile(registry: AuthRegistry, probeContext: AuthProbeContext, context: CommandContext): Promise<{ readonly profile: InitProfile; readonly path: string; readonly written: boolean }> {
  const path = join(context.cwd, '.dshelm', 'profile.json')
  if (existsSync(path)) {
    const existing = initProfileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    return { profile: existing, path, written: false }
  }
  const statuses = await registry.status(probeContext)
  const profile: InitProfile = {
    schemaVersion: 1,
    generatedAt: context.now().toISOString(),
    dsh: probeDsh(),
    dshProfile: { path: join(context.cwd, '.dshelm', 'dsh-profile'), bundles: ['@deepseek-ai/dsh-base', '@dshelm/dsh'] },
    auth: statuses.map(({ resourceId, product, methodId, status, authOwner, detail }) => ({ resourceId, product, methodId, status, authOwner, detail })),
    topology: makeTopology(statuses),
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  mkdirSync(profile.dshProfile.path, { recursive: true, mode: 0o700 })
  writeFileSync(join(profile.dshProfile.path, 'package.json'), `${JSON.stringify({ name: 'dshelm-profile', private: true, dependencies: { '@dshelm/dsh': '0.3.0-alpha.0' }, dsh: { profile: { bundles: profile.dshProfile.bundles } } }, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  return { profile, path, written: true }
}

export async function uninstallProfile(context: { readonly cwd: string; readonly purgeCredentials: boolean }): Promise<{ readonly removedProfile: boolean; readonly removedCredentials: boolean }> {
  const directory = join(context.cwd, '.dshelm')
  const removedProfile = await removeFile(join(directory, 'profile.json'))
  await rm(join(directory, 'dsh-profile'), { recursive: true, force: true })
  const legacyPath = join(directory, 'credentials.json')
  const removedCredentials = context.purgeCredentials
    ? (await removeFile(defaultCredentialStorePath()) || await removeFile(legacyPath))
    : false
  return { removedProfile, removedCredentials }
}

async function removeFile(path: string): Promise<boolean> {
  try {
    await unlink(path)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

export const baselineKnowledge = BASELINE_KNOWLEDGE_BUNDLE

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { rm, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
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

export type DshProfileInstallOptions = {
  readonly profileName: string
  readonly profileDir: string
  readonly bundleSpecs: readonly string[]
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

export type DshProfileInstaller = (options: DshProfileInstallOptions) => Promise<void>

export type CommandContext = {
  readonly cwd: string
  readonly now: () => Date
  readonly env?: NodeJS.ProcessEnv
  readonly dshHome?: string
  readonly dshBundleSpec?: string
  readonly dshBundleSpecs?: readonly string[]
  readonly installDshProfile?: DshProfileInstaller
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
    `soft=${JSON.stringify(explanation.soft)}`,
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

const DSH_PROFILE_NAME = 'dshelm'
const DSH_BUNDLES = ['@deepseek-ai/dsh-base', '@dshelm/dsh'] as const
const DEFAULT_DSH_BUNDLE_SPEC = '@dshelm/dsh@0.3.0-alpha.0'

function resolveDshHome(environment: NodeJS.ProcessEnv): string {
  const configured = environment.DSH_HOME?.trim()
  if (configured !== undefined && configured.length > 0) return configured
  const home = environment.HOME?.trim() || environment.USERPROFILE?.trim() || homedir()
  return join(home, '.dsh')
}

function defaultDshProfileInstaller(options: DshProfileInstallOptions): Promise<void> {
  for (const bundleSpec of options.bundleSpecs) {
    execFileSync('dsh', ['plugin', '--profile', options.profileName, 'add', bundleSpec], {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit',
      timeout: 120_000,
    })
  }
  return Promise.resolve()
}

function profileManifestPath(profileDir: string): string {
  return join(profileDir, 'package.json')
}

function profileHasDshelmBundle(profileDir: string): boolean {
  if (!existsSync(profileManifestPath(profileDir))) return false
  try {
    const manifest = JSON.parse(readFileSync(profileManifestPath(profileDir), 'utf8')) as { dsh?: { profile?: { bundles?: unknown } } }
    const bundles = manifest.dsh?.profile?.bundles
    return Array.isArray(bundles) && bundles.includes('@deepseek-ai/dsh-base') && bundles.includes('@dshelm/dsh')
      && existsSync(join(profileDir, 'node_modules', '@dshelm', 'dsh', 'package.json'))
  } catch {
    return false
  }
}

async function ensureDshProfile(context: CommandContext): Promise<{ readonly path: string; readonly bundles: readonly string[] }> {
  const env = { ...process.env, ...(context.env ?? {}) }
  const dshHome = context.dshHome ?? resolveDshHome(env)
  const profileDir = join(dshHome, 'profiles', DSH_PROFILE_NAME)
  if (!profileHasDshelmBundle(profileDir)) {
    const installer = context.installDshProfile ?? defaultDshProfileInstaller
    await installer({
      profileName: DSH_PROFILE_NAME,
      profileDir,
      bundleSpecs: context.dshBundleSpecs ?? [context.dshBundleSpec ?? DEFAULT_DSH_BUNDLE_SPEC],
      cwd: context.cwd,
      env,
    })
  }
  if (!profileHasDshelmBundle(profileDir)) {
    throw new Error(`DSH profile ${profileDir} was not installed with the @dshelm/dsh bundle`)
  }
  return { path: profileDir, bundles: DSH_BUNDLES }
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
  const statuses = await registry.status(probeContext)
  const dshProfile = await ensureDshProfile(context)
  const dsh = probeDsh()
  if (existsSync(path)) {
    const existing = initProfileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    const profile: InitProfile = {
      ...existing,
      dsh,
      dshProfile,
    }
    if (JSON.stringify(existing) !== JSON.stringify(profile)) {
      writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 })
      return { profile, path, written: true }
    }
    return { profile, path, written: false }
  }
  const profile: InitProfile = {
    schemaVersion: 1,
    generatedAt: context.now().toISOString(),
    dsh,
    dshProfile,
    auth: statuses.map(({ resourceId, product, methodId, status, authOwner, detail }) => ({ resourceId, product, methodId, status, authOwner, detail })),
    topology: makeTopology(statuses),
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  return { profile, path, written: true }
}

export async function uninstallProfile(context: { readonly cwd: string; readonly purgeCredentials: boolean; readonly env?: NodeJS.ProcessEnv; readonly dshHome?: string }): Promise<{ readonly removedProfile: boolean; readonly removedCredentials: boolean }> {
  const directory = join(context.cwd, '.dshelm')
  const removedProfile = await removeFile(join(directory, 'profile.json'))
  const env = { ...process.env, ...(context.env ?? {}) }
  const dshHome = context.dshHome ?? resolveDshHome(env)
  const dshProfilePath = join(dshHome, 'profiles', DSH_PROFILE_NAME)
  const hadDshProfile = existsSync(dshProfilePath)
  await rm(dshProfilePath, { recursive: true, force: true })
  const legacyPath = join(directory, 'credentials.json')
  let removedCredentials = false
  if (context.purgeCredentials) {
    const removedStore = await removeFile(defaultCredentialStorePath(env))
    const removedLegacy = await removeFile(legacyPath)
    removedCredentials = removedStore || removedLegacy
  }
  return { removedProfile: removedProfile || hadDshProfile, removedCredentials }
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

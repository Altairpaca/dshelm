/**
 * @dshelm/dsh — the DSHelm DSH adapter.
 *
 * Plugin entry: provides the `dshelm.policy` host service (real Cordis
 * service from this package's own bundle), registers the `dshelm`
 * subagent provider, installs the control-plane session projection, and
 * wires project/user configuration layers with the tested precedence
 * defaults → user → project → request → runtime validation.
 */
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { PolicyLayerValue, PolicyLayers } from '@dshelm/core'
import { DSHelmPolicyService } from './service.ts'
import { registerDSHelmProvider } from './provider.ts'
import { dshelmControlPlaneProjection } from './projection.ts'
import { loadProjectPolicyLayer, installDSHelmSettings, type DSHelmUserSettings } from './config-files.ts'

export const name = 'dshelm'

/** Required services (Cordis fiber gate: the plugin starts when all exist). */
export const inject = ['llm', 'sessions', 'subagents', 'sessionProjections']

/** Plugin config: shipped defaults + optional static user layer. */
export interface Config {
  /** Shipped default policy document (lowest precedence layer). */
  defaults?: PolicyLayerValue
  /** Static user-level overrides (optional; the settings provider overrides these). */
  user?: PolicyLayerValue
  /** Cwd for project-layer discovery; defaults to process.cwd(). */
  cwd?: string
}

export const Config = {
  defaults: undefined as PolicyLayerValue | undefined,
  user: undefined as PolicyLayerValue | undefined,
  cwd: undefined as string | undefined,
}

/** Install the DSHelm host service + official seams into a live context. */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const cwd = config.cwd ?? process.cwd()
  const defaults = config.defaults ?? { profiles: {}, agents: {}, categories: {} }

  // User layer: settings namespace when a settings provider is composed,
  // otherwise the static config layer. Live-read per resolve.
  const readUser = installDSHelmSettings(ctx, (config.user ?? {}) as DSHelmUserSettings)

  // Project layer: committed .dshelm/config.jsonc (re-read per resolve so
  // edits apply without restart; .dshelm/local/ stays runtime-local).
  let projectCache: PolicyLayerValue | undefined
  let projectLoaded = false
  const readProject = async (): Promise<PolicyLayerValue | undefined> => {
    if (!projectLoaded) {
      projectCache = await loadProjectPolicyLayer(cwd)
      projectLoaded = true
    }
    return projectCache
  }
  void readProject() // warm the cache during apply (fail loud on malformed file)

  const layers = (): PolicyLayers => ({
    defaults,
    ...(readUser() !== undefined && Object.keys(readUser()!).length > 0 ? { user: readUser() as PolicyLayerValue } : {}),
    ...(projectCache !== undefined ? { project: projectCache } : {}),
  })

  const service = new DSHelmPolicyService(ctx, {
    layers,
    llm: ctx.llm,
    publish: (sessionId, snapshot) => {
      // Host→client transport: whole-value session event folded by the
      // session projection into the official projection wire frames.
      ctx.sessions.get(SessionId(sessionId))?.append('dshelm/control-plane', snapshot)
    },
  })
  // The Service base class registered itself on construction under
  // 'dshelm.policy' (ctx.reflect.provide inside Service's constructor).

  // Official seams, all fiber-owned (unwind with this plugin's disposal).
  registerDSHelmProvider(ctx, {
    service,
    categoryForRole: (role) => role,
    sessionIdOf: (request) => String(request.parent?.id ?? ''),
  })

  ctx.sessionProjections.register(dshelmControlPlaneProjection)
}

export * from './capabilities.ts'
export * from './config-files.ts'
export * from './model-selection.ts'
export * from './projection.ts'
export * from './provider.ts'
export * from './service.ts'
export * from './session-events.ts'
export * from './slice.ts'

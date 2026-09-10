/**
 * Project-level configuration: `.dshelm/config.jsonc` (committable) with
 * `.dshelm/local/` reserved for runtime-local state (gitignored).
 *
 * Precedence (tested): defaults → user → project → request → runtime
 * validation. The user layer comes from `ctx.settings` when a settings
 * provider is composed; the project layer is the committed file; request
 * layers come from the resolve call.
 */
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { loadPolicyLayers, type PolicyDocument, type PolicyLayerValue } from '@dshelm/core'

export const DSHELM_CONFIG_DIR = '.dshelm'
export const DSHELM_CONFIG_FILE = 'config.jsonc'
// rc.7 exported settingsNamespace(); current DSH validates the literal inside
// SettingsProvider.register(). The branded literal works with both type surfaces
// without depending on the removed value export.
export const DSHELM_SETTINGS_NAMESPACE = 'dshelm' as SettingsNamespace

/** Schema-backed user-level override document (optional fields). */
export interface DSHelmUserSettings {
  readonly profiles?: Record<string, unknown>
  readonly agents?: Record<string, unknown>
  readonly categories?: Record<string, unknown>
}

/**
 * Minimal callable schema accepted by both settings generations. The settings
 * service has already merged its composition/user layers before invoking this
 * function; full DSHelm policy validation remains owned by @dshelm/core.
 * `toJSON` is the descriptor surface used by settings UIs.
 */
const dshelmUserSettingsSchema = Object.assign(
  (value: unknown): DSHelmUserSettings => {
    if (value === undefined) return {}
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError('dshelm settings section must be an object')
    }
    return value as DSHelmUserSettings
  },
  {
    toJSON: () => ({
      type: 'object',
      properties: {
        profiles: { type: 'object' },
        agents: { type: 'object' },
        categories: { type: 'object' },
      },
    }),
  },
)

/**
 * Load the project layer from `<cwd>/.dshelm/config.jsonc` when present.
 * A missing file yields `undefined` (no project override); malformed
 * content fails loud with a machine-readable `ConfigResolutionError`.
 */
export async function loadProjectPolicyLayer(cwd: string): Promise<PolicyLayerValue | undefined> {
  try {
    const text = await readFile(`${cwd}/${DSHELM_CONFIG_DIR}/${DSHELM_CONFIG_FILE}`, 'utf8')
    return text
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Install the optional `dshelm` user-settings namespace through the stable
 * `ctx.settings.register()` service seam shared by rc.7 and current DSH.
 *
 * Older DSH exported an `installSettingsSection()` helper while 0.1.5 moved
 * that convenience operation onto SettingsProvider. Depending on either helper
 * would make this source generation-specific, so DSHelm composes the common
 * primitive directly. The returned reader stays live because it calls
 * `scope.get()` instead of snapshotting the value at registration time.
 */
export function installDSHelmSettings(
  ctx: Context,
  base: DSHelmUserSettings,
): () => DSHelmUserSettings | undefined {
  let current: () => DSHelmUserSettings = () => base

  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(
      DSHELM_SETTINGS_NAMESPACE,
      dshelmUserSettingsSchema as never,
      { base },
    )
    current = () => scope.get() as DSHelmUserSettings
    settingsCtx.effect(() => () => {
      current = () => base
    })
  })

  return () => current()
}

/**
 * Assemble the merged, runtime-validated policy document:
 * defaults (shipped) → user (settings) → project (.dshelm/config.jsonc).
 * `request`-layer overrides are per-call and never merged here.
 */
export async function loadDSHelmPolicy(options: {
  readonly cwd: string
  readonly defaults: PolicyLayerValue
  readonly user?: () => DSHelmUserSettings | undefined
}): Promise<PolicyDocument> {
  const project = await loadProjectPolicyLayer(options.cwd)
  const user = options.user?.() ?? undefined
  return loadPolicyLayers({
    defaults: options.defaults,
    ...(user !== undefined ? { user: user as PolicyLayerValue } : {}),
    ...(project !== undefined ? { project } : {}),
  })
}

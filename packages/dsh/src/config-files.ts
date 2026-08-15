/**
 * Project-level configuration: `.dshelm/config.jsonc` (committable) with
 * `.dshelm/local/` reserved for runtime-local state (gitignored).
 *
 * Precedence (tested): defaults → user → project → request → runtime
 * validation. The user layer comes from `ctx.settings` when a settings
 * provider is composed (official settings-namespace seam); the project layer
 * is the committed file; request layers come from the resolve call.
 */
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { loadPolicyLayers, type PolicyDocument, type PolicyLayerValue } from '@dshelm/core'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

export const DSHELM_CONFIG_DIR = '.dshelm'
export const DSHELM_CONFIG_FILE = 'config.jsonc'
export const DSHELM_SETTINGS_NAMESPACE = settingsNamespace('dshelm')

/** Schema-backed user-level override document (optional fields). */
export interface DSHelmUserSettings {
  readonly profiles?: Record<string, unknown>
  readonly agents?: Record<string, unknown>
  readonly categories?: Record<string, unknown>
}

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
 * Install the `dshelm` user-settings namespace (official
 * `@deepseek-ai/dsh-settings` seam). Returns the live reader; the section
 * is fiber-owned and unwinds on disposal.
 *
 * `installSettingsSection(ctx, ns, schema, entry, hooks)` signature verified
 * against `@deepseek-ai/dsh-settings` rc.6: `hooks.setSource` receives a
 * THUNK returning the currently authoritative value, not the value itself.
 */
export function installDSHelmSettings(
  ctx: Context,
  base: DSHelmUserSettings,
): () => DSHelmUserSettings | undefined {
  let source: DSHelmUserSettings = base
  installSettingsSection(
    ctx,
    DSHELM_SETTINGS_NAMESPACE,
    // Minimal schema: free-form policy sections layered on the base document.
    // Full schema validation happens in @dshelm/core at load time.
    { profiles: { type: 'object' }, agents: { type: 'object' }, categories: { type: 'object' } } as never,
    base,
    {
      setSource: (current) => { source = current() },
      onChange: () => {},
    },
  )
  return () => source
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

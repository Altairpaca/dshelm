/**
 * Project-level configuration: `.dshelm/config.jsonc` (committable) with
 * `.dshelm/local/` reserved for runtime-local state (gitignored).
 *
 * Precedence (tested): defaults → user → project → request → runtime
 * validation. The user layer comes from `ctx.settings` when a settings
 * provider is composed; the project layer is the committed file; request
 * layers come from the resolve call.
 *
 * DSH compatibility:
 * - 0.1.0-rc.x exports top-level `settingsNamespace()` and
 *   `installSettingsSection(ctx, ...)` helpers.
 * - 0.1.2 moves optional-section installation onto
 *   `ctx.settings.installSection(owner, ...)` and accepts literal namespaces.
 *
 * Importing the settings package as a namespace avoids a static named-export
 * dependency on helpers removed by 0.1.2. `installSettingsSectionCompat()`
 * selects the legacy helper when present and otherwise wires the modern
 * optional service through `ctx.inject(['settings'], ...)`.
 */
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { loadPolicyLayers, type PolicyDocument, type PolicyLayerValue } from '@dshelm/core'
import * as DshSettings from '@deepseek-ai/dsh-settings'

export const DSHELM_CONFIG_DIR = '.dshelm'
export const DSHELM_CONFIG_FILE = 'config.jsonc'

/** Schema-backed user-level override document (optional fields). */
export interface DSHelmUserSettings {
  readonly profiles?: Record<string, unknown>
  readonly agents?: Record<string, unknown>
  readonly categories?: Record<string, unknown>
}

type SettingsSourceHooks<T> = {
  setSource(current: () => T): void
  onChange(): void
  validate?: (value: T) => void
}

type SettingsSchema<T> = ((value: unknown) => T) & { toJSON(): unknown }

type LegacySettingsModule = {
  settingsNamespace?: (value: string) => unknown
  installSettingsSection?: <T>(
    owner: unknown,
    namespace: unknown,
    schema: SettingsSchema<T>,
    entry: T,
    hooks: SettingsSourceHooks<T>,
  ) => void
}

type ModernSettingsService = {
  installSection<T>(
    owner: unknown,
    namespace: string,
    schema: SettingsSchema<T>,
    entry: T,
    hooks: SettingsSourceHooks<T>,
  ): void
}

type SettingsInjectContext = {
  inject(
    services: readonly string[],
    callback: (ctx: { settings?: ModernSettingsService }) => void,
  ): void
}

const settingsModule = DshSettings as unknown as LegacySettingsModule
export const DSHELM_SETTINGS_NAMESPACE = settingsModule.settingsNamespace?.('dshelm') ?? 'dshelm'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function validateSettingsSection(value: unknown, field: keyof DSHelmUserSettings): void {
  if (value === undefined) return
  if (!isPlainObject(value)) {
    throw new TypeError(`dshelm settings.${field} must be an object when present`)
  }
}

/**
 * Minimal callable schema accepted by both DSH settings generations.
 * Deep policy validation deliberately remains owned by @dshelm/core.
 */
export const DSHELM_SETTINGS_SCHEMA: SettingsSchema<DSHelmUserSettings> = Object.assign(
  (value: unknown): DSHelmUserSettings => {
    if (!isPlainObject(value)) throw new TypeError('dshelm settings must be an object')
    validateSettingsSection(value.profiles, 'profiles')
    validateSettingsSection(value.agents, 'agents')
    validateSettingsSection(value.categories, 'categories')
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
      additionalProperties: false,
    }),
  },
)

/**
 * Install one optional settings section across the two DSH settings APIs.
 * Exported for a small compatibility contract test; application code should
 * normally call installDSHelmSettings().
 */
export function installSettingsSectionCompat<T>(
  owner: Context,
  namespace: string,
  schema: SettingsSchema<T>,
  entry: T,
  hooks: SettingsSourceHooks<T>,
  moduleFace: LegacySettingsModule = settingsModule,
): void {
  if (typeof moduleFace.installSettingsSection === 'function') {
    moduleFace.installSettingsSection(owner, namespace, schema, entry, hooks)
    return
  }

  const injectOwner = owner as unknown as SettingsInjectContext
  if (typeof injectOwner.inject !== 'function') {
    throw new Error('unsupported DSH settings API: expected legacy installSettingsSection() or Context.inject()')
  }
  injectOwner.inject(['settings'], (ctx) => {
    if (ctx.settings === undefined || typeof ctx.settings.installSection !== 'function') {
      throw new Error('unsupported DSH settings API: settings service has no installSection()')
    }
    ctx.settings.installSection(owner, namespace, schema, entry, hooks)
  })
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
 * Install the `dshelm` user-settings namespace and return its live reader.
 * The compatibility bridge preserves the old optional-service behavior: with
 * no settings provider the composition `base` remains authoritative.
 */
export function installDSHelmSettings(
  ctx: Context,
  base: DSHelmUserSettings,
): () => DSHelmUserSettings | undefined {
  let source: DSHelmUserSettings = base
  installSettingsSectionCompat(
    ctx,
    String(DSHELM_SETTINGS_NAMESPACE),
    DSHELM_SETTINGS_SCHEMA,
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

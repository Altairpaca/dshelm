import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { createDSHelmProvider } from '../src/provider.ts'
import {
  DSHELM_SETTINGS_SCHEMA,
  installSettingsSectionCompat,
} from '../src/config-files.ts'
import { snapshotSessionLog } from '../src/session-log-compat.ts'
import type { DSHelmPolicyServiceFace } from '../src/service.ts'

const EVENT = {
  type: 'fixture/event',
  seq: 0,
  time: 0,
  data: {},
} as unknown as SessionEvent

describe('DSH 0.1.2 compatibility bridges', () => {
  it('prefers snapshotEvents() when the current session API is present', () => {
    const snapshotEvents = vi.fn(() => [EVENT] as readonly SessionEvent[])
    const legacyEvents = [] as readonly SessionEvent[]

    expect(snapshotSessionLog({ snapshotEvents, events: legacyEvents })).toEqual([EVENT])
    expect(snapshotEvents).toHaveBeenCalledOnce()
  })

  it('falls back to the legacy events snapshot for 0.1.0-rc.x hosts', () => {
    expect(snapshotSessionLog({ events: [EVENT] })).toEqual([EVENT])
  })

  it('fails loud for an unknown session log surface', () => {
    expect(() => snapshotSessionLog({})).toThrow(/unsupported DSH session log API/)
  })

  it('advertises the agentOptions capability introduced in the 0.1.2 line', () => {
    const provider = createDSHelmProvider({
      service: {} as DSHelmPolicyServiceFace,
      categoryForRole: (role) => role,
      sessionIdOf: () => 'compat-test',
    })

    // The installed rc.7 type does not know the new field yet; assert the
    // runtime shape explicitly so this test itself remains dual-generation.
    expect(provider.capabilities as unknown as Record<string, unknown>).toMatchObject({
      agentOptions: true,
      outputSchema: false,
      depthLimit: true,
      toolFilter: true,
      persona: true,
    })
  })

  it('keeps the DSHelm settings schema callable and serializable', () => {
    const value = { profiles: { planner: { reasoning: 'high' } }, agents: {}, categories: {} }
    expect(DSHELM_SETTINGS_SCHEMA(value)).toBe(value)
    expect(DSHELM_SETTINGS_SCHEMA.toJSON()).toMatchObject({
      type: 'object',
      properties: {
        profiles: { type: 'object' },
        agents: { type: 'object' },
        categories: { type: 'object' },
      },
    })
    expect(() => DSHELM_SETTINGS_SCHEMA({ profiles: [] })).toThrow(/settings\.profiles must be an object/)
  })

  it('uses the rc.7 top-level settings helper when it exists', () => {
    const legacyInstall = vi.fn()
    const owner = {} as Context
    const hooks = { setSource: vi.fn(), onChange: vi.fn() }

    installSettingsSectionCompat(
      owner,
      'dshelm',
      DSHELM_SETTINGS_SCHEMA,
      {},
      hooks,
      { installSettingsSection: legacyInstall },
    )

    expect(legacyInstall).toHaveBeenCalledOnce()
    expect(legacyInstall).toHaveBeenCalledWith(owner, 'dshelm', DSHELM_SETTINGS_SCHEMA, {}, hooks)
  })

  it('uses ctx.settings.installSection through Context.inject on the 0.1.2 seam', () => {
    const modernInstall = vi.fn()
    const inject = vi.fn((_services: readonly string[], callback: (ctx: unknown) => void) => {
      callback({ settings: { installSection: modernInstall } })
    })
    const owner = { inject } as unknown as Context
    const hooks = { setSource: vi.fn(), onChange: vi.fn() }

    installSettingsSectionCompat(
      owner,
      'dshelm',
      DSHELM_SETTINGS_SCHEMA,
      {},
      hooks,
      {},
    )

    expect(inject).toHaveBeenCalledWith(['settings'], expect.any(Function))
    expect(modernInstall).toHaveBeenCalledOnce()
    expect(modernInstall).toHaveBeenCalledWith(owner, 'dshelm', DSHELM_SETTINGS_SCHEMA, {}, hooks)
  })
})

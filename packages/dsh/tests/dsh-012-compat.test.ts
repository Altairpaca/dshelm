import { describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { createDSHelmProvider } from '../src/provider.ts'
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
})

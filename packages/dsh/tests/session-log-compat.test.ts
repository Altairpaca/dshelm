import { describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { snapshotSessionLog } from '../src/session-log-compat.ts'

const EVENT = {
  type: 'fixture/event',
  seq: 0,
  time: 0,
  data: {},
} as unknown as SessionEvent

describe('DSH session-log compatibility bridge', () => {
  it('prefers snapshotEvents() on current DSH session surfaces', () => {
    const snapshotEvents = vi.fn(() => [EVENT] as readonly SessionEvent[])
    const legacyEvents = [] as readonly SessionEvent[]

    expect(snapshotSessionLog({ snapshotEvents, events: legacyEvents })).toEqual([EVENT])
    expect(snapshotEvents).toHaveBeenCalledOnce()
  })

  it('falls back to the verified rc.7 events getter', () => {
    expect(snapshotSessionLog({ events: [EVENT] })).toEqual([EVENT])
  })

  it('fails loud instead of inventing a session-log shape', () => {
    expect(() => snapshotSessionLog({})).toThrow(/unsupported DSH session log API/)
  })
})

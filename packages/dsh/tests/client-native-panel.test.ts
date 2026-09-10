import { describe, expect, it, vi } from 'vitest'
import { registerNativeControlPlanePanel } from '../src/client-rt/index.tsx'

describe('DSH 0.1.5 native Web panel source contract', () => {
  it('registers a matching main panel and sidebar entry when current slots exist', () => {
    const registrations: Readonly<Record<string, unknown>>[] = []
    const slots = {
      inject: vi.fn((_name: string, register: () => unknown) => register()),
      register: vi.fn((options: Readonly<Record<string, unknown>>, _component: unknown) => {
        registrations.push(options)
        return () => undefined
      }),
    }

    const registered = registerNativeControlPlanePanel({
      sessions: {} as never,
      slots,
    } as never)

    expect(registered).toBe(true)
    expect(slots.inject.mock.calls.map((call) => call[0])).toEqual(['main', 'sidebar.panellist'])
    expect(registrations).toEqual([
      { name: 'main', key: 'dshelm-control-plane' },
      { name: 'sidebar.panellist', id: 'dshelm-control-plane', order: 70, label: 'DSHelm' },
    ])
  })

  it('declines native registration when the slot service is unavailable', () => {
    expect(registerNativeControlPlanePanel({ sessions: {} } as never)).toBe(false)
  })
})

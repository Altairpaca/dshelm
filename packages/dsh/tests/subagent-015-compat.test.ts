import { describe, expect, it } from 'vitest'
import { createDSHelmProvider } from '../src/provider.ts'
import type { DSHelmPolicyServiceFace } from '../src/service.ts'

describe('DSH 0.1.5 subagent compatibility', () => {
  it('advertises agentOptions because DSHelm supplies provider/model overrides', () => {
    const provider = createDSHelmProvider({
      service: {} as DSHelmPolicyServiceFace,
      categoryForRole: (role) => role,
      sessionIdOf: () => 'compat-test',
    })

    // rc.7 does not type this field, while 0.1.5 requires it. Assert the
    // runtime shape so the verified baseline and forward candidate share one
    // source tree without weakening current-host capability preflight.
    expect(provider.capabilities as unknown as Record<string, unknown>).toEqual({
      agentOptions: true,
      outputSchema: false,
      depthLimit: true,
      toolFilter: true,
      persona: true,
    })
  })

  it('does not claim continuable-child support until DSHelm implements that lifecycle', () => {
    const provider = createDSHelmProvider({
      service: {} as DSHelmPolicyServiceFace,
      categoryForRole: (role) => role,
      sessionIdOf: () => 'compat-test',
    })

    expect('prepareContinuable' in provider).toBe(false)
  })
})

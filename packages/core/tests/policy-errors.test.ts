import { describe, expect, it } from 'vitest'
import {
  PolicyResolutionError,
  resolvePolicy,
  type PolicyDocument,
  type RuntimeCapabilities,
} from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    fallback: {
      id: 'fallback',
      candidates: [
        { provider: 'disabled-provider', model: 'blocked-model' },
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
      ],
    },
  },
  agents: {
    worker: { id: 'worker', role: 'worker', profile: 'fallback' },
  },
  categories: {
    execute: { id: 'execute', agent: 'worker' },
  },
}

const runtime: RuntimeCapabilities = {
  providers: {
    'disabled-provider': {
      enabled: false,
      models: { 'blocked-model': { available: true } },
    },
    deepseek: {
      enabled: true,
      models: { 'deepseek-v4-flash': { available: true } },
    },
  },
}

function expectCode(action: () => unknown, code: PolicyResolutionError['code']): void {
  expect(action).toThrowError(expect.objectContaining({ code }))
}

describe('resolvePolicy failures', () => {
  it('fails loudly for unknown categories and references', () => {
    expectCode(() => resolvePolicy(policy, runtime, { category: 'missing' }), 'UNKNOWN_CATEGORY')
  })

  it('skips a disabled candidate only when an explicit available fallback exists', () => {
    const resolved = resolvePolicy(policy, runtime, { category: 'execute' })

    expect(resolved.provider).toBe('deepseek')
    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'candidate', source: 'modelProfile.fallback' }),
      ]),
    )
  })

  it('fails loudly when an explicit override targets a disabled provider', () => {
    expectCode(
      () =>
        resolvePolicy(policy, runtime, {
          category: 'execute',
          override: { provider: 'disabled-provider', model: 'blocked-model' },
        }),
      'DISABLED_PROVIDER',
    )
  })

  it('fails loudly when an explicit override targets an unavailable model', () => {
    expectCode(
      () =>
        resolvePolicy(policy, runtime, {
          category: 'execute',
          override: { provider: 'deepseek', model: 'missing-model' },
        }),
      'UNAVAILABLE_MODEL',
    )
  })

  it('rejects malformed provider/model overrides', () => {
    expectCode(
      () =>
        resolvePolicy(policy, runtime, {
          category: 'execute',
          override: { provider: 'deepseek' },
        }),
      'INVALID_OVERRIDE',
    )
  })

  it('detects cyclic category inheritance', () => {
    const cyclic: PolicyDocument = {
      ...policy,
      categories: {
        execute: { id: 'execute', agent: 'worker', inherits: 'review' },
        review: { id: 'review', agent: 'worker', inherits: 'execute' },
      },
    }

    expectCode(() => resolvePolicy(cyclic, runtime, { category: 'execute' }), 'CYCLE')
  })
})

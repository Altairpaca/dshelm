import { describe, expect, it } from 'vitest'
import {
  PolicyResolutionError,
  resolvePolicy,
  type CandidateEvaluation,
  type PolicyDocument,
  type RuntimeCapabilities,
} from '../src/index.ts'

const basePolicy: PolicyDocument = {
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
      resolveModel: () => ({ valid: true }),
    },
    deepseek: {
      enabled: true,
      resolveModel: (model) =>
        model === 'deepseek-v4-flash'
          ? { valid: true, reasoningEfforts: ['off', 'high', 'max'] }
          : { valid: false, reason: 'model-unresolved' },
    },
  },
}

async function expectCode(action: () => Promise<unknown>, code: PolicyResolutionError['code']): Promise<PolicyResolutionError> {
  try {
    await action()
  } catch (error) {
    expect(error).toBeInstanceOf(PolicyResolutionError)
    expect((error as PolicyResolutionError).code).toBe(code)
    return error as PolicyResolutionError
  }
  throw new Error(`expected PolicyResolutionError with code ${code}, nothing thrown`)
}

describe('resolvePolicy failures and candidate evaluation', () => {
  it('fails loudly for unknown categories and references', async () => {
    await expectCode(() => resolvePolicy(basePolicy, runtime, { category: 'missing' }), 'UNKNOWN_CATEGORY')
    await expectCode(
      () => resolvePolicy(
        { ...basePolicy, agents: { worker: { id: 'worker', role: 'worker', profile: 'missing' } } },
        runtime,
        { category: 'execute' },
      ),
      'UNKNOWN_PROFILE',
    )
    await expectCode(
      () => resolvePolicy(
        { ...basePolicy, categories: { execute: { id: 'execute', agent: 'missing' } } },
        runtime,
        { category: 'execute' },
      ),
      'UNKNOWN_AGENT',
    )
  })

  it('skips a disabled candidate only when an explicit available fallback exists', async () => {
    const resolved = await resolvePolicy(basePolicy, runtime, { category: 'execute' })

    expect(resolved.provider).toBe('deepseek')
    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.trace.candidates).toEqual([
      expect.objectContaining({ provider: 'disabled-provider', outcome: 'provider-disabled' }),
      expect.objectContaining({ provider: 'deepseek', outcome: 'selected' }),
    ])
  })

  it('reports DISABLED_PROVIDER only when every candidate is disabled/unknown-provider', async () => {
    const error = await expectCode(
      () =>
        resolvePolicy(
          {
            ...basePolicy,
            profiles: {
              fallback: {
                id: 'fallback',
                candidates: [{ provider: 'disabled-provider', model: 'blocked-model' }],
              },
            },
          },
          runtime,
          { category: 'execute' },
        ),
      'DISABLED_PROVIDER',
    )
    expect(error.trace?.candidates).toEqual([
      expect.objectContaining({ outcome: 'provider-disabled' }),
    ])
  })

  it('reports UNAVAILABLE_MODEL when an enabled provider rejects the model — never DISABLED_PROVIDER', async () => {
    // Regression: bootstrap misclassified "enabled provider + invalid model"
    // as "all candidates use disabled providers".
    const error = await expectCode(
      () =>
        resolvePolicy(
          {
            ...basePolicy,
            profiles: {
              fallback: {
                id: 'fallback',
                candidates: [
                  { provider: 'disabled-provider', model: 'blocked-model' },
                  { provider: 'deepseek', model: 'missing-model' },
                ],
              },
            },
          },
          runtime,
          { category: 'execute' },
        ),
      'UNAVAILABLE_MODEL',
    )
    expect(error.trace?.candidates).toEqual([
      expect.objectContaining({ provider: 'disabled-provider', outcome: 'provider-disabled' }),
      expect.objectContaining({ provider: 'deepseek', model: 'missing-model', outcome: 'model-unresolved' }),
    ])
  })

  it('reports UNKNOWN_PROVIDER when all candidates reference unknown providers', async () => {
    await expectCode(
      () =>
        resolvePolicy(
          {
            ...basePolicy,
            profiles: {
              fallback: { id: 'fallback', candidates: [{ provider: 'ghost', model: 'm' }] },
            },
          },
          runtime,
          { category: 'execute' },
        ),
      'UNKNOWN_PROVIDER',
    )
  })

  it('accepts dynamic/unlisted models when exact-model resolution validates them', async () => {
    // listModels absence must never gate routing: catalog visibility is
    // advisory, exact-model validity is what matters.
    const dynamic = await resolvePolicy(
      {
        ...basePolicy,
        profiles: {
          fallback: {
            id: 'fallback',
            candidates: [{ provider: 'deepseek', model: 'deepseek-v4.1-nightly' }],
          },
        },
      },
      {
        providers: {
          deepseek: {
            enabled: true,
            // NOT in any catalog, but resolveModel says valid (dynamic model).
            resolveModel: (model) => ({ valid: model === 'deepseek-v4.1-nightly', reasoningEfforts: ['high'] }),
            catalog: { 'deepseek-v4-flash': { visible: true }, 'deepseek-v4-pro': { visible: true } },
          },
        },
      },
      { category: 'execute' },
    )
    expect(dynamic.model).toBe('deepseek-v4.1-nightly')
  })

  it('reports UNSUPPORTED_REASONING when the exact model lacks the requested effort', async () => {
    const error = await expectCode(
      () =>
        resolvePolicy(
          {
            ...basePolicy,
            profiles: {
              fallback: {
                id: 'fallback',
                reasoning: 'max',
                candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
              },
            },
          },
          {
            providers: {
              deepseek: {
                enabled: true,
                resolveModel: () => ({ valid: true, reasoningEfforts: ['off', 'high'] }),
              },
            },
          },
          { category: 'execute' },
        ),
      'UNSUPPORTED_REASONING',
    )
    expect(error.trace?.candidates).toEqual([
      expect.objectContaining({ outcome: 'reasoning-unsupported', reasoning: 'max' }),
    ])
  })

  it('reports CAPABILITY_MISMATCH when the runtime cannot validate exact models', async () => {
    const error = await expectCode(
      () =>
        resolvePolicy(
          basePolicy,
          {
            providers: {
              'disabled-provider': { enabled: false },
              deepseek: { enabled: true }, // no resolveModel
            },
          },
          { category: 'execute' },
        ),
      'CAPABILITY_MISMATCH',
    )
    expect(error.trace?.candidates).toEqual([
      expect.objectContaining({ provider: 'disabled-provider', outcome: 'provider-disabled' }),
      expect.objectContaining({ provider: 'deepseek', outcome: 'capability-mismatch' }),
    ])
  })

  it('treats a throwing exact-model resolution as model-unresolved', async () => {
    const error = await expectCode(
      () =>
        resolvePolicy(
          { ...basePolicy, profiles: { fallback: { id: 'fallback', candidates: [{ provider: 'deepseek', model: 'x' }] } } },
          { providers: { deepseek: { enabled: true, resolveModel: () => { throw new Error('network down') } } } },
          { category: 'execute' },
        ),
      'UNAVAILABLE_MODEL',
    )
    expect(error.trace?.candidates[0]).toMatchObject({ outcome: 'model-unresolved' })
    expect(error.trace?.candidates[0]?.detail).toContain('network down')
  })

  it('rejects malformed provider/model overrides', async () => {
    await expectCode(
      () => resolvePolicy(basePolicy, runtime, { category: 'execute', override: { provider: 'deepseek' } }),
      'INVALID_OVERRIDE',
    )
    await expectCode(
      () => resolvePolicy(basePolicy, runtime, { category: 'execute', override: { reasoning: '' } }),
      'INVALID_OVERRIDE',
    )
  })

  it('fails loudly when an explicit override targets a disabled provider', async () => {
    await expectCode(
      () =>
        resolvePolicy(basePolicy, runtime, {
          category: 'execute',
          override: { provider: 'disabled-provider', model: 'blocked-model' },
        }),
      'DISABLED_PROVIDER',
    )
  })

  it('fails loudly when an explicit override targets an unavailable model', async () => {
    await expectCode(
      () =>
        resolvePolicy(basePolicy, runtime, {
          category: 'execute',
          override: { provider: 'deepseek', model: 'missing-model' },
        }),
      'UNAVAILABLE_MODEL',
    )
  })

  it('records every candidate evaluation in order for the inspector', async () => {
    const candidates: CandidateEvaluation[] = []
    let resolved
    try {
      resolved = await resolvePolicy(
        {
          ...basePolicy,
          profiles: {
            fallback: {
              id: 'fallback',
              reasoning: 'high',
              candidates: [
                { provider: 'ghost', model: 'a' },
                { provider: 'disabled-provider', model: 'b', reasoning: 'max' },
                { provider: 'deepseek', model: 'missing' },
                { provider: 'deepseek', model: 'deepseek-v4-flash', reasoning: 'high' },
              ],
            },
          },
        },
        runtime,
        { category: 'execute' },
      )
    } catch (error) {
      resolved = undefined
      expect(error).toBeInstanceOf(PolicyResolutionError)
    }
    expect(resolved).toBeDefined()
    expect(resolved.trace.candidates.map((c) => c.outcome)).toEqual([
      'provider-unknown',
      'provider-disabled',
      'model-unresolved',
      'selected',
    ])
    expect(candidates).toEqual([]) // trace is the single source; no second explanation model
  })
})

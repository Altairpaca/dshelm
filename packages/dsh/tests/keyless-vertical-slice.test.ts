/**
 * Keyless DSHelm contract smoke tests (hermetic: public npm packages only).
 *
 * Stage-1 replacement of the bootstrap-round test, which imported
 * `../../deephelm-community/deepseek-harness` (non-hermetic, banned) and
 * targeted the removed pre-hardening API (`createDshSubagentStarter` & co).
 *
 * Covered here: real DSHelmPolicyService resolution against a live LlmLike
 * adapter contract, per-candidate traces, dynamic (unlisted-but-valid)
 * models, the projection unit fold, and the wire schema gate. The plugin
 * composition (apply/loader), the real agent loop, and the request/header
 * proof live in the stage-3/5 suites.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  type PolicyDocument,
  PolicyResolutionError,
} from '@dshelm/core'
import {
  DSHelmPolicyService,
  createDshCapabilities,
  attachAdvisoryCatalog,
  controlPlaneSchema,
  dshelmControlPlaneProjection,
  type LlmLike,
} from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    planner: {
      id: 'planner',
      reasoning: 'high',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }],
    },
    worker: {
      id: 'worker',
      reasoning: 'medium',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
    },
    reviewer: {
      id: 'reviewer',
      reasoning: 'high',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'planner' },
    worker: { id: 'worker', role: 'worker', profile: 'worker' },
    reviewer: { id: 'reviewer', role: 'reviewer', profile: 'reviewer' },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner' },
    execute: { id: 'execute', agent: 'worker' },
    review: { id: 'review', agent: 'reviewer' },
  },
}

function fakeLlm(): LlmLike {
  return {
    listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
    resolveModelInfo: async (provider, model) => {
      if (provider !== 'deepseek') throw Object.assign(new Error('no adapter'), { code: 'NO_ADAPTER' })
      if (model === 'deepseek-v4-pro' || model === 'deepseek-v4-flash') {
        return {
          provider,
          id: model,
          name: model,
          reasoning: { efforts: [{ id: 'high' }, { id: 'max' }], defaultEffort: 'high' },
        }
      }
      if (model === 'dynamic-valid-model') {
        // Unlisted in any catalog, but the adapter resolves it: valid.
        return {
          provider,
          id: model,
          name: model,
          reasoning: { efforts: [{ id: 'off' }] },
        }
      }
      throw Object.assign(new Error('unknown model'), { code: 'INVALID_MODEL_INFO' })
    },
    listModels: async () => [
      { provider: 'deepseek', id: 'deepseek-v4-pro', name: 'V4 Pro' },
      { provider: 'deepseek', id: 'deepseek-v4-flash', name: 'V4 Flash' },
    ],
  }
}

function makeService(llm: LlmLike = fakeLlm()): { service: DSHelmPolicyService } {
  const ctx = new Context()
  const service = new DSHelmPolicyService(ctx, {
    layers: () => ({ defaults: policy }),
    llm,
  })
  // Service registration is fiber-owned; the test context is discarded with
  // the suite (official DSH tests use the same pattern).
  return { service }
}

describe('DSHelmPolicyService (hermetic, keyless)', () => {
  it('registers the real dshelm.policy service on the context', async () => {
    const ctx = new Context()
    const service = new DSHelmPolicyService(ctx, {
      layers: () => ({ defaults: policy }),
      llm: fakeLlm(),
    })
    // Cordis registers the service through the reflect layer; the getter
    // returns the live instance. Assert presence and real behavior.
    expect(ctx.reflect.get('dshelm.policy')).toBeDefined()
    await expect(service.resolve({ category: 'plan' })).resolves.toMatchObject({ provider: 'deepseek' })
  })

  it('resolves category → agent → profile → provider/model with reasoning', async () => {
    const { service } = makeService()
    const resolved = await service.resolve({ category: 'plan' })
    expect(resolved).toMatchObject({
      category: 'plan',
      role: 'planner',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      reasoning: 'high',
    })
    expect(resolved.trace.candidates).toHaveLength(1)
    expect(resolved.trace.candidates[0]?.outcome).toBe('selected')
    expect(resolved.trace.selected).toEqual({ provider: 'deepseek', model: 'deepseek-v4-pro', reasoning: 'high' })
    expect(resolved.trace.fields.length).toBeGreaterThanOrEqual(3)
  })

  it('accepts an unlisted-but-valid dynamic model (catalog is advisory)', async () => {
    const llm = fakeLlm()
    const { service } = makeService(llm)
    // Profile-level reasoning ('high') applies to the override candidate too,
    // so the override must pick an effort the dynamic model actually supports.
    const resolved = await service.resolve({
      category: 'plan',
      override: { provider: 'deepseek', model: 'dynamic-valid-model', reasoning: 'off' },
    })
    expect(resolved.model).toBe('dynamic-valid-model')
    expect(resolved.trace.candidates[0]?.outcome).toBe('selected')
    // The catalog view (listModels) does not contain the model.
    const catalog = await attachAdvisoryCatalog(createDshCapabilities(llm), llm)
    expect(catalog.providers['deepseek']?.catalog?.['dynamic-valid-model']).toBeUndefined()
  })

  it('rejects a reasoning effort the exact model does not support', async () => {
    const { service } = makeService()
    await expect(service.resolve({
      category: 'plan',
      override: { provider: 'deepseek', model: 'deepseek-v4-pro', reasoning: 'max' },
    })).resolves.toBeDefined()
    await expect(service.resolve({
      category: 'plan',
      override: { provider: 'deepseek', model: 'dynamic-valid-model', reasoning: 'max' },
    })).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING' })
  })

  it('aggregates per-candidate outcomes when every candidate fails', async () => {
    const llm = fakeLlm()
    const ctx = new Context()
    const service = new DSHelmPolicyService(ctx, {
      layers: () => ({
        defaults: {
          profiles: {
            mixed: {
              id: 'mixed',
              candidates: [
                { provider: 'disabled-provider', model: 'x' },
                { provider: 'deepseek', model: 'does-not-exist' },
              ],
            },
          },
          agents: { a: { id: 'a', role: 'agent', profile: 'mixed' } },
          categories: { c: { id: 'c', agent: 'a' } },
        },
      }),
      llm: {
        ...llm,
        listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
      },
    })
    const error = await service.resolve({ category: 'c' }).then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(PolicyResolutionError)
    const resolutionError = error as PolicyResolutionError
    expect(resolutionError.code).toBe('UNAVAILABLE_MODEL')
    const outcomes = resolutionError.trace?.candidates.map((candidate) => candidate.outcome)
    expect(outcomes).toEqual(['provider-unknown', 'model-invalid'])
    // explain() returns the same canonical trace instead of throwing.
    const trace = await service.explain({ category: 'c' })
    expect(trace.candidates.map((candidate) => candidate.outcome)).toEqual(['provider-unknown', 'model-invalid'])
    expect(trace.error?.code).toBe('UNAVAILABLE_MODEL')
  })
})

describe('control-plane projection unit (hermetic)', () => {
  it('folds dshelm/control-plane events into the projection value', () => {
    const event = {
      type: 'dshelm/control-plane',
      seq: 1,
      time: 0,
      data: {
        version: 1,
        request: { category: 'plan' },
        roles: [{ role: 'planner', category: 'plan', agent: 'planner', profile: 'planner', provider: 'deepseek', model: 'deepseek-v4-pro' }],
        inspector: { request: 'plan', trace: { version: 1, request: { category: 'plan' }, category: 'plan', agent: 'planner', profile: 'planner', candidates: [], fields: [] } },
        source: 'host:test',
      },
    } as never
    const next = dshelmControlPlaneProjection.apply(undefined, event)
    expect(dshelmControlPlaneProjection.view(next)).toMatchObject({
      request: { category: 'plan' },
      roles: [{ role: 'planner' }],
      source: 'host:test',
    })
    // Uninteresting events return the same state reference.
    const other = { type: 'user/message', seq: 2, time: 0, data: {} } as never
    expect(dshelmControlPlaneProjection.apply(next, other)).toBe(next)
  })

  it('validates the wire payload with the official schema gate', () => {
    const snapshot = {
      version: 1,
      request: { category: 'plan' },
      roles: [],
      inspector: { request: 'plan', trace: { version: 1, request: { category: 'plan' }, category: 'plan', agent: 'planner', profile: 'planner', candidates: [], fields: [] } },
      source: 'host:test',
    }
    expect(controlPlaneSchema.parse(snapshot)).toEqual(snapshot)
    expect(() => controlPlaneSchema.parse({ ...snapshot, version: 2 })).toThrow()
    expect(() => controlPlaneSchema.parse({ ...snapshot, roles: 'nope' })).toThrow()
  })
})

describe('runtime capabilities adapter (hermetic)', () => {
  it('maps listProviders + resolveModelInfo onto RuntimeCapabilities', () => {
    const capabilities = createDshCapabilities(fakeLlm())
    expect(Object.keys(capabilities.providers)).toEqual(['deepseek'])
    expect(capabilities.providers['deepseek']?.enabled).toBe(true)
    expect(capabilities.providers['deepseek']?.catalog).toBeUndefined()
  })

  it('classifies provider/model resolution failures into the exact-model vocabulary', async () => {
    const capabilities = createDshCapabilities(fakeLlm())
    const resolve = capabilities.providers['deepseek']?.resolveModel
    expect(resolve).toBeDefined()
    const invalid = await resolve?.('does-not-exist')
    expect(invalid).toEqual({ valid: false, reason: 'model-invalid' })
  })
})

import { describe, expect, it } from 'vitest'
import {
  resolvePolicy,
  type PolicyDocument,
  type RuntimeCapabilities,
} from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    'reasoning-high': {
      id: 'reasoning-high',
      reasoning: 'high',
      candidates: [
        { provider: 'deepseek', model: 'deepseek-v4-pro' },
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
      ],
    },
    'execution-fast': {
      id: 'execution-fast',
      reasoning: 'medium',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'reasoning-high' },
    worker: { id: 'worker', role: 'worker', profile: 'execution-fast' },
    reviewer: { id: 'reviewer', role: 'reviewer', profile: 'reasoning-high' },
  },
  categories: {
    deep: { id: 'deep', agent: 'planner' },
    execute: { id: 'execute', agent: 'worker' },
    review: { id: 'review', agent: 'reviewer' },
  },
}

const runtime: RuntimeCapabilities = {
  providers: {
    deepseek: {
      enabled: true,
      models: {
        'deepseek-v4-pro': { available: true },
        'deepseek-v4-flash': { available: true },
      },
    },
  },
}

describe('resolvePolicy', () => {
  it('resolves a category to an agent and keeps provenance for every choice', () => {
    const resolved = resolvePolicy(policy, runtime, { category: 'deep' })

    expect(resolved).toMatchObject({
      category: 'deep',
      role: 'planner',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      reasoning: 'high',
    })
    expect(resolved.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'agent', source: 'category.deep' }),
        expect.objectContaining({ field: 'modelProfile', source: 'agent.planner' }),
        expect.objectContaining({ field: 'model', source: 'modelProfile.reasoning-high' }),
      ]),
    )
  })

  it('lets an explicit request override the resolved model and reasoning', () => {
    const resolved = resolvePolicy(policy, runtime, {
      category: 'deep',
      override: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        reasoning: 'medium',
      },
    })

    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.reasoning).toBe('medium')
    expect(resolved.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'model', source: 'request.override' }),
        expect.objectContaining({ field: 'reasoning', source: 'request.override' }),
      ]),
    )
  })

  it('is deterministic and JSON serializable for the same snapshot and inventory', () => {
    const first = resolvePolicy(policy, runtime, { category: 'execute' })
    const second = resolvePolicy(policy, runtime, { category: 'execute' })

    expect(second).toEqual(first)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
  })
})

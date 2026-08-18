import { describe, expect, it } from 'vitest'
import {
  canonicalJson,
  resolvePolicy,
  type PolicyDocument,
  type RuntimeCapabilities,
} from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    'reasoning-max': {
      id: 'reasoning-max',
      reasoning: 'max',
      candidates: [
        { provider: 'deepseek', model: 'deepseek-v4-pro' },
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
      ],
    },
    'execution-fast': {
      id: 'execution-fast',
      reasoning: 'high',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
    },
  },
  agents: {
    planner: {
      id: 'planner',
      role: 'planner',
      profile: 'reasoning-max',
      persona: 'You are the planner.',
      maxDepth: 3,
      skills: ['planning'],
      tools: { allow: ['read'], deny: ['shell'] },
      verification: { required: true, maxIterations: 2 },
    },
    worker: { id: 'worker', role: 'worker', profile: 'execution-fast' },
    reviewer: { id: 'reviewer', role: 'reviewer', profile: 'reasoning-max' },
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
      resolveModel: (model) => ({
        valid: true,
        reasoningEfforts: ['off', 'high', 'max'],
        defaultReasoningEffort: 'high',
      }),
    },
  },
}

describe('resolvePolicy', () => {
  it('resolves a category to an agent and keeps provenance for every choice', async () => {
    const resolved = await resolvePolicy(policy, runtime, { category: 'deep' })

    expect(resolved).toMatchObject({
      category: 'deep',
      role: 'planner',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      reasoning: 'max',
      persona: 'You are the planner.',
      maxDepth: 3,
      skills: ['planning'],
      tools: { allow: ['read'], deny: ['shell'] },
      verification: { required: true, maxIterations: 2 },
    })
    expect(resolved.trace.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'agent', source: 'category.deep' }),
        expect.objectContaining({ field: 'modelProfile', source: 'agent.planner' }),
        expect.objectContaining({ field: 'model', source: 'modelProfile.reasoning-max' }),
        expect.objectContaining({ field: 'reasoning', source: 'modelProfile.reasoning-max', value: 'max' }),
        expect.objectContaining({ field: 'persona', source: 'agent.planner' }),
        expect.objectContaining({ field: 'maxDepth', source: 'agent.planner', value: '3' }),
      ]),
    )
    // skills are explicitly metadata-only in v0.1
    expect(resolved.trace.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'skills', kind: 'metadata-only' }),
      ]),
    )
  })

  it('lets an explicit request override the resolved model and reasoning', async () => {
    const resolved = await resolvePolicy(policy, runtime, {
      category: 'deep',
      override: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        reasoning: 'off',
      },
    })

    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.reasoning).toBe('off')
    expect(resolved.trace.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'model', source: 'request.override' }),
        expect.objectContaining({ field: 'reasoning', source: 'request.override', value: 'off' }),
      ]),
    )
    expect(resolved.trace.candidates).toEqual([
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-v4-flash', outcome: 'selected' }),
    ])
  })

  it('treats reasoning as an opaque adapter-owned identifier (never core vocabulary)', async () => {
    // An adapter-owned opaque id (not in any core vocabulary) is accepted
    // end-to-end when the exact model's runtime capability supports it.
    const exotic = await resolvePolicy(policy, {
      providers: {
        deepseek: {
          enabled: true,
          resolveModel: () => ({ valid: true, reasoningEfforts: ['deep-think-v9'] }),
        },
      },
    }, { category: 'deep', override: { provider: 'deepseek', model: 'deepseek-v4-pro', reasoning: 'deep-think-v9' } })
    expect(exotic.reasoning).toBe('deep-think-v9')
    expect(exotic.trace.selected?.reasoning).toBe('deep-think-v9')

    // The same opaque id requested against a model that does not support it
    // must fail loudly — the core does not invent or alias efforts.
    await expect(
      resolvePolicy(policy, {
        providers: {
          deepseek: {
            enabled: true,
            resolveModel: () => ({ valid: true, reasoningEfforts: ['deep-think-v9'] }),
          },
        },
      }, { category: 'deep' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING' })
  })

  it('is deterministic and JSON serializable for the same snapshot and inventory', async () => {
    const first = await resolvePolicy(policy, runtime, { category: 'execute' })
    const second = await resolvePolicy(policy, runtime, { category: 'execute' })

    expect(second).toEqual(first)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expect(canonicalJson(first)).toBe(canonicalJson(second))
  })

  it('selects by task requirements and records runtime evidence in trace v2', async () => {
    const resolved = await resolvePolicy(policy, {
      providers: {
        deepseek: {
          enabled: true,
          resolveModel: (model) => model === 'deepseek-v4-pro'
            ? {
                valid: true,
                authReady: false,
                backend: 'dsh-native',
                harness: 'dsh',
                softScores: { cheapParallelism: 0.2 },
                evidence: [{ source: 'runtime-fixture', layer: 'runtime', confidence: 1 }],
                reasoningEfforts: ['high', 'max'],
              }
            : {
                valid: true,
                authReady: true,
                backend: 'agent-teams',
                harness: 'dsh',
                softScores: { cheapParallelism: 0.95 },
                evidence: [{ source: 'empirical-fixture', layer: 'empirical', confidence: 0.8 }],
                reasoningEfforts: ['off', 'high', 'max'],
              },
        },
      },
    }, {
      category: 'deep',
      requirements: { needsCheapParallelism: true, authConstraint: 'authenticated' },
    })

    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.trace.version).toBe(2)
    expect(resolved.trace.requirements).toEqual({ needsCheapParallelism: true, authConstraint: 'authenticated' })
    expect(resolved.trace.candidates).toEqual([
      expect.objectContaining({ outcome: 'auth-unavailable', authReady: false }),
      expect.objectContaining({ outcome: 'selected', score: 0.95, backend: 'agent-teams', harness: 'dsh', evidence: [{ source: 'empirical-fixture', layer: 'empirical', confidence: 0.8 }] }),
    ])
  })
})

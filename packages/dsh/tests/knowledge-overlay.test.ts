import { describe, expect, it } from 'vitest'
import { createDshCapabilities, type LlmLike } from '../src/capabilities.ts'
import { createDefaultDshKnowledge } from '../src/knowledge.ts'
import { BASELINE_KNOWLEDGE_BUNDLE } from '@dshelm/model-knowledge'
import { resolvePolicy, type PolicyDocument } from '@dshelm/core'

const llm: LlmLike = {
  listProviders: () => [{ id: 'fixture', name: 'Fixture' }],
  resolveModelInfo: async () => ({ provider: 'fixture', id: 'model', name: 'Fixture Model', context: { contextWindow: 128_000 } }),
  listModels: async () => [{ provider: 'fixture', id: 'model', name: 'Fixture Model' }],
}

describe('DSH capability knowledge overlay', () => {
  it('projects the shipped knowledge bundle into live DSH capabilities', () => {
    const knowledge = createDefaultDshKnowledge(BASELINE_KNOWLEDGE_BUNDLE)
    const capabilities = createDshCapabilities(llm, knowledge)
    expect(capabilities.knowledgeSnapshot).toBe(BASELINE_KNOWLEDGE_BUNDLE.bundleId)
  })
  it('merges data-only knowledge after exact runtime resolution without overriding validity', async () => {
    const capabilities = createDshCapabilities(llm, {
      snapshot: 'fixture-knowledge-v1',
      lookup: () => ({
        authReady: true,
        backend: 'dsh-native',
        harness: 'dsh',
        softScores: { strongPlanning: 0.72 },
        evidence: [{ source: 'fixture', layer: 'empirical', confidence: 0.8 }],
      }),
    })
    const info = await capabilities.providers.fixture?.resolveModel?.('model')
    expect(info).toMatchObject({ valid: true, authReady: true, contextWindow: 128_000, backend: 'dsh-native', softScores: { strongPlanning: 0.72 } })
    expect(info?.evidence?.[0]?.layer).toBe('empirical')
    expect(capabilities.knowledgeSnapshot).toBe('fixture-knowledge-v1')
  })

  it('changes a production resolver choice when shipped knowledge scores differ', async () => {
    const routingLlm: LlmLike = {
      listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
      resolveModelInfo: async (provider, model) => ({ provider, id: model, name: model, context: { contextWindow: 128_000 } }),
      listModels: async () => [],
    }
    const policy: PolicyDocument = {
      profiles: { mixed: { id: 'mixed', candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }, { provider: 'deepseek', model: 'deepseek-v4-flash' }] } },
      agents: { worker: { id: 'worker', role: 'worker', profile: 'mixed' } },
      categories: { implement: { id: 'implement', agent: 'worker' } },
    }
    const resolved = await resolvePolicy(policy, createDshCapabilities(routingLlm, createDefaultDshKnowledge(BASELINE_KNOWLEDGE_BUNDLE)), {
      category: 'implement',
      requirements: { needsCheapParallelism: true },
    })
    expect(resolved.model).toBe('deepseek-v4-flash')
    expect(resolved.trace.modelKnowledgeSnapshot).toBe(BASELINE_KNOWLEDGE_BUNDLE.bundleId)
  })
})

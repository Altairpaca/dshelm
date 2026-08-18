import { describe, expect, it } from 'vitest'
import { createDshCapabilities, type LlmLike } from '../src/capabilities.ts'

const llm: LlmLike = {
  listProviders: () => [{ id: 'fixture', name: 'Fixture' }],
  resolveModelInfo: async () => ({ provider: 'fixture', id: 'model', name: 'Fixture Model', context: { contextWindow: 128_000 } }),
  listModels: async () => [{ provider: 'fixture', id: 'model', name: 'Fixture Model' }],
}

describe('DSH capability knowledge overlay', () => {
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
})

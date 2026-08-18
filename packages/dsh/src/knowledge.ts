import { runtimeKnowledgeOverlay, type KnowledgeBundle } from '@dshelm/model-knowledge'
import type { DshKnowledgeLookup } from './capabilities.ts'

export function createDefaultDshKnowledge(bundle: KnowledgeBundle): DshKnowledgeLookup {
  return {
    snapshot: bundle.bundleId,
    lookup: (provider, model) => {
      const record = bundle.records.find((entry) => entry.provider === provider && entry.model === model)
      if (record === undefined) return undefined
      return runtimeKnowledgeOverlay(record)
    },
  }
}

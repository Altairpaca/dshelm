import { BASELINE_KNOWLEDGE_BUNDLE as LEGACY_BASELINE_KNOWLEDGE_BUNDLE } from './baseline.ts'
import type { KnowledgeBundle } from './contracts.ts'
import { DEEPSEEK_CURRENT_RECORDS } from './deepseek-current.ts'

const generatedAt = '2026-09-10T15:20:00+08:00'

export const BASELINE_KNOWLEDGE_BUNDLE = {
  ...LEGACY_BASELINE_KNOWLEDGE_BUNDLE,
  bundleId: 'dshelm-v0.3-baseline-2026-09-10',
  generatedAt,
  records: [
    ...LEGACY_BASELINE_KNOWLEDGE_BUNDLE.records,
    ...DEEPSEEK_CURRENT_RECORDS,
  ],
} satisfies KnowledgeBundle

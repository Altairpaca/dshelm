import type { ModelKnowledgeRecord } from './contracts.ts'

const observedAt = '2026-09-10T15:20:00+08:00'
const dshRelease = 'deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1'
const dshCommit = '183f08e9c6dde7e36cd2318eaee70b0da08fb35e'
const dshCatalogUrl = 'https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.1/packages/llm/llm-deepseek/src/index.ts'
const dshAdapterUrl = 'https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.1/packages/llm/llm-deepseek/src/adapter.ts'
const currentReasoningEfforts = ['off', 'low', 'high', 'max'] as const

function runtimeEvidence(
  id: string,
  subject: string,
  claimType: 'runtimeReady' | 'contextWindow' | 'vision' | 'reasoningEfforts',
  value: boolean | number | string[],
  source: string,
  sourceUrl?: string,
) {
  return {
    id,
    layer: 'runtime' as const,
    source,
    ...(sourceUrl === undefined ? {} : { sourceUrl, sourceCommit: dshCommit }),
    observedAt,
    subject,
    claimType,
    value,
    confidence: 1,
    staleAfterDays: 14,
  }
}

const v41Flash = 'deepseek/deepseek-flash'
const v4Flash = 'deepseek/deepseek-v4-flash'
const v4Pro = 'deepseek/deepseek-v4-pro'
const visionExp = 'deepseek/deepseek-v4-flash-vision-exp'

/**
 * Refresh only facts proved by the current DSH adapter for the older V4
 * records. Other DeepSeek-owned protocol/auth evidence and heuristic routing
 * scores remain untouched, including their original observation dates.
 *
 * The current reasoning vocabulary is adapter/runtime evidence: when thinking
 * is enabled DSH exposes off/low/high/max; a profile that disables thinking
 * narrows the selectable set to off only. It is not labelled as an independent
 * DeepSeek service guarantee.
 */
export function withCurrentDeepSeekV4CatalogEvidence(record: ModelKnowledgeRecord): ModelKnowledgeRecord {
  if (record.id !== v4Flash && record.id !== v4Pro) return record
  const route = record.id === v4Flash ? 'flash' : 'pro'
  return {
    ...record,
    hard: {
      ...record.hard,
      contextWindow: 1_000_000,
      reasoningEfforts: [...currentReasoningEfforts],
    },
    evidence: [
      ...record.evidence.filter((item) => item.claimType !== 'reasoningEfforts'),
      runtimeEvidence(
        `deepseek-v4-${route}-dsh-context-015`,
        record.id,
        'contextWindow',
        1_000_000,
        dshRelease,
        dshCatalogUrl,
      ),
      runtimeEvidence(
        `deepseek-v4-${route}-dsh-reasoning-015`,
        record.id,
        'reasoningEfforts',
        [...currentReasoningEfforts],
        `${dshRelease} direct DeepSeek adapter selectable effort set when thinking is enabled`,
        dshAdapterUrl,
      ),
    ],
  }
}

export const DEEPSEEK_CURRENT_RECORDS = [
  {
    id: v41Flash,
    provider: 'deepseek',
    model: 'deepseek-flash',
    displayName: 'DeepSeek-V41-Flash',
    hard: {
      runtimeReady: false,
      contextWindow: 1_000_000,
      vision: true,
      reasoningEfforts: [...currentReasoningEfforts],
    },
    soft: [],
    adaptationHints: [],
    evidence: [
      runtimeEvidence(
        'deepseek-v41-runtime-unverified',
        v41Flash,
        'runtimeReady',
        false,
        'DSHelm has catalog evidence only; no real provider execution has been recorded for this route',
      ),
      runtimeEvidence(
        'deepseek-v41-dsh-context',
        v41Flash,
        'contextWindow',
        1_000_000,
        dshRelease,
        dshCatalogUrl,
      ),
      runtimeEvidence(
        'deepseek-v41-dsh-vision',
        v41Flash,
        'vision',
        true,
        dshRelease,
        dshCatalogUrl,
      ),
      runtimeEvidence(
        'deepseek-v41-dsh-reasoning',
        v41Flash,
        'reasoningEfforts',
        [...currentReasoningEfforts],
        `${dshRelease} direct DeepSeek adapter selectable effort set when thinking is enabled`,
        dshAdapterUrl,
      ),
    ],
  },
  {
    id: visionExp,
    provider: 'deepseek',
    model: 'deepseek-v4-flash-vision-exp',
    displayName: 'DeepSeek-V4-Flash-Vision-Exp',
    hard: {
      runtimeReady: false,
      contextWindow: 1_000_000,
      vision: true,
      reasoningEfforts: [...currentReasoningEfforts],
    },
    soft: [],
    adaptationHints: [],
    evidence: [
      runtimeEvidence(
        'deepseek-v4-vision-exp-runtime-unverified',
        visionExp,
        'runtimeReady',
        false,
        'DSHelm has catalog evidence only; no real provider execution has been recorded for this experimental route',
      ),
      runtimeEvidence(
        'deepseek-v4-vision-exp-dsh-context',
        visionExp,
        'contextWindow',
        1_000_000,
        dshRelease,
        dshCatalogUrl,
      ),
      runtimeEvidence(
        'deepseek-v4-vision-exp-dsh-vision',
        visionExp,
        'vision',
        true,
        dshRelease,
        dshCatalogUrl,
      ),
      runtimeEvidence(
        'deepseek-v4-vision-exp-dsh-reasoning',
        visionExp,
        'reasoningEfforts',
        [...currentReasoningEfforts],
        `${dshRelease} direct DeepSeek adapter selectable effort set when thinking is enabled`,
        dshAdapterUrl,
      ),
    ],
  },
] satisfies ModelKnowledgeRecord[]

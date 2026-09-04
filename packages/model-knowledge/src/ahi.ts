import { createHash } from 'node:crypto'
import { z } from 'zod'
import { KnowledgeBundleSchema } from './contracts.ts'
import type { CapabilityKind, KnowledgeBundle, ModelKnowledgeRecord } from './contracts.ts'

const sha256 = z.string().regex(/^[0-9a-f]{64}$/)
const nullableNonEmpty = z.string().min(1).nullable()

const metricMean = z.object({
  observed: z.number().int().nonnegative(),
  mean: z.number().nonnegative().nullable(),
}).strict()

const metricMedian = z.object({
  observed: z.number().int().nonnegative(),
  median: z.number().nonnegative().nullable(),
}).strict()

export const AhiSummarySchema = z.object({
  schema_version: z.literal('ahi.summary/v1'),
  benchmark: z.string().min(1),
  benchmark_version: nullableNonEmpty,
  harness: z.string().min(1),
  harness_version: nullableNonEmpty,
  model: z.string().min(1),
  model_version: nullableNonEmpty,
  configuration_sha256: sha256,
  environment_sha256: sha256,
  task_set_sha256: sha256,
  distinct_tasks: z.number().int().positive(),
  observations: z.number().int().positive(),
  successes: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
  success_rate_wilson95: z.object({
    low: z.number().min(0).max(1),
    high: z.number().min(0).max(1),
  }).strict(),
  cost_usd: metricMean,
  latency_ms: metricMedian,
  input_tokens: metricMean,
  output_tokens: metricMean,
}).strict().superRefine((summary, context) => {
  if (summary.successes > summary.observations) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['successes'], message: 'successes cannot exceed observations' })
  }
  if (summary.distinct_tasks > summary.observations) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['distinct_tasks'], message: 'distinct_tasks cannot exceed observations' })
  }
  const expectedRate = summary.successes / summary.observations
  if (Math.abs(expectedRate - summary.success_rate) > 1e-12) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['success_rate'], message: 'success_rate must equal successes / observations' })
  }
  if (summary.success_rate_wilson95.low > summary.success_rate_wilson95.high) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['success_rate_wilson95'], message: 'Wilson interval low cannot exceed high' })
  }
  if (summary.success_rate < summary.success_rate_wilson95.low || summary.success_rate > summary.success_rate_wilson95.high) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['success_rate_wilson95'], message: 'Wilson interval must contain success_rate' })
  }
  for (const [key, metric] of Object.entries({
    cost_usd: summary.cost_usd,
    latency_ms: summary.latency_ms,
    input_tokens: summary.input_tokens,
    output_tokens: summary.output_tokens,
  })) {
    if (metric.observed > summary.observations) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [key, 'observed'], message: 'observed metric count cannot exceed observations' })
    }
  }
})

export type AhiSummary = z.infer<typeof AhiSummarySchema>

export type AhiSoftCapability = Extract<
  CapabilityKind,
  'agenticCoding' | 'longHorizonCoding' | 'planning' | 'debugging' | 'review' | 'research' | 'toolReliability' | 'fanOutSuitability'
>

export interface AhiEvidenceMapping {
  readonly provider: string
  readonly displayName: string
  /** Explicit semantic mapping. DSHelm never guesses this from the benchmark name. */
  readonly capability: AhiSoftCapability
  /** Confidence in the benchmark-to-capability interpretation, not the success rate itself. */
  readonly confidence: number
  readonly observedAt: string
  readonly staleAfterDays: number
  readonly sourceUrl?: string
  readonly sourceCommit?: string
}

export interface AhiKnowledgeInput {
  readonly summary: unknown
  readonly mapping: AhiEvidenceMapping
}

export interface AhiKnowledgeBundleOptions {
  readonly bundleId: string
  readonly generatedAt: string
}

function nonEmpty(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} must be a non-empty string`)
  return value
}

function validateMapping(mapping: AhiEvidenceMapping): void {
  nonEmpty(mapping.provider, 'provider')
  nonEmpty(mapping.displayName, 'displayName')
  if (!Number.isFinite(mapping.confidence) || mapping.confidence < 0 || mapping.confidence > 1) {
    throw new Error('confidence must be between 0 and 1')
  }
  if (!Number.isInteger(mapping.staleAfterDays) || mapping.staleAfterDays <= 0) {
    throw new Error('staleAfterDays must be a positive integer')
  }
  if (!Number.isFinite(Date.parse(mapping.observedAt))) throw new Error('observedAt must be a valid timestamp')
}

function evidenceId(summary: AhiSummary, mapping: AhiEvidenceMapping): string {
  const payload = JSON.stringify({
    benchmark: summary.benchmark,
    benchmarkVersion: summary.benchmark_version,
    capability: mapping.capability,
    configurationSha256: summary.configuration_sha256,
    environmentSha256: summary.environment_sha256,
    harness: summary.harness,
    harnessVersion: summary.harness_version,
    model: summary.model,
    modelVersion: summary.model_version,
    provider: mapping.provider,
    taskSetSha256: summary.task_set_sha256,
  })
  return `ahi-${createHash('sha256').update(payload).digest('hex').slice(0, 24)}`
}

function evidenceValue(summary: AhiSummary): Record<string, string | number | boolean> {
  return {
    benchmark: summary.benchmark,
    benchmarkVersion: summary.benchmark_version ?? '',
    harness: summary.harness,
    harnessVersion: summary.harness_version ?? '',
    modelVersion: summary.model_version ?? '',
    score: summary.success_rate,
    observations: summary.observations,
    successes: summary.successes,
    wilson95Low: summary.success_rate_wilson95.low,
    wilson95High: summary.success_rate_wilson95.high,
    taskSetSha256: summary.task_set_sha256,
    configurationSha256: summary.configuration_sha256,
    environmentSha256: summary.environment_sha256,
  }
}

export function knowledgeBundleFromAhiSummaries(
  inputs: readonly AhiKnowledgeInput[],
  options: AhiKnowledgeBundleOptions,
): KnowledgeBundle {
  if (inputs.length === 0) throw new Error('at least one AHI summary is required')
  nonEmpty(options.bundleId, 'bundleId')
  if (!Number.isFinite(Date.parse(options.generatedAt))) throw new Error('generatedAt must be a valid timestamp')

  const records = new Map<string, ModelKnowledgeRecord>()
  const capabilities = new Map<string, Set<AhiSoftCapability>>()

  for (const input of inputs) {
    validateMapping(input.mapping)
    const summary = AhiSummarySchema.parse(input.summary)
    const key = `${input.mapping.provider}\u0000${summary.model}`
    const current = records.get(key)
    if (current !== undefined && current.displayName !== input.mapping.displayName) {
      throw new Error(`displayName mismatch for ${input.mapping.provider}/${summary.model}`)
    }

    const seenCapabilities = capabilities.get(key) ?? new Set<AhiSoftCapability>()
    if (seenCapabilities.has(input.mapping.capability)) {
      throw new Error(`duplicate AHI capability mapping for ${input.mapping.provider}/${summary.model}: ${input.mapping.capability}`)
    }
    seenCapabilities.add(input.mapping.capability)
    capabilities.set(key, seenCapabilities)

    const id = evidenceId(summary, input.mapping)
    const evidence = {
      id,
      layer: 'empirical' as const,
      source: `agent-harness-index:${summary.benchmark}`,
      ...(input.mapping.sourceUrl === undefined ? {} : { sourceUrl: input.mapping.sourceUrl }),
      ...(input.mapping.sourceCommit === undefined ? {} : { sourceCommit: input.mapping.sourceCommit }),
      observedAt: input.mapping.observedAt,
      subject: `${input.mapping.provider}/${summary.model}`,
      claimType: input.mapping.capability,
      value: evidenceValue(summary),
      confidence: input.mapping.confidence,
      staleAfterDays: input.mapping.staleAfterDays,
    }
    const soft = {
      capability: input.mapping.capability,
      score: summary.success_rate,
      confidence: input.mapping.confidence,
      scoreBasis: 'empirical-evaluation' as const,
      evidenceIds: [id],
    }

    if (current === undefined) {
      records.set(key, {
        id: `${input.mapping.provider}/${summary.model}`,
        provider: input.mapping.provider,
        model: summary.model,
        displayName: input.mapping.displayName,
        hard: {},
        soft: [soft],
        adaptationHints: [],
        evidence: [evidence],
      })
    } else {
      records.set(key, {
        ...current,
        soft: [...current.soft, soft],
        evidence: [...current.evidence, evidence],
      })
    }
  }

  return KnowledgeBundleSchema.parse({
    schemaVersion: 1,
    bundleId: options.bundleId,
    generatedAt: options.generatedAt,
    records: [...records.values()],
  })
}

import { KnowledgeBundleSchema } from './contracts.ts'
import type { EvidenceLayer, KnowledgeBundle, KnowledgeEvidence, ModelKnowledgeRecord } from './contracts.ts'

export type KnowledgeRoutingCapability = 'strongPlanning' | 'longHorizonCoding' | 'cheapParallelism' | 'independentVerification' | 'largeContextStability' | 'fastLatency'

export type RuntimeKnowledgeOverlay = {
  readonly softScores?: Readonly<Partial<Record<KnowledgeRoutingCapability, number>>>
  readonly evidence: readonly { readonly source: string; readonly layer: EvidenceLayer; readonly confidence: number }[]
}

export function parseKnowledgeBundle(input: unknown): KnowledgeBundle {
  return KnowledgeBundleSchema.parse(input)
}

export type KnowledgeStatus = {
  readonly status: 'fresh' | 'stale'
  readonly staleEvidenceCount: number
  readonly recordCount: number
  readonly remoteExecutableCode: false
}

export function knowledgeStatus(bundle: KnowledgeBundle, now: Date): KnowledgeStatus {
  const staleEvidenceCount = bundle.records
    .flatMap((record) => record.evidence)
    .filter((evidence) => isStale(evidence, now))
    .length
  return {
    status: staleEvidenceCount === 0 ? 'fresh' : 'stale',
    staleEvidenceCount,
    recordCount: bundle.records.length,
    remoteExecutableCode: false,
  }
}

function isStale(evidence: KnowledgeEvidence, now: Date): boolean {
  const observed = Date.parse(evidence.observedAt)
  return now.getTime() > observed + evidence.staleAfterDays * 86_400_000
}

type ModelExplanation =
  | { readonly found: false; readonly provider: string; readonly model: string; readonly reason: string }
  | {
      readonly found: true
      readonly provider: string
      readonly model: string
      readonly displayName: string
      readonly hard: ModelKnowledgeRecord['hard'] & { readonly runtimeReady: boolean }
      readonly evidenceByLayer: Readonly<Record<EvidenceLayer, readonly string[]>>
      readonly soft: readonly {
        readonly capability: ModelKnowledgeRecord['soft'][number]['capability']
        readonly score: number
        readonly confidence: number
        readonly scoreBasis: ModelKnowledgeRecord['soft'][number]['scoreBasis']
        readonly evidence: readonly Pick<KnowledgeEvidence, 'id' | 'claimType' | 'layer' | 'confidence'>[]
        readonly derivation?: ModelKnowledgeRecord['soft'][number]['derivation']
      }[]
      readonly adaptationHints: ModelKnowledgeRecord['adaptationHints']
    }

export function explainModel(bundle: KnowledgeBundle, provider: string, model: string): ModelExplanation {
  const record = bundle.records.find((entry) => entry.provider === provider && entry.model === model)
  if (record === undefined) return { found: false, provider, model, reason: 'no evidence record' }
  const evidenceByLayer: Record<EvidenceLayer, string[]> = {
    runtime: [],
    official: [],
    community: [],
    empirical: [],
  }
  for (const evidence of record.evidence) evidenceByLayer[evidence.layer].push(evidence.id)
  return {
    found: true,
    provider,
    model,
    displayName: record.displayName,
    hard: { ...record.hard, runtimeReady: record.hard.runtimeReady ?? false },
    evidenceByLayer,
    soft: record.soft.map((capability) => ({
      capability: capability.capability,
      score: capability.score,
      confidence: capability.confidence,
      scoreBasis: capability.scoreBasis,
      evidence: capability.evidenceIds.flatMap((id) => {
        const evidence = record.evidence.find((item) => item.id === id)
        return evidence === undefined ? [] : [{ id: evidence.id, claimType: evidence.claimType, layer: evidence.layer, confidence: evidence.confidence }]
      }),
      ...(capability.derivation === undefined ? {} : { derivation: capability.derivation }),
    })),
    adaptationHints: record.adaptationHints,
  }
}

export function runtimeKnowledgeOverlay(record: ModelKnowledgeRecord): RuntimeKnowledgeOverlay {
  const softScores: Partial<Record<KnowledgeRoutingCapability, number>> = {}
  for (const capability of record.soft) {
    const mapped = mapRoutingCapability(capability.capability)
    if (mapped !== undefined) softScores[mapped] = capability.score * capability.confidence
  }
  return {
    ...(Object.keys(softScores).length === 0 ? {} : { softScores }),
    evidence: record.evidence.map((evidence) => ({ source: evidence.source, layer: evidence.layer, confidence: evidence.confidence })),
  }
}

function mapRoutingCapability(capability: ModelKnowledgeRecord['soft'][number]['capability']): KnowledgeRoutingCapability | undefined {
  switch (capability) {
    case 'planning': return 'strongPlanning'
    case 'longHorizonCoding': return 'longHorizonCoding'
    case 'fanOutSuitability': return 'cheapParallelism'
    case 'review': return 'independentVerification'
    default: return undefined
  }
}

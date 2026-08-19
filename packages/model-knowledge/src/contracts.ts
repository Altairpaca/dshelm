import { z } from 'zod'

const evidenceLayers = ['runtime', 'official', 'community', 'empirical'] as const
const capabilityKinds = [
  'runtimeReady',
  'protocol',
  'contextWindow',
  'maxOutputTokens',
  'reasoningEfforts',
  'toolCalling',
  'structuredOutput',
  'vision',
  'streaming',
  'promptCaching',
  'localDeployment',
  'openWeights',
  'license',
  'authMethods',
  'agenticCoding',
  'longHorizonCoding',
  'planning',
  'debugging',
  'review',
  'research',
  'toolReliability',
  'fanOutSuitability',
] as const

const evidenceValue = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()),
  z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])),
])

const evidenceItem = z.object({
  id: z.string().min(1),
  layer: z.enum(evidenceLayers),
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceCommit: z.string().min(7).optional(),
  observedAt: z.string().datetime({ offset: true }),
  subject: z.string().min(1),
  claimType: z.enum(capabilityKinds),
  value: evidenceValue,
  confidence: z.number().min(0).max(1),
  staleAfterDays: z.number().int().positive(),
}).strict()

const hardCapabilities = z.object({
  runtimeReady: z.boolean().optional(),
  protocol: z.string().min(1).optional(),
  contextWindow: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  reasoningEfforts: z.array(z.string().min(1)).optional(),
  toolCalling: z.boolean().optional(),
  structuredOutput: z.boolean().optional(),
  vision: z.boolean().optional(),
  streaming: z.boolean().optional(),
  promptCaching: z.boolean().optional(),
  localDeployment: z.boolean().optional(),
  openWeights: z.boolean().optional(),
  license: z.string().min(1).optional(),
  authMethods: z.array(z.string().min(1)).optional(),
}).strict()

const softCapability = z.object({
  capability: z.enum([
    'agenticCoding',
    'longHorizonCoding',
    'planning',
    'debugging',
    'review',
    'research',
    'toolReliability',
    'fanOutSuitability',
  ]),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  scoreBasis: z.enum(['empirical-evaluation', 'maintainer-heuristic']).default('maintainer-heuristic'),
  evidenceIds: z.array(z.string().min(1)).min(1),
  derivation: z.object({
    kind: z.literal('explicit'),
    rationale: z.string().min(1),
    inputClaimTypes: z.array(z.enum(capabilityKinds)).min(1),
  }).optional(),
}).strict()

const adaptationHint = z.object({
  id: z.string().min(1),
  hint: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
}).strict()

const modelRecord = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  displayName: z.string().min(1),
  hard: hardCapabilities,
  soft: z.array(softCapability),
  adaptationHints: z.array(adaptationHint),
  evidence: z.array(evidenceItem).min(1),
}).strict().superRefine((record, context) => {
  const hardClaims: readonly [keyof z.infer<typeof hardCapabilities>, CapabilityKind][] = [
    ['runtimeReady', 'runtimeReady'],
    ['protocol', 'protocol'],
    ['contextWindow', 'contextWindow'],
    ['maxOutputTokens', 'maxOutputTokens'],
    ['reasoningEfforts', 'reasoningEfforts'],
    ['toolCalling', 'toolCalling'],
    ['structuredOutput', 'structuredOutput'],
    ['vision', 'vision'],
    ['streaming', 'streaming'],
    ['promptCaching', 'promptCaching'],
    ['localDeployment', 'localDeployment'],
    ['openWeights', 'openWeights'],
    ['license', 'license'],
    ['authMethods', 'authMethods'],
  ]
  for (const [field, claim] of hardClaims) {
    if (record.hard[field] === undefined) continue
    const matchingEvidence = record.evidence.filter((item) => item.claimType === claim)
    if (matchingEvidence.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['hard', field], message: `missing evidence for ${field}` })
      continue
    }
    if (!matchingEvidence.every((item) => valuesEqual(item.value, record.hard[field]))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['hard', field], message: `evidence value contradicts ${field}` })
    }
  }
  const evidenceIds = new Set(record.evidence.map((item) => item.id))
  const evidenceById = new Map(record.evidence.map((item) => [item.id, item]))
  for (const [index, capability] of record.soft.entries()) {
    for (const evidenceId of capability.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['soft', index, 'evidenceIds'], message: `unknown evidence id ${evidenceId}` })
      const evidence = evidenceById.get(evidenceId)
      if (evidence !== undefined && evidence.claimType !== capability.capability) {
        const explicitlyDerived = capability.derivation?.inputClaimTypes.includes(evidence.claimType) === true
        if (!explicitlyDerived) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ['soft', index, 'evidenceIds'], message: `evidence ${evidenceId} claims ${evidence.claimType}, not ${capability.capability}; add an explicit derivation` })
        }
      }
    }
    if (capability.derivation !== undefined && capability.scoreBasis !== 'maintainer-heuristic') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['soft', index, 'scoreBasis'], message: 'explicit derivations must be marked maintainer-heuristic' })
    }
  }
  for (const [index, hint] of record.adaptationHints.entries()) {
    for (const evidenceId of hint.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptationHints', index, 'evidenceIds'], message: `unknown evidence id ${evidenceId}` })
    }
  }
})

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export const KnowledgeBundleSchema = z.object({
  schemaVersion: z.literal(1),
  bundleId: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  records: z.array(modelRecord),
}).strict()

export type EvidenceLayer = (typeof evidenceLayers)[number]
export type CapabilityKind = (typeof capabilityKinds)[number]
export type KnowledgeEvidence = z.infer<typeof evidenceItem>
export type HardCapabilities = z.infer<typeof hardCapabilities>
export type SoftCapability = z.infer<typeof softCapability>
export type AdaptationHint = z.infer<typeof adaptationHint>
export type ModelKnowledgeRecord = z.infer<typeof modelRecord>
export type KnowledgeBundle = z.infer<typeof KnowledgeBundleSchema>

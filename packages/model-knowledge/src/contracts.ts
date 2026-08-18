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
  evidenceIds: z.array(z.string().min(1)).min(1),
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
}).strict()

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

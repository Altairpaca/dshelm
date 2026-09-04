export { BASELINE_KNOWLEDGE_BUNDLE } from './baseline.ts'
export { AhiSummarySchema, knowledgeBundleFromAhiSummaries } from './ahi.ts'
export { explainModel, knowledgeStatus, parseKnowledgeBundle, runtimeKnowledgeOverlay } from './knowledge.ts'
export { KnowledgeBundleSchema } from './contracts.ts'
export type {
  AhiEvidenceMapping,
  AhiKnowledgeBundleOptions,
  AhiKnowledgeInput,
  AhiSoftCapability,
  AhiSummary,
} from './ahi.ts'
export type {
  AdaptationHint,
  CapabilityKind,
  EvidenceLayer,
  HardCapabilities,
  KnowledgeBundle,
  KnowledgeEvidence,
  ModelKnowledgeRecord,
  SoftCapability,
} from './contracts.ts'
export type { KnowledgeRoutingCapability, RuntimeKnowledgeOverlay } from './knowledge.ts'

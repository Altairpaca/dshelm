export type ReasoningLevel = 'low' | 'medium' | 'high'

export interface ModelCandidate {
  readonly provider: string
  readonly model: string
}

export interface ModelProfile {
  readonly id: string
  readonly reasoning?: ReasoningLevel
  readonly candidates: readonly ModelCandidate[]
}

export interface ToolPolicy {
  readonly allow?: readonly string[]
  readonly deny?: readonly string[]
}

export interface VerificationPolicy {
  readonly required: boolean
  readonly maxIterations?: number
}

export interface AgentSpec {
  readonly id: string
  readonly role: string
  readonly profile: string
  readonly skills?: readonly string[]
  readonly tools?: ToolPolicy
  readonly verification?: VerificationPolicy
}

export interface CategorySpec {
  readonly id: string
  readonly agent: string
  readonly inherits?: string
}

export interface PolicyDocument {
  readonly profiles: Readonly<Record<string, ModelProfile>>
  readonly agents: Readonly<Record<string, AgentSpec>>
  readonly categories: Readonly<Record<string, CategorySpec>>
}

export interface RuntimeModelCapability {
  readonly available: boolean
}

export interface RuntimeProviderCapability {
  readonly enabled: boolean
  readonly models: Readonly<Record<string, RuntimeModelCapability>>
}

export interface RuntimeCapabilities {
  readonly providers: Readonly<Record<string, RuntimeProviderCapability>>
}

export interface ResolveOverride {
  readonly provider?: string
  readonly model?: string
  readonly reasoning?: ReasoningLevel
}

export interface ResolveRequest {
  readonly category: string
  readonly override?: ResolveOverride
}

export interface ResolutionTraceEntry {
  readonly field: string
  readonly source: string
  readonly value: string
}

export interface ResolvedAgentPolicy {
  readonly category: string
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly reasoning?: ReasoningLevel
  readonly skills?: readonly string[]
  readonly tools?: ToolPolicy
  readonly verification?: VerificationPolicy
  readonly trace: readonly ResolutionTraceEntry[]
}

export type PolicyResolutionErrorCode =
  | 'UNKNOWN_CATEGORY'
  | 'UNKNOWN_AGENT'
  | 'UNKNOWN_PROFILE'
  | 'UNKNOWN_PROVIDER'
  | 'DISABLED_PROVIDER'
  | 'UNAVAILABLE_MODEL'
  | 'INVALID_OVERRIDE'
  | 'CYCLE'

export class PolicyResolutionError extends Error {
  readonly code: PolicyResolutionErrorCode

  constructor(code: PolicyResolutionErrorCode, message: string) {
    super(message)
    this.name = 'PolicyResolutionError'
    this.code = code
  }
}

export type PolicyLayerValue = string | Readonly<Record<string, unknown>>

export interface PolicyLayers {
  readonly defaults?: PolicyLayerValue
  readonly user?: PolicyLayerValue
  readonly project?: PolicyLayerValue
  readonly request?: PolicyLayerValue
}

export type ConfigResolutionErrorCode = 'INVALID_JSONC' | 'UNKNOWN_KEY'

export class ConfigResolutionError extends Error {
  readonly code: ConfigResolutionErrorCode
  readonly layer?: string

  constructor(code: ConfigResolutionErrorCode, message: string, layer?: string) {
    super(message)
    this.name = 'ConfigResolutionError'
    this.code = code
    if (layer) this.layer = layer
  }
}

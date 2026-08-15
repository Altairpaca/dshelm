/**
 * DSHelm core contracts — v0.1-alpha hardened.
 *
 * Round-2 audit fixes baked into this file:
 *  1. Reasoning is an OPAQUE adapter-owned identifier (a non-empty string).
 *     Core never invents vocabulary (no `low|medium|high`); support is decided
 *     by the runtime's exact-model capability (`ExactModelInfo.reasoningEfforts`).
 *  2. Candidate evaluation is per-candidate with structured outcomes; the final
 *     error is derived from the whole evaluation trace (§6 of the hardening
 *     contract). The Resolution Inspector consumes the same structure.
 *  3. `inherits` is REMOVED (v0.1 decision: no real use case; alias chasing
 *     made child fields silently vanish). CategorySpec has no inheritance.
 *  4. Tool / persona / depth policy are first-class fields mapped to official
 *     DSH `SubagentStartRequest` seams; `skills` is explicitly
 *     metadata-only in v0.1 (no official expression) and marked as such in the
 *     trace.
 */

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------

/** Opaque adapter-owned reasoning-effort id. Core validates shape only (non-empty string). */
export type ReasoningEffort = string

// ---------------------------------------------------------------------------
// Policy document
// ---------------------------------------------------------------------------

/** One ordered fallback candidate of a model profile. */
export interface ModelCandidate {
  /** Provider route id (DSH: registered LlmRuntime route). */
  readonly provider: string
  /** Exact model id interpreted by the provider adapter. */
  readonly model: string
  /** Optional per-candidate reasoning-effort preference (opaque). */
  readonly reasoning?: ReasoningEffort
}

/** Reusable provider/model profile with an ordered candidate list. */
export interface ModelProfile {
  /** Must equal the owning map key. */
  readonly id: string
  /** Ordered candidates; the first selectable candidate wins. Non-empty. */
  readonly candidates: readonly ModelCandidate[]
  /** Optional profile-level reasoning-effort preference (opaque). */
  readonly reasoning?: ReasoningEffort
}

/** Tool scoping policy; mapped to DSH `SubagentStartRequest.toolFilter`. */
export interface ToolPolicy {
  readonly allow?: readonly string[]
  readonly deny?: readonly string[]
}

/** Verification policy; v0.1 execution semantics live in the DSH adapter slice. */
export interface VerificationPolicy {
  readonly required: boolean
  /** Bounded revision/retry iterations; positive integer when present. */
  readonly maxIterations?: number
}

/** One agent role with its model profile and execution policy. */
export interface AgentSpec {
  /** Must equal the owning map key. */
  readonly id: string
  /** Human-facing role label (planner, worker, reviewer, ...). */
  readonly role: string
  /** Model profile id; must reference an existing profile. */
  readonly profile: string
  /** Persona text; mapped to `SubagentStartRequest.persona` (provider capability required). */
  readonly persona?: string
  /** Absolute delegation-depth cap; mapped to `SubagentStartRequest.maxDepth` (provider capability required). */
  readonly maxDepth?: number
  /** Tool scoping; mapped to `SubagentStartRequest.toolFilter` (provider capability required). */
  readonly tools?: ToolPolicy
  /**
   * v0.1: METADATA-ONLY. No official `SubagentStartRequest` expression exists;
   * carried for provenance and marked `metadata-only` in the trace. Skills are
   * composed through DSH agent presets in a later round.
   */
  readonly skills?: readonly string[]
  readonly verification?: VerificationPolicy
}

/** One routing category. No inheritance (removed in v0.1). */
export interface CategorySpec {
  /** Must equal the owning map key. */
  readonly id: string
  /** Agent id; must reference an existing agent. */
  readonly agent: string
}

/** The validated, plain-JSON policy document. */
export interface PolicyDocument {
  readonly profiles: Readonly<Record<string, ModelProfile>>
  readonly agents: Readonly<Record<string, AgentSpec>>
  readonly categories: Readonly<Record<string, CategorySpec>>
}

// ---------------------------------------------------------------------------
// Runtime capability model (exact-model validation; catalog is advisory)
// ---------------------------------------------------------------------------

/** Why an exact model failed resolution. */
export type ExactModelReason = 'model-invalid' | 'model-unresolved'

/** Exact-model capability answer for one provider/model route. */
export interface ExactModelInfo {
  /** Whether the exact route is valid (provider registered + model resolvable). */
  readonly valid: boolean
  /** Present when invalid. */
  readonly reason?: ExactModelReason
  /** Supported opaque reasoning-effort ids for this exact model. */
  readonly reasoningEfforts?: readonly string[]
  /** Adapter-configured default effort, when known. */
  readonly defaultReasoningEffort?: string
}

/** One advisory catalog entry (visibility only — NEVER routing). */
export interface RuntimeCatalogEntry {
  readonly visible: boolean
}

/** Capability of one provider route. */
export interface RuntimeProviderCapability {
  /** Whether the provider route is enabled for selection. */
  readonly enabled: boolean
  /**
   * Exact-model resolution. Absent means the runtime cannot validate exact
   * models for this provider — candidates there evaluate as
   * `capability-mismatch` (fail loud; catalog membership is never a proxy).
   */
  readonly resolveModel?: (
    model: string,
    signal?: AbortSignal,
  ) => Promise<ExactModelInfo | undefined> | ExactModelInfo | undefined
  /** Advisory catalog (discovery/selector metadata only). */
  readonly catalog?: Readonly<Record<string, RuntimeCatalogEntry>>
}

/** Immutable snapshot of runtime capabilities consumed by the resolver. */
export interface RuntimeCapabilities {
  readonly providers: Readonly<Record<string, RuntimeProviderCapability>>
}

// ---------------------------------------------------------------------------
// Resolution request / result / trace
// ---------------------------------------------------------------------------

/** Per-request override. Provider and model must be given together. */
export interface ResolveOverride {
  readonly provider?: string
  readonly model?: string
  readonly reasoning?: ReasoningEffort
}

export interface ResolveRequest {
  /** Category id to route. */
  readonly category: string
  /** Optional explicit override (provider+model together; reasoning alone allowed). */
  readonly override?: ResolveOverride
}

/** Structured outcome of one candidate evaluation. */
export type CandidateOutcome =
  | 'selected'              // exact model valid and reasoning supported
  | 'provider-unknown'      // provider not present in runtime capabilities
  | 'provider-disabled'     // provider present but disabled
  | 'model-invalid'         // provider reported invalid exact-model metadata
  | 'model-unresolved'      // provider could not resolve the exact model
  | 'reasoning-unsupported' // requested effort unsupported by the exact model
  | 'capability-mismatch'   // runtime lacks the capability to validate this candidate

/** One candidate's evaluation record (single source for errors AND the inspector). */
export interface CandidateEvaluation {
  readonly provider: string
  readonly model: string
  readonly reasoning?: ReasoningEffort
  readonly outcome: CandidateOutcome
  /** Stable human-readable detail (never an error stack). */
  readonly detail: string
}

/** One field-level provenance entry. */
export interface FieldProvenance {
  readonly field: string
  readonly source: string
  readonly value: string
  /** `metadata-only` = carried in the policy but not executable in v0.1. */
  readonly kind?: 'effective' | 'metadata-only'
}

/** Canonical resolution trace; the Resolution Inspector consumes this exact structure. */
export interface ResolutionTrace {
  readonly version: 1
  readonly request: Readonly<ResolveRequest>
  readonly category: string
  readonly agent: string
  readonly profile: string
  /** Every evaluated candidate, in profile order. */
  readonly candidates: readonly CandidateEvaluation[]
  /** Field-level provenance (agent, profile, reasoning, tools, persona, depth, ...). */
  readonly fields: readonly FieldProvenance[]
  /** Present when resolution failed; the inspector renders it from the trace. */
  readonly error?: { readonly code: PolicyResolutionErrorCode; readonly message: string }
  /** The winning selection. */
  readonly selected?: {
    readonly provider: string
    readonly model: string
    readonly reasoning?: ReasoningEffort
  }
}

/** The resolved, executable agent policy. */
export interface ResolvedAgentPolicy {
  readonly category: string
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly reasoning?: ReasoningEffort
  readonly persona?: string
  readonly maxDepth?: number
  readonly tools?: ToolPolicy
  readonly skills?: readonly string[]
  readonly verification?: VerificationPolicy
  /** Canonical trace (fields + candidates). */
  readonly trace: ResolutionTrace
}

// ---------------------------------------------------------------------------
// Execution backend contract (v0.2)
// ---------------------------------------------------------------------------

/**
 * One role execution request for a backend. Core stays DSH-free: the
 * backend adapters (DSH native, AgentTeams, workflow plugins) live outside
 * core and implement this contract.
 */
export interface ExecutionBackendRequest {
  /** Role label (planner, worker, reviewer, ...). */
  readonly role: string
  /** The prompt delivered to the role agent. */
  readonly prompt: string
  /** The DSHelm-resolved policy for this role. */
  readonly resolved: ResolvedAgentPolicy
  /** Optional parent session identity for provenance/recording. */
  readonly sessionId?: string
}

/** One role execution result. */
export interface ExecutionBackendResult {
  /** Final assistant text (the role's deliverable). */
  readonly output: string
  /** Backend label for the trace (e.g. 'native', 'agent-teams'). */
  readonly backend: string
  /** Backend-provided detail (member id, run id, ...) when available. */
  readonly detail?: string
}

/**
 * Thin execution backend: run one DSHelm-resolved role to completion.
 * Backends are bounded (single turn set, no infinite loops); durable
 * multi-role orchestration belongs to the caller (e.g. the vertical slice).
 */
export interface ExecutionBackend {
  /** Stable backend name recorded in traces. */
  readonly name: string
  /** Run one role. Must fail loud on unsupported capabilities. */
  run(request: ExecutionBackendRequest): Promise<ExecutionBackendResult>
}
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type PolicyResolutionErrorCode =
  | 'UNKNOWN_CATEGORY'
  | 'UNKNOWN_AGENT'
  | 'UNKNOWN_PROFILE'
  | 'UNKNOWN_PROVIDER'
  | 'DISABLED_PROVIDER'
  | 'UNAVAILABLE_MODEL'
  | 'UNSUPPORTED_REASONING'
  | 'CAPABILITY_MISMATCH'
  | 'INVALID_OVERRIDE'

export class PolicyResolutionError extends Error {
  readonly code: PolicyResolutionErrorCode
  /** Full candidate evaluation trace at failure time (inspector-consumable). */
  readonly trace?: ResolutionTrace

  constructor(code: PolicyResolutionErrorCode, message: string, trace?: ResolutionTrace) {
    super(message)
    this.name = 'PolicyResolutionError'
    this.code = code
    if (trace !== undefined) this.trace = trace
  }
}

// ---------------------------------------------------------------------------
// Configuration layers
// ---------------------------------------------------------------------------

/** A policy layer: raw JSONC text or an already-parsed plain object. */
export type PolicyLayerValue = string | Readonly<Record<string, unknown>>

export interface PolicyLayers {
  readonly defaults?: PolicyLayerValue
  readonly user?: PolicyLayerValue
  readonly project?: PolicyLayerValue
  readonly request?: PolicyLayerValue
}

export type ConfigResolutionErrorCode =
  | 'INVALID_JSONC'        // unparsable layer text / not an object
  | 'UNKNOWN_KEY'          // unknown top-level policy section
  | 'INVALID_POLICY'       // nested schema violation (path + message)
  | 'PROTECTED_KEY'        // __proto__ / prototype / constructor
  | 'ID_MISMATCH'          // entity id != owning map key
  | 'UNKNOWN_REFERENCE'    // dangling profile/agent reference
  | 'INHERITS_REMOVED'     // categories.inherits removed in v0.1

export class ConfigResolutionError extends Error {
  readonly code: ConfigResolutionErrorCode
  readonly layer?: string
  /** JSON-pointer-ish path of the offending field, when known. */
  readonly path?: string

  constructor(code: ConfigResolutionErrorCode, message: string, opts?: { layer?: string; path?: string }) {
    super(message)
    this.name = 'ConfigResolutionError'
    this.code = code
    if (opts?.layer !== undefined) this.layer = opts.layer
    if (opts?.path !== undefined) this.path = opts.path
  }
}

/**
 * Deterministic policy resolver with per-candidate evaluation.
 *
 * Round-2 fixes:
 *  - every candidate produces a structured `CandidateEvaluation`; the final
 *    error is AGGREGATED from the whole trace (§6) — "disabled provider +
 *    invalid model" can no longer misreport as "all candidates disabled";
 *  - exact-model correctness comes from `RuntimeProviderCapability.resolveModel`
 *    (DSH: `ctx.llm.resolveModelInfo`); catalog visibility is advisory and is
 *    never a routing gate;
 *  - reasoning efforts are opaque strings validated against the exact model's
 *    supported efforts; no core-invented vocabulary;
 *  - deterministic: same policy snapshot + same runtime capability response +
 *    same request ⇒ same resolved policy and same serialized trace.
 */
import {
  type CandidateEvaluation,
  type CandidateOutcome,
  type FieldProvenance,
  type ExactModelInfo,
  PolicyResolutionError,
  type PolicyDocument,
  type ResolutionTrace,
  type ResolveOverride,
  type ResolveRequest,
  type ResolvedAgentPolicy,
  type RuntimeCapabilities,
  type RoutingEvidence,
  type SoftRoutingCapability,
  type TaskRequirements,
} from './contracts.ts'

/** One in-flight candidate evaluation. */
interface PendingCandidate {
  provider: string
  model: string
  reasoning?: string
}

interface CandidateMetadata {
  readonly score?: number
  readonly authReady?: boolean
  readonly backend?: string
  readonly harness?: string
  readonly productManaged?: boolean
  readonly evidence?: readonly RoutingEvidence[]
}

export async function resolvePolicy(
  policy: PolicyDocument,
  runtime: RuntimeCapabilities,
  request: ResolveRequest,
): Promise<ResolvedAgentPolicy> {
  // Resolver-input guard: the document and its entity maps must be plain
  // objects (null or Object.prototype prototypes). A hand-built policy with a
  // polluted prototype could otherwise smuggle inherited members into
  // lookups; validated documents are already clean and frozen, so this is a
  // cheap per-resolve assertion, not a re-validation.
  assertPlainPolicy(policy)
  const category = policy.categories[request.category]
  if (category === undefined) {
    throw new PolicyResolutionError('UNKNOWN_CATEGORY', `Unknown category "${request.category}"`)
  }
  const agent = policy.agents[category.agent]
  if (agent === undefined) {
    throw new PolicyResolutionError('UNKNOWN_AGENT', `Category "${request.category}" references unknown agent "${category.agent}"`)
  }
  const profile = policy.profiles[agent.profile]
  if (profile === undefined) {
    throw new PolicyResolutionError('UNKNOWN_PROFILE', `Agent "${agent.id}" references unknown profile "${agent.profile}"`)
  }
  validateOverride(request.override)

  let candidates: CandidateEvaluation[] = []
  const fields: FieldProvenance[] = [
    { field: 'agent', source: `category.${request.category}`, value: agent.id },
    { field: 'modelProfile', source: `agent.${agent.id}`, value: profile.id },
  ]
  addPolicyFields(agent, fields)

  let selected: { provider: string; model: string; reasoning?: string } | undefined
  const override = request.override
  const preferenceReasoning = override?.reasoning ?? profile.reasoning

  if (override?.provider !== undefined && override.model !== undefined) {
    const evaluation = await evaluateCandidate(
      { provider: override.provider, model: override.model, ...(preferenceReasoning !== undefined ? { reasoning: preferenceReasoning } : {}) },
      runtime,
      request.requirements,
    )
    candidates.push(evaluation)
    if (evaluation.outcome === 'selected') {
      selected = { provider: evaluation.provider, model: evaluation.model, ...(evaluation.reasoning !== undefined ? { reasoning: evaluation.reasoning } : {}) }
      fields.push({ field: 'model', source: 'request.override', value: evaluation.model })
    }
  } else {
    for (const candidate of profile.candidates) {
      const reasoning = preferenceReasoning ?? candidate.reasoning
      const evaluation = await evaluateCandidate(
        { provider: candidate.provider, model: candidate.model, ...(reasoning !== undefined ? { reasoning } : {}) },
        runtime,
        request.requirements,
      )
      candidates.push(evaluation)
      if (request.requirements === undefined && evaluation.outcome === 'selected') {
        selected = { provider: evaluation.provider, model: evaluation.model, ...(evaluation.reasoning !== undefined ? { reasoning: evaluation.reasoning } : {}) }
        fields.push({ field: 'model', source: `modelProfile.${profile.id}`, value: evaluation.model })
        break
      }
    }
    if (request.requirements !== undefined) {
      const selectionIndex = bestCandidateIndex(candidates)
      if (selectionIndex !== undefined) {
        candidates = candidates.map((candidate, index) => index === selectionIndex
          ? candidate
          : candidate.outcome === 'selected' ? { ...candidate, outcome: 'eligible' } : candidate)
        const evaluation = candidates[selectionIndex]
        if (evaluation !== undefined) {
          selected = { provider: evaluation.provider, model: evaluation.model, ...(evaluation.reasoning !== undefined ? { reasoning: evaluation.reasoning } : {}) }
          fields.push({ field: 'model', source: `taskRequirements+modelProfile.${profile.id}`, value: evaluation.model })
        }
      }
    }
  }

  if (selected === undefined) {
    throw aggregateError({
      version: 2,
      request,
      category: request.category,
      agent: agent.id,
      profile: profile.id,
      candidates,
      fields,
      ...(request.requirements === undefined ? {} : { requirements: request.requirements }),
      ...(runtime.knowledgeSnapshot === undefined ? {} : { modelKnowledgeSnapshot: runtime.knowledgeSnapshot }),
    })
  }
  if (selected.reasoning !== undefined) {
    fields.push({
      field: 'reasoning',
      source: override?.reasoning !== undefined ? 'request.override' : `modelProfile.${profile.id}`,
      value: selected.reasoning,
    })
  }
  const trace: ResolutionTrace = {
    version: 2,
    request,
    category: request.category,
    agent: agent.id,
    profile: profile.id,
    ...(request.requirements === undefined ? {} : { requirements: request.requirements }),
    ...(runtime.knowledgeSnapshot === undefined ? {} : { modelKnowledgeSnapshot: runtime.knowledgeSnapshot }),
    candidates,
    fields,
    selected: selectedTrace(selected, candidates),
  }
  return {
    category: request.category,
    role: agent.role,
    provider: selected.provider,
    model: selected.model,
    ...(selected.reasoning !== undefined ? { reasoning: selected.reasoning } : {}),
    ...(agent.persona !== undefined ? { persona: agent.persona } : {}),
    ...(agent.maxDepth !== undefined ? { maxDepth: agent.maxDepth } : {}),
    ...(agent.tools !== undefined ? { tools: agent.tools } : {}),
    ...(agent.skills !== undefined ? { skills: agent.skills } : {}),
    ...(agent.verification !== undefined ? { verification: agent.verification } : {}),
    trace,
  }
}

// ---------------------------------------------------------------------------
// Per-candidate evaluation
// ---------------------------------------------------------------------------

async function evaluateCandidate(
  candidate: PendingCandidate,
  runtime: RuntimeCapabilities,
  requirements?: TaskRequirements,
): Promise<CandidateEvaluation> {
  const provider = runtime.providers[candidate.provider]
  if (provider === undefined) {
    return outcome(candidate, 'provider-unknown', `Provider "${candidate.provider}" is not registered in runtime capabilities`)
  }
  if (!provider.enabled) {
    return outcome(candidate, 'provider-disabled', `Provider "${candidate.provider}" is disabled`)
  }
  if (provider.resolveModel === undefined) {
    return outcome(
      candidate,
      'capability-mismatch',
      `Runtime cannot validate exact models for provider "${candidate.provider}" (no resolveModel capability)`,
    )
  }
  let info: ExactModelInfo | undefined
  try {
    info = await provider.resolveModel(candidate.model)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return outcome(candidate, 'model-unresolved', `Exact-model resolution for "${candidate.provider}/${candidate.model}" failed: ${message}`)
  }
  if (info === undefined) {
    return outcome(candidate, 'model-unresolved', `Exact-model resolution for "${candidate.provider}/${candidate.model}" returned no result`)
  }
  if (!info.valid) {
    const reason = info.reason === 'model-invalid' ? 'model-invalid' : 'model-unresolved'
    return outcome(
      candidate,
      reason,
      reason === 'model-invalid'
        ? `Provider reported invalid exact-model metadata for "${candidate.provider}/${candidate.model}"`
        : `Exact model "${candidate.provider}/${candidate.model}" could not be resolved`,
    )
  }
  const metadata = candidateMetadata(info, requirements)
  if (requirements?.authConstraint === 'authenticated' && info.authReady !== true) {
    return outcome(candidate, 'auth-unavailable', `Authentication is not ready for "${candidate.provider}/${candidate.model}"`, metadata)
  }
  const hardMismatch = hardRequirementMismatch(info, requirements)
  if (hardMismatch !== undefined) return outcome(candidate, 'capability-mismatch', hardMismatch, metadata)
  if (candidate.reasoning !== undefined) {
    const efforts = info.reasoningEfforts
    if (efforts === undefined || efforts.length === 0) {
      return outcome(
        candidate,
        'reasoning-unsupported',
        `Exact model "${candidate.provider}/${candidate.model}" exposes no reasoning efforts; requested "${candidate.reasoning}"`,
      )
    }
    if (!efforts.includes(candidate.reasoning)) {
      return outcome(
        candidate,
        'reasoning-unsupported',
        `Reasoning effort "${candidate.reasoning}" is not supported by "${candidate.provider}/${candidate.model}" (supported: ${efforts.join(', ')})`,
      )
    }
  }
  return outcome(candidate, 'selected', `Exact model "${candidate.provider}/${candidate.model}" is valid`, metadata)
}

function outcome(candidate: PendingCandidate, outcomeCode: CandidateOutcome, detail: string, metadata: CandidateMetadata = {}): CandidateEvaluation {
  return {
    provider: candidate.provider,
    model: candidate.model,
    ...(candidate.reasoning !== undefined ? { reasoning: candidate.reasoning } : {}),
    outcome: outcomeCode,
    detail,
    ...metadata,
  }
}

function bestCandidateIndex(candidates: readonly CandidateEvaluation[]): number | undefined {
  let bestIndex: number | undefined
  let bestScore = Number.NEGATIVE_INFINITY
  candidates.forEach((candidate, index) => {
    if (candidate.outcome !== 'selected') return
    const score = candidate.score ?? 0
    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  })
  return bestIndex
}

function candidateMetadata(info: ExactModelInfo, requirements: TaskRequirements | undefined): CandidateMetadata {
  return {
    ...(requirements === undefined ? {} : { score: scoreRequirements(info, requirements) }),
    ...(info.authReady === undefined ? {} : { authReady: info.authReady }),
    ...(info.backend === undefined ? {} : { backend: info.backend }),
    ...(info.harness === undefined ? {} : { harness: info.harness }),
    ...(info.productManaged === undefined ? {} : { productManaged: info.productManaged }),
    ...(info.evidence === undefined ? {} : { evidence: info.evidence }),
  }
}

const softRequirementMap = [
  ['needsStrongPlanning', 'strongPlanning'],
  ['needsLongHorizonCoding', 'longHorizonCoding'],
  ['needsCheapParallelism', 'cheapParallelism'],
  ['needsIndependentVerification', 'independentVerification'],
  ['needsVeryLargeContext', 'largeContextStability'],
  ['needsFastLatency', 'fastLatency'],
] as const satisfies readonly (readonly [keyof TaskRequirements, SoftRoutingCapability])[]

function scoreRequirements(info: ExactModelInfo, requirements: TaskRequirements | undefined): number {
  if (requirements === undefined) return 0
  let score = 0
  let count = 0
  for (const [requirement, capability] of softRequirementMap) {
    if (requirements[requirement] !== true) continue
    score += info.softScores?.[capability] ?? 0
    count += 1
  }
  return count === 0 ? 0 : score / count
}

function hardRequirementMismatch(info: ExactModelInfo, requirements: TaskRequirements | undefined): string | undefined {
  if (requirements === undefined) return undefined
  if (requirements.needsVision === true && info.vision !== true) return 'Required vision capability is not available'
  if (requirements.needsStructuredOutput === true && info.structuredOutput !== true) return 'Required structured-output capability is not available'
  if (requirements.needsLocalOnly === true && info.localDeployment !== true) return 'Required local-only execution is not available'
  const minimumContext = requirements.minimumContextWindow
  if (minimumContext !== undefined && (info.contextWindow === undefined || info.contextWindow < minimumContext)) return `Required context window ${minimumContext} is not available`
  const maxCost = requirements.maxCostPerMillionTokens
  if (maxCost !== undefined && (info.costPerMillionTokens === undefined || info.costPerMillionTokens > maxCost)) return `Required cost ceiling ${maxCost} is not satisfied`
  if (requirements.harnessConstraint !== undefined && info.harness !== requirements.harnessConstraint) return `Required harness "${requirements.harnessConstraint}" is not available`
  return undefined
}

function selectedTrace(selected: { readonly provider: string; readonly model: string; readonly reasoning?: string }, candidates: readonly CandidateEvaluation[]): NonNullable<ResolutionTrace['selected']> {
  const evaluation = candidates.find((candidate) => candidate.outcome === 'selected' && candidate.provider === selected.provider && candidate.model === selected.model)
  return {
    ...selected,
    ...(evaluation?.backend === undefined ? {} : { backend: evaluation.backend }),
    ...(evaluation?.harness === undefined ? {} : { harness: evaluation.harness }),
    ...(evaluation?.productManaged === undefined ? {} : { observability: evaluation.productManaged ? 'product-managed' : 'request-observable' }),
  }
}

// ---------------------------------------------------------------------------
// Aggregation: the final error derives from the whole evaluation trace
// ---------------------------------------------------------------------------

function aggregateError(trace: ResolutionTrace): PolicyResolutionError {
  const outcomes = trace.candidates.map((candidate) => candidate.outcome)
  const only = (...codes: CandidateOutcome[]): boolean => outcomes.every((o) => codes.includes(o))

  let code: PolicyResolutionError['code']
  let message: string
  const reachedEnabled = outcomes.some((o) =>
    o === 'model-invalid' || o === 'model-unresolved' || o === 'reasoning-unsupported' || o === 'auth-unavailable' || o === 'capability-mismatch' || o === 'eligible' || o === 'selected',
  )
  const modelLevelFailure = outcomes.some((o) => o === 'model-invalid' || o === 'model-unresolved')
  if (only('provider-unknown')) {
    code = 'UNKNOWN_PROVIDER'
    message = `All candidates for profile "${trace.profile}" reference providers unknown to the runtime`
  } else if (!reachedEnabled) {
    code = 'DISABLED_PROVIDER'
    message = `No candidate for profile "${trace.profile}" reaches an enabled provider`
  } else if (only('auth-unavailable')) {
    code = 'AUTH_UNAVAILABLE'
    message = `No authenticated candidate exists for profile "${trace.profile}"`
  } else if (outcomes.some((o) => o === 'capability-mismatch') && !modelLevelFailure) {
    code = 'CAPABILITY_MISMATCH'
    message = `Runtime lacks exact-model validation for candidates of profile "${trace.profile}"`
  } else if (outcomes.some((o) => o === 'reasoning-unsupported') && !modelLevelFailure) {
    code = 'UNSUPPORTED_REASONING'
    message = `No candidate of profile "${trace.profile}" supports the requested reasoning effort`
  } else {
    code = 'UNAVAILABLE_MODEL'
    message = `No available model candidate exists for profile "${trace.profile}"`
  }
  const error: PolicyResolutionError = new PolicyResolutionError(code, message, {
    ...trace,
    // The failed trace carries the aggregate error so the inspector renders
    // the same canonical structure (no second UI-only explanation model).
    error: { code, message },
  })
  return error
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertPlainPolicy(policy: PolicyDocument): void {
  for (const [label, map] of [
    ['document', policy],
    ['categories', policy.categories],
    ['agents', policy.agents],
    ['profiles', policy.profiles],
  ] as const) {
    const proto = Object.getPrototypeOf(map)
    if (proto !== null && proto !== Object.prototype) {
      throw new PolicyResolutionError(
        'INVALID_OVERRIDE',
        'Resolver input is not a plain policy ' + label + ': prototype pollution attempt',
      )
    }
  }
}
function validateOverride(override: ResolveOverride | undefined): void {
  if (override === undefined) return
  if (Boolean(override.provider) !== Boolean(override.model)) {
    throw new PolicyResolutionError(
      'INVALID_OVERRIDE',
      'A model override must specify both provider and model',
    )
  }
  if (override.reasoning !== undefined && (typeof override.reasoning !== 'string' || override.reasoning.length === 0)) {
    throw new PolicyResolutionError('INVALID_OVERRIDE', 'An override reasoning effort must be a non-empty string')
  }
}

function addPolicyFields(agent: NonNullable<PolicyDocument['agents'][string]>, fields: FieldProvenance[]): void {
  if (agent.persona !== undefined) {
    fields.push({ field: 'persona', source: `agent.${agent.id}`, value: agent.persona })
  }
  if (agent.maxDepth !== undefined) {
    fields.push({ field: 'maxDepth', source: `agent.${agent.id}`, value: String(agent.maxDepth) })
  }
  if (agent.tools !== undefined) {
    fields.push({ field: 'tools', source: `agent.${agent.id}`, value: JSON.stringify(agent.tools) })
  }
  if (agent.skills !== undefined) {
    fields.push({
      field: 'skills',
      source: `agent.${agent.id}`,
      value: JSON.stringify(agent.skills),
      kind: 'metadata-only',
    })
  }
  if (agent.verification !== undefined) {
    fields.push({ field: 'verification', source: `agent.${agent.id}`, value: JSON.stringify(agent.verification) })
  }
}

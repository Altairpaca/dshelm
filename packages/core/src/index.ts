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

export interface AgentSpec {
  readonly id: string
  readonly role: string
  readonly profile: string
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

export function resolvePolicy(
  policy: PolicyDocument,
  runtime: RuntimeCapabilities,
  request: ResolveRequest,
): ResolvedAgentPolicy {
  const category = resolveCategory(policy, request.category)
  const agent = policy.agents[category.agent]
  if (!agent) {
    throw new PolicyResolutionError(
      'UNKNOWN_AGENT',
      `Category ${request.category} references unknown agent ${category.agent}`,
    )
  }

  const profile = policy.profiles[agent.profile]
  if (!profile) {
    throw new PolicyResolutionError(
      'UNKNOWN_PROFILE',
      `Agent ${agent.id} references unknown profile ${agent.profile}`,
    )
  }

  const override = request.override
  if (override && (Boolean(override.provider) !== Boolean(override.model))) {
    throw new PolicyResolutionError(
      'INVALID_OVERRIDE',
      'A model override must specify both provider and model',
    )
  }

  const trace: ResolutionTraceEntry[] = [
    { field: 'agent', source: `category.${request.category}`, value: agent.id },
    { field: 'modelProfile', source: `agent.${agent.id}`, value: profile.id },
  ]
  const reasoning = override?.reasoning ?? profile.reasoning
  if (reasoning) {
    trace.push({
      field: 'reasoning',
      source: override?.reasoning ? 'request.override' : `modelProfile.${profile.id}`,
      value: reasoning,
    })
  }

  let provider: string
  let model: string
  if (override?.provider && override.model) {
    assertCandidateAvailable(runtime, override.provider, override.model)
    provider = override.provider
    model = override.model
    trace.push({ field: 'model', source: 'request.override', value: model })
  } else {
    const selected = selectCandidate(profile, runtime, trace)
    provider = selected.provider
    model = selected.model
  }

  return {
    category: request.category,
    role: agent.role,
    provider,
    model,
    ...(reasoning ? { reasoning } : {}),
    trace,
  }
}

function resolveCategory(policy: PolicyDocument, id: string): CategorySpec {
  const visited = new Set<string>()
  let current = id
  while (true) {
    if (visited.has(current)) {
      throw new PolicyResolutionError('CYCLE', `Category inheritance cycle includes ${current}`)
    }
    visited.add(current)
    const category = policy.categories[current]
    if (!category) {
      throw new PolicyResolutionError('UNKNOWN_CATEGORY', `Unknown category ${current}`)
    }
    if (!category.inherits) {
      return category
    }
    current = category.inherits
  }
}

function selectCandidate(
  profile: ModelProfile,
  runtime: RuntimeCapabilities,
  trace: ResolutionTraceEntry[],
): ModelCandidate {
  let disabledProvider: string | undefined
  for (const candidate of profile.candidates) {
    trace.push({
      field: 'candidate',
      source: `modelProfile.${profile.id}`,
      value: `${candidate.provider}/${candidate.model}`,
    })
    const provider = runtime.providers[candidate.provider]
    if (!provider) {
      throw new PolicyResolutionError(
        'UNKNOWN_PROVIDER',
        `Profile ${profile.id} references unknown provider ${candidate.provider}`,
      )
    }
    if (!provider.enabled) {
      disabledProvider = candidate.provider
      continue
    }
    const model = provider.models[candidate.model]
    if (!model?.available) {
      continue
    }
    trace.push({
      field: 'model',
      source: `modelProfile.${profile.id}`,
      value: candidate.model,
    })
    return candidate
  }
  if (disabledProvider) {
    throw new PolicyResolutionError(
      'DISABLED_PROVIDER',
      `All candidates for profile ${profile.id} use disabled providers`,
    )
  }
  throw new PolicyResolutionError(
    'UNAVAILABLE_MODEL',
    `No available model candidate exists for profile ${profile.id}`,
  )
}

function assertCandidateAvailable(
  runtime: RuntimeCapabilities,
  providerId: string,
  modelId: string,
): void {
  const provider = runtime.providers[providerId]
  if (!provider) {
    throw new PolicyResolutionError('UNKNOWN_PROVIDER', `Unknown provider ${providerId}`)
  }
  if (!provider.enabled) {
    throw new PolicyResolutionError('DISABLED_PROVIDER', `Provider ${providerId} is disabled`)
  }
  if (!provider.models[modelId]?.available) {
    throw new PolicyResolutionError(
      'UNAVAILABLE_MODEL',
      `Model ${providerId}/${modelId} is unavailable`,
    )
  }
}

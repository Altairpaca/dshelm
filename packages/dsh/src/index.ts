import {
  resolvePolicy,
  type PolicyDocument,
  type ReasoningLevel,
  type RuntimeCapabilities,
} from '@deephelm/core'

export type DshRole = 'planner' | 'worker' | 'reviewer'

export interface DshSubagentStartOptions {
  readonly role: DshRole
  readonly provider: string
  readonly model: string
  readonly reasoning?: ReasoningLevel
}

export interface DshVerticalSliceRequest {
  readonly policy: PolicyDocument
  readonly runtime: RuntimeCapabilities
  readonly categories: {
    readonly planner: string
    readonly workers: readonly string[]
    readonly reviewer: string
  }
  readonly start: (options: DshSubagentStartOptions) => Promise<{ readonly output: string }>
}

export interface DshTraceEntry {
  readonly role: DshRole
  readonly provider: string
  readonly model: string
}

export interface DshVerticalSliceResult {
  readonly outputs: readonly string[]
  readonly trace: readonly DshTraceEntry[]
}

export interface DshSubagentStartRequestLike {
  readonly label?: string
  readonly prompt: readonly { readonly type: 'text'; readonly text: string }[]
  readonly parent: unknown
  readonly signal: AbortSignal
  readonly agentOptions?: { readonly provider?: string; readonly model?: string }
}

export interface DshSubagentRunLike {
  readonly result: Promise<{
    readonly output: readonly { readonly type?: string; readonly text?: string }[]
    readonly stopReason: string
  }>
  readonly dispose: () => Promise<void>
}

export interface DshSubagentsRuntimeLike {
  readonly start: (
    provider: string,
    request: DshSubagentStartRequestLike,
  ) => Promise<DshSubagentRunLike>
}

export function createDshSubagentStarter(
  subagents: DshSubagentsRuntimeLike,
  provider: string,
  parent: unknown,
  signal: AbortSignal,
): (options: DshSubagentStartOptions) => Promise<{ readonly output: string }> {
  return async (options) => {
    const run = await subagents.start(provider, {
      label: `deephelm:${options.role}`,
      prompt: [
        {
          type: 'text',
          text: `DeepHelm role=${options.role} provider=${options.provider} model=${options.model} reasoning=${options.reasoning ?? 'default'}`,
        },
      ],
      parent,
      signal,
      agentOptions: { provider: options.provider, model: options.model },
    })
    try {
      const result = await run.result
      if (result.stopReason !== 'completed') {
        throw new Error(`DSH subagent ${options.role} ended with ${result.stopReason}`)
      }
      return {
        output: result.output
          .filter((block) => block.type === 'text' && block.text !== undefined)
          .map((block) => block.text ?? '')
          .join(''),
      }
    } finally {
      await run.dispose()
    }
  }
}

export interface DshProviderSnapshot {
  readonly provider: string
  readonly enabled: boolean
  readonly models: readonly {
    readonly model: string
    readonly available: boolean
  }[]
}

export interface DshLlmInventory {
  readonly listProviders: () => readonly DshProviderSnapshot[]
}

export interface DshLlmRuntimeLike {
  readonly listProviders: () => readonly { readonly id: string; readonly name: string }[]
  readonly listModels: (
    provider: string,
  ) => Promise<readonly { readonly provider: string; readonly id: string; readonly name: string }[]>
}

export async function snapshotDshLlmRuntime(
  runtime: DshLlmRuntimeLike,
): Promise<RuntimeCapabilities> {
  const providers: Record<
    string,
    { readonly enabled: boolean; readonly models: Record<string, { readonly available: boolean }> }
  > = {}
  const providerRows = [...runtime.listProviders()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )
  for (const provider of providerRows) {
    if (providers[provider.id]) {
      throw new Error(`DSH LlmRuntime returned duplicate provider ${provider.id}`)
    }
    const modelRows = [...(await runtime.listModels(provider.id))].sort((left, right) =>
      left.id.localeCompare(right.id),
    )
    const models: Record<string, { readonly available: boolean }> = {}
    for (const model of modelRows) {
      if (model.provider !== provider.id) {
        throw new Error(`DSH LlmRuntime returned mismatched model provider ${model.provider}`)
      }
      if (models[model.id]) {
        throw new Error(`DSH LlmRuntime returned duplicate model ${provider.id}/${model.id}`)
      }
      models[model.id] = { available: true }
    }
    providers[provider.id] = { enabled: true, models }
  }
  return { providers }
}

export function mapDshInventory(inventory: DshLlmInventory): RuntimeCapabilities {
  const providers: Record<
    string,
    { readonly enabled: boolean; readonly models: Record<string, { readonly available: boolean }> }
  > = {}
  for (const snapshot of inventory.listProviders()) {
    const models: Record<string, { readonly available: boolean }> = {}
    for (const model of snapshot.models) {
      models[model.model] = { available: model.available }
    }
    providers[snapshot.provider] = { enabled: snapshot.enabled, models }
  }
  return { providers }
}

export async function runPlannerWorkersReviewer(
  request: DshVerticalSliceRequest,
): Promise<DshVerticalSliceResult> {
  const trace: DshTraceEntry[] = []
  const outputs: string[] = []

  const planner = resolvePolicy(request.policy, request.runtime, {
    category: request.categories.planner,
  })
  const plannerResult = await request.start(toStartOptions('planner', planner))
  trace.push(toTraceEntry('planner', planner))
  outputs.push(plannerResult.output)

  const workers = request.categories.workers.map((category) =>
    resolvePolicy(request.policy, request.runtime, { category }),
  )
  for (const worker of workers) {
    trace.push(toTraceEntry('worker', worker))
  }
  const workerResults = await Promise.all(
    workers.map(async (worker) => {
      const result = await request.start(toStartOptions('worker', worker))
      return result.output
    }),
  )
  outputs.push(...workerResults)

  const reviewer = resolvePolicy(request.policy, request.runtime, {
    category: request.categories.reviewer,
  })
  const reviewerResult = await request.start(toStartOptions('reviewer', reviewer))
  trace.push(toTraceEntry('reviewer', reviewer))
  outputs.push(reviewerResult.output)

  return { outputs, trace }
}

function toStartOptions(
  role: DshRole,
  resolved: ReturnType<typeof resolvePolicy>,
): DshSubagentStartOptions {
  return {
    role,
    provider: resolved.provider,
    model: resolved.model,
    ...(resolved.reasoning ? { reasoning: resolved.reasoning } : {}),
  }
}

function toTraceEntry(
  role: DshRole,
  resolved: ReturnType<typeof resolvePolicy>,
): DshTraceEntry {
  return {
    role,
    provider: resolved.provider,
    model: resolved.model,
  }
}

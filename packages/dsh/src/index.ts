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

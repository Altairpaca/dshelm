import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, {
  LlmAdapter,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { PolicyDocument, ResolvedAgentPolicy } from '../../core/src/index.ts'
import { DSHelmPolicyService, runPolicySlice } from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    planner: {
      id: 'planner',
      reasoning: 'high',
      candidates: [{ provider: 'example-fixture', model: 'reasoning-pro' }],
    },
    worker: {
      id: 'worker',
      reasoning: 'off',
      candidates: [{ provider: 'example-fixture', model: 'fast-worker' }],
    },
    reviewer: {
      id: 'reviewer',
      reasoning: 'high',
      candidates: [{ provider: 'example-fixture', model: 'reasoning-pro' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'planner' },
    worker: { id: 'worker', role: 'worker', profile: 'worker' },
    reviewer: {
      id: 'reviewer',
      role: 'reviewer',
      profile: 'reviewer',
      verification: { required: true, maxIterations: 1 },
    },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner' },
    execute: { id: 'execute', agent: 'worker' },
    review: { id: 'review', agent: 'reviewer' },
  },
}

const plan = JSON.stringify({
  goal: 'prepare a release-readiness note',
  summary: 'inspect behavior and verification independently',
  tasks: [
    { id: 'behavior', description: 'summarize the observable behavior', category: 'execute' },
    { id: 'verification', description: 'identify one verification requirement', category: 'execute' },
  ],
})

const scriptedOutputs = [
  plan,
  'Observable behavior: planner, workers, and reviewer execute through the DSH agent loop.',
  'Verification requirement: compare each generated request route with the DSHelm resolution trace.',
  JSON.stringify({ verdict: 'PASS', evidence: 'Both bounded worker outputs are non-empty and independently reviewable.' }),
]

function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    ...Array.from(text, (char): StreamChunk => ({ type: 'text-delta', index: 0, text: char })),
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

class ExampleAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  readonly #script: string[]

  constructor(script: readonly string[]) {
    super()
    this.#script = [...script]
  }

  providerInfo(provider: string) {
    return { id: provider, name: 'DSHelm example fixture' }
  }

  listModels() {
    return Promise.resolve([
      { provider: 'example-fixture', id: 'reasoning-pro', name: 'Reasoning Pro Fixture' },
      { provider: 'example-fixture', id: 'fast-worker', name: 'Fast Worker Fixture' },
    ])
  }

  resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [
          { id: 'off' as never, name: 'Off' },
          { id: 'high' as never, name: 'High' },
        ],
        defaultEffort: 'off' as never,
      },
    })
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const output = this.#script.shift()
    if (output === undefined) throw new Error('example adapter script exhausted')
    yield* textResponse(output)
  }
}

export interface DshExecutionExampleResult {
  readonly fixture: 'synthetic-provider-real-dsh-execution'
  readonly note: string
  readonly plan: {
    readonly goal: string
    readonly summary: string
    readonly tasks: readonly { readonly id: string; readonly description: string; readonly category: string }[]
  }
  readonly workers: readonly {
    readonly taskId: string
    readonly output: string
    readonly provider: string
    readonly model: string
  }[]
  readonly verdict: { readonly verdict: 'PASS' | 'REVISE'; readonly evidence: string; readonly revision?: string }
  readonly revisions: number
  readonly requestRoutes: readonly string[]
  readonly resolutions: readonly ResolvedAgentPolicy[]
}

export async function runDshExecutionExample(): Promise<DshExecutionExampleResult> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SubagentRuntime)

  const adapter = new ExampleAdapter(scriptedOutputs)
  ctx.llm.registerAdapter(['example-fixture'], adapter)
  const service = new DSHelmPolicyService(ctx, {
    layers: () => ({ defaults: policy }),
    llm: ctx.llm,
  })

  const result = await runPolicySlice(
    ctx,
    service,
    { text: 'prepare a release-readiness note', category: 'plan' },
    {
      categories: { planner: 'plan', workers: ['execute'], reviewer: 'review' },
      workerConcurrency: 2,
      maxRevisions: 1,
    },
  )

  return {
    fixture: 'synthetic-provider-real-dsh-execution',
    note: 'The model adapter is deterministic and credential-free; planner/worker/reviewer execution uses the real DSH agent factory and loop.',
    plan: result.plan,
    workers: result.workerResults.map(({ taskId, output, provider, model }) => ({ taskId, output, provider, model })),
    verdict: result.verdict,
    revisions: result.revisions,
    requestRoutes: adapter.requests.map((request) => `${request.provider}/${request.model}`),
    resolutions: result.traces,
  }
}

/**
 * Reference vertical slice (master contract P1):
 *
 * Goal → Planner → PlanArtifact → bounded parallel Workers → WorkerResults
 * → deterministic gates → Reviewer verdict (PASS | REVISE + evidence)
 * → bounded revision. Keyless: real rc.6 loop composition + scripted
 * adapters; every delegation runs through the official agent factory with
 * DSHelm model selection installed, and every resolved policy is recorded.
 *
 * Also covers the dshelm subagent provider registration and its label gate.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { type PolicyDocument } from '@dshelm/core'
import {
  DSHelmPolicyService,
  registerDSHelmProvider,
  roleFromLabel,
  runPolicySlice,
  childRequestHeaderSeed,
  type DSHelmPolicyServiceFace,
} from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    planner: { id: 'planner', reasoning: 'high', candidates: [{ provider: 'slice-test', model: 'slice-pro' }] },
    worker: { id: 'worker', reasoning: 'off', candidates: [{ provider: 'slice-test', model: 'slice-flash' }] },
    reviewer: {
      id: 'reviewer',
      reasoning: 'high',
      candidates: [{ provider: 'slice-test', model: 'slice-pro' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'planner' },
    worker: { id: 'worker', role: 'worker', profile: 'worker' },
    reviewer: {
      id: 'reviewer',
      role: 'reviewer',
      profile: 'reviewer',
      verification: { required: true, maxIterations: 2 },
    },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner' },
    execute: { id: 'execute', agent: 'worker' },
    review: { id: 'review', agent: 'reviewer' },
  },
}

const PLAN_JSON = JSON.stringify({
  goal: 'deliver the artifact',
  summary: 'two focused tasks',
  tasks: [
    { id: 't1', description: 'write the code', category: 'execute' },
    { id: 't2', description: 'write the tests', category: 'execute' },
  ],
})

function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    ...Array.from(text, (char): StreamChunk => ({ type: 'text-delta', index: 0, text: char })),
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

class SliceAdapter extends LlmAdapter {
  requests: GenerateOptions[] = []
  constructor(private readonly script: string[]) { super() }
  providerInfo(provider: string) { return { id: provider, name: provider } }
  listModels() { return Promise.resolve([{ provider: 'slice-test', id: 'slice-pro', name: 'Slice Pro' }, { provider: 'slice-test', id: 'slice-flash', name: 'Slice Flash' }]) }
  resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, reasoning: { efforts: [{ id: 'off' as never, name: 'Off' }, { id: 'high' as never, name: 'High' }], defaultEffort: 'off' as never } })
  }
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const entry = this.script.shift()
    if (entry === undefined) throw new Error('SliceAdapter: script exhausted')
    yield* textResponse(entry)
  }
}

async function sliceHarness(script: string[]) {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SubagentRuntime)
  const adapter = new SliceAdapter(script)
  ctx.llm.registerAdapter(['slice-test'], adapter)
  const service = new DSHelmPolicyService(ctx, { layers: () => ({ defaults: policy }), llm: ctx.llm })
  return { ctx, adapter, service }
}

describe('reference vertical slice (real dataflow, keyless)', () => {
  it('runs goal → plan → workers → PASS verdict with real artifacts', async () => {
    const { ctx, adapter, service } = await sliceHarness([
      PLAN_JSON,
      'code written',
      'tests written',
      JSON.stringify({ verdict: 'PASS', evidence: 'all outputs non-empty and on-topic' }),
    ])
    const sessionId = SessionId('slice-session-1')
    const result = await runPolicySlice(ctx, service, { text: 'deliver the artifact', category: 'plan' }, {
      categories: { planner: 'plan', workers: ['execute', 'execute'], reviewer: 'review' },
      workerConcurrency: 2,
      sessionId: String(sessionId),
    })

    // Real PlanArtifact from the planner's output.
    expect(result.plan.tasks).toHaveLength(2)
    expect(result.plan.tasks.map((task) => task.category)).toEqual(['execute', 'execute'])
    // Real WorkerResults, one per task.
    expect(result.workerResults).toHaveLength(2)
    expect(result.workerResults.map((w) => w.output)).toEqual(['code written', 'tests written'])
    expect(result.workerResults.map((w) => w.provider + '/' + w.model)).toEqual([
      'slice-test/slice-flash',
      'slice-test/slice-flash',
    ])
    // Structured reviewer verdict from the reviewer's output.
    expect(result.verdict).toEqual({ verdict: 'PASS', evidence: 'all outputs non-empty and on-topic' })
    expect(result.revisions).toBe(0)
    // Every delegation resolved + recorded (planner + 2 workers + reviewer).
    expect(result.traces).toHaveLength(4)
    expect(result.traces.map((t) => t.role)).toEqual(['planner', 'worker', 'worker', 'reviewer'])
    // The service snapshot carries the roles × models matrix rows.
    const snapshot = service.snapshot()
    expect(snapshot.roles.map((row) => row.role)).toEqual(['planner', 'worker', 'worker', 'reviewer'])
    expect(snapshot.roles.map((row) => row.provider + '/' + row.model)).toEqual([
      'slice-test/slice-pro',
      'slice-test/slice-flash',
      'slice-test/slice-flash',
      'slice-test/slice-pro',
    ])
    // Real requests hit the adapter with the resolved routes.
    expect(adapter.requests).toHaveLength(4)
    expect(adapter.requests.map((r) => r.provider + '/' + r.model)).toEqual([
      'slice-test/slice-pro',
      'slice-test/slice-flash',
      'slice-test/slice-flash',
      'slice-test/slice-pro',
    ])
  })

  it('bounded revision: REVISE → PASS flows real reviewer evidence', async () => {
    const { ctx, service } = await sliceHarness([
      PLAN_JSON,
      'v1 output',
      'v1 output',
      JSON.stringify({ verdict: 'REVISE', evidence: 'weak v1', revision: 'deepen both tasks' }),
      'v2 output',
      'v2 output',
      JSON.stringify({ verdict: 'PASS', evidence: 'v2 is solid' }),
    ])
    const result = await runPolicySlice(ctx, service, { text: 'deliver the artifact', category: 'plan' }, {
      categories: { planner: 'plan', workers: ['execute', 'execute'], reviewer: 'review' },
      workerConcurrency: 2,
    })
    expect(result.revisions).toBe(1)
    expect(result.verdict).toEqual({ verdict: 'PASS', evidence: 'v2 is solid' })
    expect(result.workerResults.map((w) => w.output)).toEqual(['v2 output', 'v2 output'])
    expect(result.traces).toHaveLength(7) // planner + 2×2 workers + 2 reviewers
  })

  it('terminates at the hard revision cap when the reviewer never passes', async () => {
    const { ctx, service } = await sliceHarness([
      PLAN_JSON,
      'x',
      'y',
      JSON.stringify({ verdict: 'REVISE', evidence: 'still bad', revision: 'again' }),
      'x2',
      'y2',
      JSON.stringify({ verdict: 'REVISE', evidence: 'still bad', revision: 'again' }),
      // cap reached: no more reviewer rounds
    ])
    const result = await runPolicySlice(ctx, service, { text: 'deliver the artifact', category: 'plan' }, {
      categories: { planner: 'plan', workers: ['execute', 'execute'], reviewer: 'review' },
      workerConcurrency: 2,
      maxRevisions: 2,
    })
    // verification.maxIterations: 2 wins over maxRevisions: 2 → cap = 1, so
    // the slice runs exactly two review rounds and stops.
    expect(result.revisions).toBe(1)
    expect(result.verdict.verdict).toBe('REVISE')
    expect(result.workerResults).toHaveLength(2)
  })
})

describe('dshelm subagent provider registration', () => {
  it('registers under dshelm and enforces the dshelm: role-label gate', async () => {
    const { ctx, service } = await sliceHarness([PLAN_JSON])
    const dispose = registerDSHelmProvider(ctx, {
      service: service as DSHelmPolicyServiceFace,
      categoryForRole: (role) => role,
      sessionIdOf: () => 'parent-session',
    })
    const subagents = ctx.reflect.get('subagents') as {
      start: (provider: string, request: { label?: string; agentOptions?: object; persona?: string }) => Promise<unknown>,
    }
    expect(subagents).toBeDefined()
    // A label without the dshelm: prefix is rejected before any resolution.
    await expect(subagents.start('dshelm', { agentOptions: {} })).rejects.toThrow(/dshelm provider/)
    expect(roleFromLabel('dshelm:planner')).toBe('planner')
    expect(roleFromLabel('other:planner')).toBeUndefined()
    const seed = childRequestHeaderSeed({
      category: 'plan',
      role: 'planner',
      provider: 'slice-test',
      model: 'slice-pro',
      reasoning: 'high',
      trace: { version: 1, request: { category: 'plan' }, category: 'plan', agent: 'planner', profile: 'planner', candidates: [], fields: [] },
    })
    expect(seed[0]).toMatchObject({ type: 'request/header', data: { header: { config: { provider: 'slice-test', model: 'slice-pro', reasoningEffort: 'high' } } } })
    dispose()
  })
})

/**
 * Reference vertical slice: Goal → Planner → PlanArtifact → bounded parallel
 * Workers → WorkerResults → deterministic gates → Reviewer verdict
 * (PASS | REVISE + evidence) → bounded revision.
 *
 * This is NOT a general workflow engine — it is the proof that
 * DSHelm policy → DSH execution holds, with real data flowing between
 * stages and a hard iteration bound (no infinite loops).
 */
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ResolvedAgentPolicy } from '@dshelm/core'
import type { DSHelmPolicyServiceFace } from './service.ts'
import { installDSHelmSelection, toModelSelection } from './model-selection.ts'
import { snapshotSessionLog } from './session-log-compat.ts'

export interface SliceGoal {
  /** The task text delivered to the planner. */
  readonly text: string
  /** Category the planner resolves through. */
  readonly category: string
}

export interface PlanArtifact {
  readonly goal: string
  readonly summary: string
  readonly tasks: readonly { readonly id: string; readonly description: string; readonly category: string }[]
}

export interface WorkerResult {
  readonly taskId: string
  readonly description: string
  readonly output: string
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly reasoning?: string
}

export type ReviewerVerdict =
  | { readonly verdict: 'PASS'; readonly evidence: string }
  | { readonly verdict: 'REVISE'; readonly evidence: string; readonly revision: string }

export interface SliceRunOptions {
  /** Which categories resolve planner / workers / reviewer. */
  readonly categories: { readonly planner: string; readonly workers: readonly string[]; readonly reviewer: string }
  /** Bounded parallel worker fan-out. */
  readonly workerConcurrency?: number
  /** Hard revision cap; the reviewer agent's verification.maxIterations wins when present. */
  readonly maxRevisions?: number
  /** Optional session to record control-plane snapshots onto. */
  readonly sessionId?: string
}

export interface SliceResult {
  readonly goal: SliceGoal
  readonly plan: PlanArtifact
  readonly workerResults: readonly WorkerResult[]
  readonly verdict: ReviewerVerdict
  /** 0..maxRevisions — the slice always terminates. */
  readonly revisions: number
  /** Canonical traces of every resolved delegation, in execution order. */
  readonly traces: readonly ResolvedAgentPolicy[]
}

/** Bounded concurrency map (deterministic completion semantics). */
async function mapBounded<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) return
      results[index] = await fn(item, index)
    }
  })
  await Promise.all(workers)
  return results
}

function parseJsonObject<T>(text: string, label: string): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error(`${label}: no JSON object in agent output`)
  }
  return JSON.parse(text.slice(start, end + 1)) as T
}

/** Run one role agent to completion and return its final text. */
export async function runRoleAgent(options: {
  readonly ctx: Context
  readonly resolved: ResolvedAgentPolicy
  readonly prompt: string
}): Promise<string> {
  const { ctx, resolved, prompt } = options
  const sessionId = SessionId(`session-${randomUUID()}`)
  const handle = await ctx.agents.create({
    sessionId,
    meta: { cwd: process.cwd(), origin: 'subagent' },
    agentOptions: { provider: resolved.provider, model: resolved.model },
    setup: (agentCtx) => {
      // Official model-selection composition: provider/model/reasoningEffort
      // enter the request config through the agent/request waterfall.
      installDSHelmSelection(agentCtx, toModelSelection(resolved))
      // Scoped persona, when policy declares one (official system-prompt
      // section; the same shape the in-process driver uses).
      if (resolved.persona !== undefined) {
        agentCtx.systemPrompt.section({ name: 'deployment:persona', order: 0, text: resolved.persona })
      }
    },
  })
  const { agent } = handle
  try {
    agent.followup(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: { kind: 'user' },
    }))
    await agent.whenIdle()
    return lastAssistantText(agent)
  } finally {
    await handle.dispose()
  }
}

function lastAssistantText(agent: Agent): string {
  let text = ''
  for (const event of snapshotSessionLog(agent.session)) {
    if (event.type === 'assistant/message') {
      const joined = event.data.message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
      if (joined !== '') text = joined
    }
  }
  return text
}

/**
 * Run the reference slice. Every agent is created through the official
 * factory with DSHelm model selection installed; every resolved policy is
 * recorded on the host service (control-plane snapshots) and returned in
 * `traces` for assertion against the actual request headers.
 */
export async function runPolicySlice(
  ctx: Context,
  service: DSHelmPolicyServiceFace,
  goal: SliceGoal,
  options: SliceRunOptions,
): Promise<SliceResult> {
  const concurrency = options.workerConcurrency ?? 2
  const traces: ResolvedAgentPolicy[] = []
  const record = (resolved: ResolvedAgentPolicy): void => {
    traces.push(resolved)
    if (options.sessionId !== undefined) service.recordDelegation(resolved, options.sessionId)
  }

  // 1. Planner: goal → PlanArtifact
  const planner = await service.resolve({ category: options.categories.planner })
  record(planner)
  const planText = await runRoleAgent({
    ctx,
    resolved: planner,
    prompt: [
      `You are the planner. Produce a plan for the goal below.`,
      `Reply with ONLY a JSON object of the shape:`,
      `{"goal": string, "summary": string, "tasks": [{"id": string, "description": string, "category": string}]}`,
      `Task categories must be one of: ${options.categories.workers.join(', ')}.`,
      `GOAL: ${goal.text}`,
    ].join('\n'),
  })
  const plan: PlanArtifact = parseJsonObject(planText, 'planner output')

  // 2. Bounded parallel workers with real PlanArtifact data flow.
  const maxRevisions = await revisionCap(service, options)
  let workerResults: WorkerResult[] = []
  let verdict: ReviewerVerdict = { verdict: 'REVISE', evidence: 'initial', revision: 'start' }
  let revisions = 0

  for (; revisions <= maxRevisions; revisions += 1) {
    const stageNote = revisions === 0 ? '' : `\nREVISION ROUND ${revisions} of ${maxRevisions}: ${verdict.verdict === 'REVISE' ? verdict.revision : ''}`
    workerResults = await mapBounded(plan.tasks, concurrency, async (task, index) => {
      const worker = await service.resolve({ category: task.category })
      record(worker)
      const output = await runRoleAgent({
        ctx,
        resolved: worker,
        prompt: [
          `You are worker ${index + 1} of ${plan.tasks.length}.`,
          `Task id: ${task.id}`,
          `Task: ${task.description}`,
          `Plan summary: ${plan.summary}`,
          stageNote,
          `Reply with your result text only.`,
        ].join('\n'),
      })
      return { taskId: task.id, description: task.description, output, role: worker.role, provider: worker.provider, model: worker.model, ...(worker.reasoning !== undefined ? { reasoning: worker.reasoning } : {}) }
    })

    // 3. Deterministic gate: every worker must have produced non-empty output.
    if (workerResults.some((result) => result.output.trim() === '')) {
      verdict = { verdict: 'REVISE', evidence: 'gate: empty worker output', revision: 'Re-run all tasks; produce non-empty results.' }
      if (revisions >= maxRevisions) break
      continue
    }

    // 4. Reviewer: worker results → structured verdict.
    const reviewer = await service.resolve({ category: options.categories.reviewer })
    record(reviewer)
    const reviewPrompt = [
      `You are the reviewer. Assess the worker results against the goal.`,
      `Reply with ONLY a JSON object of the shape:`,
      `{"verdict": "PASS" | "REVISE", "evidence": string, "revision": string}`,
      `"revision" is required when verdict is REVISE; omit it when PASS.`,
      `GOAL: ${goal.text}`,
      ...workerResults.map((result) => `TASK ${result.taskId}: ${result.description}\nRESULT: ${result.output}`),
    ].join('\n')
    const reviewText = await runRoleAgent({ ctx, resolved: reviewer, prompt: reviewPrompt })
    const parsed = parseJsonObject<{ verdict?: string; evidence?: string; revision?: string }>(reviewText, 'reviewer output')
    if (parsed.verdict === 'PASS') {
      verdict = { verdict: 'PASS', evidence: parsed.evidence ?? 'reviewer approved' }
      break
    }
    verdict = { verdict: 'REVISE', evidence: parsed.evidence ?? 'reviewer requested changes', revision: parsed.revision ?? 'Revise the task outputs.' }
    if (revisions >= maxRevisions) break
  }

  return { goal, plan, workerResults, verdict, revisions, traces }
}

async function revisionCap(
  service: DSHelmPolicyServiceFace,
  options: SliceRunOptions,
): Promise<number> {
  try {
    const reviewer = await service.resolve({ category: options.categories.reviewer })
    const policyMax = reviewer.verification?.maxIterations
    if (policyMax !== undefined) return Math.max(0, policyMax - 1)
  } catch {
    // Resolution failure surfaces in the slice itself; fall back to the cap.
  }
  return Math.max(0, (options.maxRevisions ?? 2) - 1)
}

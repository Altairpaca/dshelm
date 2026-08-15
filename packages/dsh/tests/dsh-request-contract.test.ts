/**
 * KEYLESS REAL-EXECUTION CONTRACT (master contract P0):
 *
 * DSHelm resolved policy → real DSH agent loop → actual request config.
 *
 * Assertions come from the FINAL request artifacts, never from
 * start(options) inputs:
 *  1. the adapter's received `GenerateOptions` (the actual provider I/O),
 *  2. the session log's `request/header` events (the logged request header).
 *
 * Both must equal the DSHelm ResolutionTrace (provider/model/reasoningEffort).
 * The harness is keyless: real rc.6 packages (LlmRuntime, SessionStore,
 * SystemPrompt, ToolRuntime, AgentRegistry, AgentLoop) + a scripted test
 * adapter — no credentials, no external checkouts.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, {
  LlmAdapter,
  ReasoningEffortId,
  createUserMessage,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { type PolicyDocument } from '@dshelm/core'
import {
  DSHelmPolicyService,
  installDSHelmSelection,
  toModelSelection,
} from '../src/index.ts'

/** Scripted rc.6 test adapter: records the actual GenerateOptions. */
class ScriptedAdapter extends LlmAdapter {
  requests: GenerateOptions[] = []

  providerInfo(provider: string) {
    return { id: provider, name: provider }
  }

  listModels(): Promise<readonly { provider: string; id: string; name: string }[]> {
    return Promise.resolve([
      { provider: 'dshelm-test', id: 'dshelm-pro', name: 'DSHelm Pro' },
      { provider: 'dshelm-test', id: 'dshelm-flash', name: 'DSHelm Flash' },
    ])
  }

  // LlmRuntime.resolveModelInfo (the service seam) delegates to the
  // adapter's resolveModel(provider, model, signal) — rc.6 lib/index.js.
  resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('off'), name: 'Off' },
          { id: ReasoningEffortId('high'), name: 'High' },
          { id: ReasoningEffortId('max'), name: 'Max' },
        ],
        defaultEffort: ReasoningEffortId('off'),
      },
    })
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const text = 'ok'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const policy: PolicyDocument = {
  profiles: {
    reasoningHigh: {
      id: 'reasoningHigh',
      reasoning: 'high',
      candidates: [{ provider: 'dshelm-test', model: 'dshelm-pro' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'reasoningHigh', persona: 'You plan carefully.' },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner' },
  },
}

async function harness() {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  const adapter = new ScriptedAdapter()
  ctx.llm.registerAdapter(['dshelm-test'], adapter)
  const service = new DSHelmPolicyService(ctx, {
    layers: () => ({ defaults: policy }),
    llm: ctx.llm,
  })
  return { ctx, adapter, service }
}

function lastAssistantText(agent: Agent): string {
  let text = ''
  for (const event of agent.session.events) {
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

describe('keyless real-execution contract (request/header == ResolutionTrace)', () => {
  it('routes DSHelm-resolved provider/model/reasoning into the actual request', async () => {
    const { ctx, adapter, service } = await harness()

    // 1. DSHelm resolution against the REAL LlmRuntime capability surface.
    const resolved = await service.resolve({ category: 'plan' })
    expect(resolved).toMatchObject({
      category: 'plan',
      role: 'planner',
      provider: 'dshelm-test',
      model: 'dshelm-pro',
      reasoning: 'high',
    })

    // 2. Real agent through the official factory with DSHelm model selection.
    const sessionId = SessionId('dshelm-request-contract')
    const handle = await ctx.agents.create({
      sessionId,
      meta: { cwd: process.cwd(), origin: 'subagent' },
      agentOptions: { provider: resolved.provider, model: resolved.model },
      setup: (agentCtx) => {
        installDSHelmSelection(agentCtx, toModelSelection(resolved))
        agentCtx.systemPrompt.section({ name: 'deployment:persona', order: 0, text: resolved.persona ?? '' })
      },
    })
    const { agent } = handle
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'plan the work' }],
        source: { kind: 'user' },
      }))
      await agent.whenIdle()

      // 3. The adapter received the ACTUAL GenerateOptions.
      expect(adapter.requests).toHaveLength(1)
      const actual = adapter.requests[0]
      expect(actual).toBeDefined()
      expect(actual?.provider).toBe('dshelm-test')
      expect(actual?.model).toBe('dshelm-pro')
      expect(actual?.reasoningEffort).toBe(ReasoningEffortId('high'))
      expect(lastAssistantText(agent)).toBe('ok')

      // 4. The session log carries the request/header with the same config.
      const headers = agent.session.events.filter((event) => event.type === 'request/header')
      expect(headers.length).toBeGreaterThanOrEqual(1)
      const header = headers[headers.length - 1]
      expect(header?.type).toBe('request/header')
      if (header?.type === 'request/header') {
        expect(header.data.header.config).toMatchObject({
          provider: 'dshelm-test',
          model: 'dshelm-pro',
          reasoningEffort: 'high',
        })
      }

      // 5. Acceptance: ResolutionTrace == actual request config.
      expect(resolved.trace.selected).toEqual({
        provider: 'dshelm-test',
        model: 'dshelm-pro',
        reasoning: 'high',
      })
      expect(actual?.provider).toBe(resolved.trace.selected?.provider)
      expect(actual?.model).toBe(resolved.trace.selected?.model)
      expect(actual?.reasoningEffort).toBe(ReasoningEffortId(resolved.trace.selected?.reasoning ?? ''))
    } finally {
      await handle.dispose()
    }
  })

  it('model selection leaves the route when the DSHelm resolution is overridden', async () => {
    const { ctx, adapter, service } = await harness()
    const resolved = await service.resolve({
      category: 'plan',
      override: { provider: 'dshelm-test', model: 'dshelm-flash', reasoning: 'max' },
    })
    expect(resolved).toMatchObject({ provider: 'dshelm-test', model: 'dshelm-flash', reasoning: 'max' })

    const sessionId = SessionId('dshelm-request-contract-override')
    const handle = await ctx.agents.create({
      sessionId,
      meta: { cwd: process.cwd(), origin: 'subagent' },
      agentOptions: { provider: resolved.provider, model: resolved.model },
      setup: (agentCtx) => {
        installDSHelmSelection(agentCtx, toModelSelection(resolved))
      },
    })
    const { agent } = handle
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'go' }],
        source: { kind: 'user' },
      }))
      await agent.whenIdle()
      const actual = adapter.requests[0]
      expect(actual?.provider).toBe('dshelm-test')
      expect(actual?.model).toBe('dshelm-flash')
      expect(actual?.reasoningEffort).toBe(ReasoningEffortId('max'))
    } finally {
      await handle.dispose()
    }
  })

  it('fails loud before I/O when the resolved reasoning effort is unsupported', async () => {
    const { ctx, adapter, service } = await harness()
    // 'deep-think' is not among the adapter's efforts: the runtime rejects it
    // at prepareCall (UNSUPPORTED_REASONING_EFFORT), before any stream I/O.
    const resolved = await service.resolve({
      category: 'plan',
      override: { provider: 'dshelm-test', model: 'dshelm-pro', reasoning: 'deep-think' },
    }).then(() => null, (error: unknown) => error)
    expect(resolved).not.toBeNull()
    expect((resolved as { code?: string }).code).toBe('UNSUPPORTED_REASONING')
    expect(adapter.requests).toHaveLength(0)
  })
})

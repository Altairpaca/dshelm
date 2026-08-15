/**
 * ExecutionBackend contract tests (v0.2):
 * - the native backend runs a role through the real agent factory with
 *   DSHelm model selection (scripted adapter);
 * - the agent-teams adapter is a typed prototype that fails loud (no fake
 *   runs) until the live mapping is wired with the plugin installed.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { DSHelmPolicyService, nativeExecutionBackend, agentTeamsExecutionBackend } from '../src/index.ts'
import { type PolicyDocument } from '@dshelm/core'

const policy: PolicyDocument = {
  profiles: {
    worker: { id: 'worker', reasoning: 'off', candidates: [{ provider: 'be-test', model: 'be-flash' }] },
  },
  agents: { worker: { id: 'worker', role: 'worker', profile: 'worker' } },
  categories: { execute: { id: 'execute', agent: 'worker' } },
}

class BeAdapter extends LlmAdapter {
  override providerInfo(provider: string) { return { id: provider, name: provider } }
  override listModels() { return Promise.resolve([{ provider: 'be-test', id: 'be-flash', name: 'BE Flash' }]) }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, reasoning: { efforts: [{ id: 'off' as never, name: 'Off' }], defaultEffort: 'off' as never } })
  }
  async * stream(_o: GenerateOptions): AsyncIterable<StreamChunk> {
    const text = 'worker-done'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 8 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function harness() {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter(['be-test'], new BeAdapter())
  const service = new DSHelmPolicyService(ctx, { layers: () => ({ defaults: policy }), llm: ctx.llm })
  return { ctx, service }
}

describe('ExecutionBackend contract', () => {
  it('native backend runs a resolved role through the real agent factory', async () => {
    const { ctx, service } = await harness()
    const resolved = await service.resolve({ category: 'execute' })
    const backend = nativeExecutionBackend(ctx)
    expect(backend.name).toBe('native')
    const result = await backend.run({
      role: 'worker',
      prompt: 'do the work',
      resolved,
    })
    expect(result).toEqual({ output: 'worker-done', backend: 'native' })
  })

  it('agent-teams adapter is a typed prototype that fails loud (no fake runs)', async () => {
    const backend = agentTeamsExecutionBackend({ teamId: 'team-1' })
    expect(backend.name).toBe('agent-teams')
    await expect(backend.run({
      role: 'worker',
      prompt: 'x',
      resolved: { category: 'execute', role: 'worker', provider: 'be-test', model: 'be-flash', trace: { version: 1, request: { category: 'execute' }, category: 'execute', agent: 'worker', profile: 'worker', candidates: [], fields: [] } },
    })).rejects.toThrow(/agent-teams backend/)
  })
})

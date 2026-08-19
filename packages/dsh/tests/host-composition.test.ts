/**
 * Stage 4 host-composition suite (real services, no fake ctx.provide proof):
 *
 *  - the DSHelm bundle plugin (name/Config/apply from @dshelm/dsh) mounts
 *    into a REAL composed context and provides `dshelm.policy` itself;
 *  - duplicate registration fails loud (Cordis duplicate-service rule);
 *  - disposing the plugin fiber unregisters the service (fiber lifecycle);
 *  - host→client transport: a real SessionStore + SessionProjectionRegistry
 *    fold `dshelm/control-plane` events into the `dshelm.controlPlane`
 *    projection value (the official session/projection wire path);
 *  - config precedence: .dshelm/config.jsonc project layer over defaults,
 *    malformed project files fail loud, settings wiring falls back to the
 *    composed entry when no settings provider is mounted (official contract).
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import {
  ConfigResolutionError,
  loadPolicyLayers,
  type PolicyDocument,
} from '@dshelm/core'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import {
  apply as dshelmApply,
  inject as dshelmInject,
  dshelmControlPlaneProjection,
  installDSHelmSettings,
  loadProjectPolicyLayer,
  type DSHelmPolicyServiceFace,
} from '../src/index.ts'

const basePolicy: PolicyDocument = {
  profiles: {
    planner: {
      id: 'planner',
      reasoning: 'high',
      candidates: [{ provider: 'comp-test', model: 'comp-pro' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'planner' },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner' },
  },
}

class CompAdapter extends LlmAdapter {
  providerInfo(provider: string) { return { id: provider, name: provider } }
  listModels() { return Promise.resolve([{ provider: 'comp-test', id: 'comp-pro', name: 'Comp Pro' }]) }
  resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, reasoning: { efforts: [{ id: 'high' as never, name: 'High' }] } })
  }
  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    const text = 'ok'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 2 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

class KnowledgeAdapter extends CompAdapter {
  override providerInfo(provider: string) { return { id: provider, name: 'DeepSeek' } }
  override listModels() { return Promise.resolve([{ provider: 'deepseek', id: 'deepseek-v4-pro', name: 'V4 Pro' }, { provider: 'deepseek', id: 'deepseek-v4-flash', name: 'V4 Flash' }]) }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, reasoning: { efforts: [{ id: 'high' as never, name: 'High' }] } })
  }
}

async function composedContext() {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SubagentRuntime)
  ctx.llm.registerAdapter(['comp-test'], new CompAdapter())
  ctx.llm.registerAdapter(['deepseek'], new KnowledgeAdapter())
  return ctx
}

describe('DSHelm bundle host service (real composition)', () => {
  it('mounts dshelm.policy from the bundle itself and resolves against the real runtime', async () => {
    const ctx = await composedContext()
    const fiber = await ctx.plugin({ name: 'dshelm', inject: dshelmInject, apply: dshelmApply }, { defaults: basePolicy })
    try {
      const service = ctx.reflect.get('dshelm.policy') as DSHelmPolicyServiceFace
      expect(service).toBeDefined()
      const resolved = await service.resolve({ category: 'plan' })
      expect(resolved).toMatchObject({ provider: 'comp-test', model: 'comp-pro', reasoning: 'high' })
    } finally {
      await fiber.dispose()
    }
  })

  it('uses the shipped model knowledge overlay in the live composed service', async () => {
    const ctx = await composedContext()
    const fiber = await ctx.plugin({ name: 'dshelm', inject: dshelmInject, apply: dshelmApply }, {
      defaults: {
        profiles: { mixed: { id: 'mixed', candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }, { provider: 'deepseek', model: 'deepseek-v4-flash' }] } },
        agents: { worker: { id: 'worker', role: 'worker', profile: 'mixed' } },
        categories: { implement: { id: 'implement', agent: 'worker' } },
      },
    })
    try {
      const service = ctx.reflect.get('dshelm.policy') as DSHelmPolicyServiceFace
      const resolved = await service.resolve({ category: 'implement', requirements: { needsCheapParallelism: true } })
      expect(resolved.model).toBe('deepseek-v4-flash')
      expect(resolved.trace.modelKnowledgeSnapshot).toBe('dshelm-v0.3-baseline-2026-08-18')
    } finally {
      await fiber.dispose()
    }
  })

  it('fails loud on duplicate registration in the same scope', async () => {
    const ctx = await composedContext()
    const first = await ctx.plugin({ name: 'dshelm', inject: dshelmInject, apply: dshelmApply }, { defaults: basePolicy })
    try {
      await expect(ctx.plugin({ name: 'dshelm', inject: dshelmInject, apply: dshelmApply }, { defaults: basePolicy }))
        .rejects.toThrow(/has been registered/)
    } finally {
      await first.dispose()
    }
  })

  it('unregisters the service when the plugin fiber disposes', async () => {
    const ctx = await composedContext()
    const fiber = await ctx.plugin({ name: 'dshelm', inject: dshelmInject, apply: dshelmApply }, { defaults: basePolicy })
    expect(ctx.reflect.get('dshelm.policy')).toBeDefined()
    await fiber.dispose()
    expect(ctx.reflect.get('dshelm.policy')).toBeUndefined()
  })
})

describe('host→client projection transport (official session/projection path)', () => {
  it('folds dshelm/control-plane events into the dshelm.controlPlane projection', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    const disposeProjection = ctx.sessionProjections.register(dshelmControlPlaneProjection)
    try {
      const session = ctx.sessions.create(SessionId('cp-session'))
      const snapshot = {
        version: 1 as const,
        request: { category: 'plan' },
        roles: [{ role: 'planner', category: 'plan', agent: 'planner', profile: 'planner', provider: 'comp-test', model: 'comp-pro' }],
        inspector: { request: 'plan', trace: { version: 1, request: { category: 'plan' }, category: 'plan', agent: 'planner', profile: 'planner', candidates: [], fields: [] } },
        source: 'host:test',
      }
      session.append('dshelm/control-plane', snapshot)
      const cut = ctx.sessionProjections.snapshot(session)
      const value = cut.values['dshelm.controlPlane'] as { roles: readonly unknown[] } | undefined
      expect(value).toBeDefined()
      expect(value?.roles).toHaveLength(1)
      // The registry drives on session/event; the value above came from the
      // lazy fold (values are contract; the watermark is registry internals).
      // The wire schema gate accepts the payload (schema-validated on view).
      expect(() => ctx.sessionProjections.snapshot(session)).not.toThrow()
    } finally {
      disposeProjection()
    }
  })
})

describe('config precedence (.dshelm/config.jsonc + settings fallback)', () => {
  it('project layer overrides defaults and stays runtime-validated', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dshelm-config-'))
    try {
      await mkdir(join(dir, '.dshelm'), { recursive: true })
      await writeFile(
        join(dir, '.dshelm/config.jsonc'),
        JSON.stringify({ profiles: { planner: { id: 'planner', reasoning: 'high', candidates: [{ provider: 'comp-test', model: 'project-model' }] } } }),
      )
      const project = await loadProjectPolicyLayer(dir)
      expect(project).toBeDefined()
      const merged = loadPolicyLayers({ defaults: basePolicy, project })
      expect(merged.profiles['planner']?.candidates[0]?.model).toBe('project-model')
      // .dshelm/local is runtime-local only and never read as a layer.
      await mkdir(join(dir, '.dshelm/local'), { recursive: true })
      await writeFile(join(dir, '.dshelm/local/scratch.jsonc'), '{}')
      const mergedAgain = loadPolicyLayers({ defaults: basePolicy, project: await loadProjectPolicyLayer(dir) })
      expect(mergedAgain.profiles['planner']?.candidates[0]?.model).toBe('project-model')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('malformed project config fails loud with ConfigResolutionError', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dshelm-badconfig-'))
    try {
      await mkdir(join(dir, '.dshelm'), { recursive: true })
      await writeFile(join(dir, '.dshelm/config.jsonc'), '{ profiles: nope')
      const project = await loadProjectPolicyLayer(dir)
      expect(() => loadPolicyLayers({ defaults: basePolicy, project })).toThrow(ConfigResolutionError)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('settings wiring falls back to the composed entry without a settings provider', () => {
    const ctx = new Context()
    const base = { profiles: { planner: { id: 'planner', reasoning: 'high', candidates: [{ provider: 'comp-test', model: 'user-model' }] } } }
    const readUser = installDSHelmSettings(ctx, base)
    expect(readUser()).toBe(base)
    const merged = loadPolicyLayers({ defaults: basePolicy, user: readUser() as never })
    expect(merged.profiles['planner']?.candidates[0]?.model).toBe('user-model')
  })
})

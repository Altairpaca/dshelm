import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type PolicyDocument, type RuntimeCapabilities } from '@deephelm/core'
import {
  createDshSubagentStarter,
  snapshotDshLlmRuntime,
  runPlannerWorkersReviewer,
  type DshSubagentsRuntimeLike,
  type DshSubagentStartOptions,
} from '../src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    planner: {
      id: 'planner',
      reasoning: 'high',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }],
    },
    worker: {
      id: 'worker',
      reasoning: 'medium',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
    },
    reviewer: {
      id: 'reviewer',
      reasoning: 'high',
      candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }],
    },
  },
  agents: {
    planner: { id: 'planner', role: 'planner', profile: 'planner' },
    worker: { id: 'worker', role: 'worker', profile: 'worker' },
    reviewer: { id: 'reviewer', role: 'reviewer', profile: 'reviewer' },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner' },
    execute: { id: 'execute', agent: 'worker' },
    review: { id: 'review', agent: 'reviewer' },
  },
}

const runtime: RuntimeCapabilities = {
  providers: {
    deepseek: {
      enabled: true,
      models: {
        'deepseek-v4-pro': { available: true },
        'deepseek-v4-flash': { available: true },
      },
    },
  },
}

describe('keyless planner-workers-reviewer vertical slice', () => {
  it('maps resolved options into the public ctx.subagents.start request', async () => {
    const calls: Array<{
      readonly provider: string
      readonly request: { readonly agentOptions?: { readonly provider?: string; readonly model?: string } }
    }> = []
    const controller = new AbortController()
    const start = createDshSubagentStarter(
      {
        start: async (provider, request) => {
          calls.push({ provider, request })
          return {
            result: Promise.resolve({
              output: [{ type: 'text', text: 'subagent-sentinel' }],
              stopReason: 'completed' as const,
            }),
            dispose: async () => {},
          }
        },
      },
      'spawn',
      { id: 'parent-session' },
      controller.signal,
    )

    const result = await start({
      role: 'planner',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    })

    expect(result.output).toBe('subagent-sentinel')
    expect(calls[0]?.provider).toBe('spawn')
    expect(calls[0]?.request.agentOptions).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    })
  })

  it('invokes the pinned DSH SubagentRuntime service and disposes its run', async () => {
    const dshRoot = new URL(
      '../../deephelm-community/deepseek-harness/',
      pathToFileURL(`${process.cwd()}/`).href,
    )
    const { Context } = await import(
      new URL('vendor/cordis/lib/index.js', dshRoot).href
    )
    const { SubagentRuntime } = await import(
      new URL('packages/subagent/subagent/lib/index.js', dshRoot).href
    )
    const context = new Context()
    const runtimeFiber = await context.plugin(SubagentRuntime)
    const calls: Array<{ readonly provider: string; readonly model?: string }> = []
    let disposed = false
    try {
      const subagents = context.reflect.get('subagents') as DshSubagentsRuntimeLike & {
        registerProvider: (provider: unknown) => () => void
      }
      expect(subagents).toBeDefined()
      subagents.registerProvider({
        name: 'deephelm-test',
        capabilities: { outputSchema: false, depthLimit: false, toolFilter: false, persona: false },
        inheritsParentContext: false,
        start: async (request: {
          readonly agentOptions?: { readonly provider?: string; readonly model?: string }
        }) => {
          calls.push({
            provider: request.agentOptions?.provider ?? 'missing',
            model: request.agentOptions?.model,
          })
          return {
            id: 'child-session',
            localAgent: undefined,
            result: Promise.resolve({
              output: [{ type: 'text', text: 'real-subagent-sentinel' }],
              stopReason: 'completed',
            }),
            dispose: async () => {
              disposed = true
            },
          }
        },
      })
      const start = createDshSubagentStarter(
        subagents,
        'deephelm-test',
        { id: 'parent-session', session: { id: 'parent-session' } },
        new AbortController().signal,
      )
      const result = await runPlannerWorkersReviewer({
        policy,
        runtime,
        categories: {
          planner: 'plan',
          workers: ['execute', 'execute'],
          reviewer: 'review',
        },
        start,
      })
      expect(result.outputs).toEqual([
        'real-subagent-sentinel',
        'real-subagent-sentinel',
        'real-subagent-sentinel',
        'real-subagent-sentinel',
      ])
      expect(calls).toEqual([
        { provider: 'deepseek', model: 'deepseek-v4-pro' },
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
        { provider: 'deepseek', model: 'deepseek-v4-pro' },
      ])
      expect(disposed).toBe(true)
    } finally {
      await runtimeFiber.dispose()
    }
  })

  it('snapshots the public DSH LlmRuntime provider and model catalog', async () => {
    const capabilities = await snapshotDshLlmRuntime({
      listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
      listModels: async (provider) => [
        { provider, id: 'deepseek-v4-pro', name: 'V4 Pro' },
        { provider, id: 'deepseek-v4-flash', name: 'V4 Flash' },
      ],
    })

    expect(capabilities).toEqual({
      providers: {
        deepseek: {
          enabled: true,
          models: {
            'deepseek-v4-pro': { available: true },
            'deepseek-v4-flash': { available: true },
          },
        },
      },
    })
  })

  it('pins resolved model options through the real adapter seam', async () => {
    const events: string[] = []
    const calls: DshSubagentStartOptions[] = []

    const result = await runPlannerWorkersReviewer({
      policy,
      runtime,
      categories: {
        planner: 'plan',
        workers: ['execute', 'execute'],
        reviewer: 'review',
      },
      start: async (options) => {
        calls.push(options)
        events.push(`start:${options.role}`)
        return { output: `${options.role}-sentinel` }
      },
    })

    expect(calls).toHaveLength(4)
    expect(calls.map(({ role }) => role)).toEqual([
      'planner',
      'worker',
      'worker',
      'reviewer',
    ])
    expect(calls.map(({ provider, model }) => `${provider}/${model}`)).toEqual([
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-pro',
    ])
    expect(events).toEqual(['start:planner', 'start:worker', 'start:worker', 'start:reviewer'])
    expect(result.outputs).toEqual([
      'planner-sentinel',
      'worker-sentinel',
      'worker-sentinel',
      'reviewer-sentinel',
    ])
    expect(result.trace.map(({ role, provider, model }) => `${role}:${provider}/${model}`)).toEqual(
      calls.map(({ role, provider, model }) => `${role}:${provider}/${model}`),
    )
  })

  it('mounts the policy service in the pinned Cordis Loader composition', async () => {
    const dshRoot = new URL(
      '../../deephelm-community/deepseek-harness/',
      pathToFileURL(`${process.cwd()}/`).href,
    )
    const { Context } = await import(
      new URL('vendor/cordis/lib/index.js', dshRoot).href
    )
    const { Loader } = await import(
      new URL('vendor/loader/lib/index.js', dshRoot).href
    )
    const context = new Context()
    const loaderFiber = await context.plugin(Loader)
    const service = {
      run: () =>
        runPlannerWorkersReviewer({
          policy,
          runtime,
          categories: {
            planner: 'plan',
            workers: ['execute', 'execute'],
            reviewer: 'review',
          },
          start: async (options) => ({ output: `${options.role}-loader-sentinel` }),
        }),
    }

    try {
      await context.plugin((ctx: typeof context) => {
        ctx.provide('deephelmPolicy', service)
      })
      expect(context.reflect.get('loader')?.constructor.name).toBe('Loader')
      expect(context.reflect.get('deephelmPolicy')).toBe(service)
      const result = await service.run()
      expect(result.trace.map(({ role, model }) => `${role}:${model}`)).toEqual([
        'planner:deepseek-v4-pro',
        'worker:deepseek-v4-flash',
        'worker:deepseek-v4-flash',
        'reviewer:deepseek-v4-pro',
      ])
    } finally {
      await loaderFiber.dispose()
    }
  })
})

import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type PolicyDocument, type RuntimeCapabilities } from '@deephelm/core'
import {
  runPlannerWorkersReviewer,
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

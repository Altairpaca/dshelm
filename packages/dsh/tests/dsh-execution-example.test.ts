import { describe, expect, it } from 'vitest'
import { runDshExecutionExample } from '../../../examples/dsh-execution-fixture.ts'

describe('DSH execution example', () => {
  it('executes planner, bounded workers, and reviewer through real DSH request routing', async () => {
    const result = await runDshExecutionExample()

    expect(result.fixture).toBe('synthetic-provider-real-dsh-execution')
    expect(result.plan.tasks).toHaveLength(2)
    expect(result.workers).toHaveLength(2)
    expect(result.workers.map((worker) => worker.taskId)).toEqual(['behavior', 'verification'])
    expect(result.verdict).toEqual({
      verdict: 'PASS',
      evidence: 'Both bounded worker outputs are non-empty and independently reviewable.',
    })
    expect(result.revisions).toBe(0)

    const resolvedRoutes = result.resolutions.map((resolution) => `${resolution.provider}/${resolution.model}`)
    expect(resolvedRoutes).toEqual([
      'example-fixture/reasoning-pro',
      'example-fixture/fast-worker',
      'example-fixture/fast-worker',
      'example-fixture/reasoning-pro',
    ])
    expect(result.requestRoutes).toEqual(resolvedRoutes)
    expect(result.resolutions.map((resolution) => resolution.role)).toEqual(['planner', 'worker', 'worker', 'reviewer'])

    for (const resolution of result.resolutions) {
      expect(resolution.trace.selected).toMatchObject({
        provider: resolution.provider,
        model: resolution.model,
      })
      expect(resolution.trace.candidates.length).toBeGreaterThanOrEqual(1)
    }

    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/api[_-]?key|cookie|bearer\s|credential/i)
  })
})

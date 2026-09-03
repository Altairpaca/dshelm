import { describe, expect, it } from 'vitest'
import { buildFirstRunResult } from './first-run-fixture.ts'

describe('first-run routing fixture', () => {
  it('routes planner/workers/reviewer deterministically without credentials', async () => {
    const first = await buildFirstRunResult()
    const second = await buildFirstRunResult()

    expect(second).toEqual(first)
    expect(first.fixture).toBe('offline-routing-only')
    expect(first.steps.map((step) => step.step)).toEqual(['planner', 'worker-a', 'worker-b', 'reviewer'])
    expect(first.steps.map((step) => step.resolution.role)).toEqual(['planner', 'worker', 'worker', 'reviewer'])
    expect(first.steps.map((step) => step.resolution.model)).toEqual([
      'reasoning-pro',
      'fast-worker',
      'fast-worker',
      'reasoning-pro',
    ])

    for (const step of first.steps) {
      expect(step.resolution.trace.version).toBe(2)
      expect(step.resolution.trace.selected).toBeDefined()
      expect(step.resolution.trace.candidates.length).toBeGreaterThanOrEqual(2)
      expect(step.resolution.trace.modelKnowledgeSnapshot).toBe('first-run-fixture-v1')
    }

    const serialized = JSON.stringify(first)
    expect(serialized).not.toMatch(/token|cookie|api[_-]?key|credential/i)
  })
})

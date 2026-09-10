import { describe, expect, it } from 'vitest'
import { classifyRouteDivergence } from '../src/effective-route.ts'

const flash = { provider: 'deepseek', model: 'deepseek-flash', reasoning: 'low' }
const pro = { provider: 'deepseek', model: 'deepseek-v4-pro', reasoning: 'high' }

describe('classifyRouteDivergence', () => {
  it('keeps missing runtime evidence explicitly unknown', () => {
    expect(classifyRouteDivergence({ resolved: flash })).toEqual({
      kind: 'unknown',
      changes: [],
      policyChanges: [],
      runtimeChanges: [],
    })
  })

  it('reports a fully matching effective route', () => {
    expect(classifyRouteDivergence({ requested: flash, resolved: flash, effective: flash })).toEqual({
      kind: 'same-route',
      changes: [],
      policyChanges: [],
      runtimeChanges: [],
      matchesResolved: true,
    })
  })

  it('separates policy change from runtime agreement', () => {
    expect(classifyRouteDivergence({
      requested: flash,
      resolved: pro,
      effective: pro,
      resolutionCause: 'policy',
    })).toEqual({
      kind: 'model-change',
      changes: ['model', 'reasoning'],
      policyChanges: ['model', 'reasoning'],
      runtimeChanges: [],
      matchesResolved: true,
    })
  })

  it('separates host/runtime drift from policy intent', () => {
    expect(classifyRouteDivergence({ requested: flash, resolved: flash, effective: pro })).toEqual({
      kind: 'model-change',
      changes: ['model', 'reasoning'],
      policyChanges: [],
      runtimeChanges: ['model', 'reasoning'],
      matchesResolved: false,
    })
  })

  it('preserves explicit override as the divergence cause', () => {
    expect(classifyRouteDivergence({
      requested: flash,
      resolved: pro,
      effective: pro,
      resolutionCause: 'explicit-override',
    }).kind).toBe('explicit-override')
  })

  it('preserves fallback as the divergence cause', () => {
    expect(classifyRouteDivergence({
      requested: flash,
      resolved: pro,
      effective: pro,
      resolutionCause: 'fallback',
    }).kind).toBe('fallback')
  })

  it('uses provider-change precedence while retaining all changed fields', () => {
    const result = classifyRouteDivergence({
      requested: flash,
      resolved: flash,
      effective: { provider: 'openai', model: 'gpt-5.6-sol', reasoning: 'medium' },
    })
    expect(result.kind).toBe('provider-change')
    expect(result.changes).toEqual(['provider', 'model', 'reasoning'])
    expect(result.runtimeChanges).toEqual(['provider', 'model', 'reasoning'])
  })

  it('falls back to resolved as the comparison baseline when requested is absent', () => {
    const result = classifyRouteDivergence({
      resolved: flash,
      effective: { ...flash, reasoning: 'high' },
    })
    expect(result.kind).toBe('reasoning-change')
    expect(result.changes).toEqual(['reasoning'])
    expect(result.policyChanges).toEqual([])
    expect(result.runtimeChanges).toEqual(['reasoning'])
  })
})

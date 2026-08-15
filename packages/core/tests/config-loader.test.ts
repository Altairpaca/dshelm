import { describe, expect, it } from 'vitest'
import {
  ConfigResolutionError,
  loadPolicyLayers,
  serializePolicy,
  type RuntimeCapabilities,
} from '../src/index.ts'
import { resolvePolicy } from '../src/index.ts'

const runtime: RuntimeCapabilities = {
  providers: {
    deepseek: {
      enabled: true,
      resolveModel: (model) => ({
        valid: true,
        reasoningEfforts: ['off', 'high', 'max'],
      }),
    },
  },
}

describe('loadPolicyLayers', () => {
  it('merges defaults, user, project, and request in explicit precedence order', async () => {
    const policy = loadPolicyLayers({
      defaults: `{
        // shipped defaults
        "profiles": {
          "fast": {"id": "fast", "reasoning": "medium", "candidates": [{"provider": "deepseek", "model": "deepseek-v4-flash"}]},
          "strong": {"id": "strong", "reasoning": "max", "candidates": [{"provider": "deepseek", "model": "deepseek-v4-pro"}]}
        },
        "agents": {"planner": {"id": "planner", "role": "planner", "profile": "fast"}},
        "categories": {"deep": {"id": "deep", "agent": "planner"}}
      }`,
      user: `{"agents": {"planner": {"profile": "strong"}}}`,
      project: `{"agents": {"planner": {"profile": "fast"}}}`,
      request: `{"agents": {"planner": {"profile": "strong"}}}`,
    })

    expect(policy.agents['planner']?.profile).toBe('strong')
    const resolved = await resolvePolicy(policy, runtime, { category: 'deep' })
    expect(resolved.model).toBe('deepseek-v4-pro')
  })

  it('rejects malformed JSONC and unknown top-level keys with machine-readable errors', () => {
    expect(() => loadPolicyLayers({ project: '{"profiles": ' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSONC' }),
    )
    expect(() => loadPolicyLayers({ project: '{"mystery": {}}' })).toThrowError(
      expect.objectContaining({ code: 'UNKNOWN_KEY' }),
    )
  })

  it('returns a plain JSON-serializable, deeply frozen policy snapshot', () => {
    const policy = loadPolicyLayers({
      defaults: {
        profiles: {
          fast: {
            id: 'fast',
            candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
          },
        },
        agents: { worker: { id: 'worker', role: 'worker', profile: 'fast' } },
        categories: { execute: { id: 'execute', agent: 'worker' } },
      },
    })

    expect(JSON.parse(JSON.stringify(policy))).toEqual(policy)
    expect(Object.isFrozen(policy.profiles)).toBe(true)
    expect(Object.isFrozen(policy.profiles.fast?.candidates ?? [])).toBe(true)
  })

  it('serializes the same layer input to the same canonical string', () => {
    const left = loadPolicyLayers({
      project: {
        profiles: { p: { id: 'p', candidates: [{ provider: 'deepseek', model: 'm' }] } },
        agents: { a: { id: 'a', role: 'r', profile: 'p' } },
        categories: { c: { id: 'c', agent: 'a' } },
      },
    })
    const right = loadPolicyLayers({
      project: {
        agents: { a: { id: 'a', role: 'r', profile: 'p' } },
        categories: { c: { id: 'c', agent: 'a' } },
        profiles: { p: { id: 'p', candidates: [{ provider: 'deepseek', model: 'm' }] } },
      },
    })
    expect(serializePolicy(left)).toBe(serializePolicy(right))
  })

  it('exposes a stable error class for diagnostics consumers', () => {
    expect(new ConfigResolutionError('UNKNOWN_KEY', 'bad key')).toBeInstanceOf(Error)
  })
})

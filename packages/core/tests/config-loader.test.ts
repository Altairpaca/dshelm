import { describe, expect, it } from 'vitest'
import {
  ConfigResolutionError,
  loadPolicyLayers,
  type RuntimeCapabilities,
} from '../src/index.ts'
import { resolvePolicy } from '../src/index.ts'

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

describe('loadPolicyLayers', () => {
  it('merges defaults, user, project, and request in explicit precedence order', () => {
    const policy = loadPolicyLayers({
      defaults: `{
        // shipped defaults
        "profiles": {
          "fast": {"id": "fast", "reasoning": "medium", "candidates": [{"provider": "deepseek", "model": "deepseek-v4-flash"}]},
          "strong": {"id": "strong", "reasoning": "high", "candidates": [{"provider": "deepseek", "model": "deepseek-v4-pro"}]}
        },
        "agents": {"planner": {"id": "planner", "role": "planner", "profile": "fast"}},
        "categories": {"deep": {"id": "deep", "agent": "planner"}}
      }`,
      user: `{"agents": {"planner": {"profile": "strong"}}}`,
      project: `{"agents": {"planner": {"profile": "fast"}}}`,
      request: `{"agents": {"planner": {"profile": "strong"}}}`,
    })

    expect(policy.agents.planner?.profile).toBe('strong')
    const resolved = resolvePolicy(policy, runtime, { category: 'deep' })
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

  it('returns a plain JSON-serializable policy snapshot', () => {
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
  })

  it('exposes a stable error class for diagnostics consumers', () => {
    expect(new ConfigResolutionError('UNKNOWN_KEY', 'bad key')).toBeInstanceOf(Error)
  })
})

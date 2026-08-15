import { describe, expect, it } from 'vitest'
import {
  ConfigResolutionError,
  loadPolicyLayers,
  validatePolicy,
} from '../src/index.ts'

function expectCode(action: () => unknown, code: ConfigResolutionError['code']): ConfigResolutionError {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigResolutionError)
    expect((error as ConfigResolutionError).code).toBe(code)
    return error as ConfigResolutionError
  }
  throw new Error(`expected ConfigResolutionError with code ${code}, nothing thrown`)
}

const valid = {
  profiles: { p: { id: 'p', candidates: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }] } },
  agents: { a: { id: 'a', role: 'worker', profile: 'p' } },
  categories: { c: { id: 'c', agent: 'a', description: 'small verifiable changes' } },
}

describe('runtime policy schema validation', () => {
  it('accepts a well-formed document', () => {
    expect(validatePolicy(valid)).toBeDefined()
  })

  it('rejects malformed nested profiles', () => {
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: 'nope' } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: [] } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: [{ provider: '', model: 'm' }] } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: [{ provider: 'x' }] } } }),
      'INVALID_POLICY',
    )
  })

  it('rejects invalid candidates and missing fields', () => {
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm', mystery: 1 }] } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ agents: { a: { id: 'a', role: '', profile: 'p' } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ agents: { a: { id: 'a', role: 'r' } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ categories: { c: { id: 'c' } } }),
      'INVALID_POLICY',
    )
  })

  it('rejects unknown fields per the explicit allowlist policy', () => {
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm' }], extra: 1 } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', fallback: 'x' } } }),
      'INVALID_POLICY',
    )
  })

  it('rejects empty candidate lists', () => {
    expectCode(
      () => validatePolicy({ profiles: { p: { id: 'p', candidates: [] } } }),
      'INVALID_POLICY',
    )
  })

  it('accepts an optional category description and rejects malformed ones', () => {
    expect(validatePolicy({ ...valid, categories: { c: { id: 'c', agent: 'a' } } })).toBeDefined()
    expectCode(
      () => validatePolicy({ ...valid, categories: { c: { id: 'c', agent: 'a', description: '' } } }),
      'INVALID_POLICY',
    )
  })

  it('rejects id/key mismatches', () => {
    const error = expectCode(
      () => validatePolicy({ profiles: { p: { id: 'other', candidates: [{ provider: 'x', model: 'm' }] } } }),
      'ID_MISMATCH',
    )
    expect(error.path).toBe('profiles.p.id')
  })

  it('rejects unknown references', () => {
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'missing' } } }),
      'UNKNOWN_REFERENCE',
    )
    expectCode(
      () => validatePolicy({ ...valid, categories: { c: { id: 'c', agent: 'missing' } } }),
      'UNKNOWN_REFERENCE',
    )
  })

  it('rejects category inherits (removed in v0.1)', () => {
    const error = expectCode(
      () => validatePolicy({ ...valid, categories: { c: { id: 'c', agent: 'a', inherits: 'other' } } }),
      'INHERITS_REMOVED',
    )
    expect(error.path).toBe('categories.c.inherits')
  })

  it('rejects tool/verification/maxDepth shape violations', () => {
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', maxDepth: -1 } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', maxDepth: 1.5 } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', tools: { allow: [1] } } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', tools: { allow: ['read', 'read'] } } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', verification: { required: 'yes' } } } }),
      'INVALID_POLICY',
    )
    expectCode(
      () => validatePolicy({ ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', verification: { required: true, maxIterations: 0 } } } }),
      'INVALID_POLICY',
    )
  })

  it('rejects prototype-pollution keys in every layer and in merged data', () => {
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      expectCode(
        () => validatePolicy({ profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm' }] }, [key]: { polluted: true } } }),
        'PROTECTED_KEY',
      )
      expectCode(
        () => loadPolicyLayers({ project: JSON.stringify({ profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm' }] } }, [key]: {} }) }),
        'PROTECTED_KEY',
      )
      // nested position
      expectCode(
        () => validatePolicy({ profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm', [key]: 1 }] } } }),
        'PROTECTED_KEY',
      )
    }
  })

  it('does not allow pollution to survive a hostile merge', () => {
    // A default layer defining a normal profile + a request layer attempting
    // to smuggle __proto__ must fail loudly, and a benign merge must never
    // produce inherited properties.
    expectCode(
      () =>
        loadPolicyLayers({
          defaults: valid,
          request: JSON.stringify({ profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm' }], ['__proto__' as string]: { polluted: true } } } }),
        }),
      'PROTECTED_KEY',
    )
    const merged = loadPolicyLayers({ defaults: valid })
    // null or Object.prototype are both clean; never a polluted payload.
    const proto = Object.getPrototypeOf(merged)
    expect(proto === null || proto === Object.prototype).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rejects non-JSON values (functions, dates, undefined) as not plain data', () => {
    const withFunction = { ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', persona: () => 'nope' } } }
    expectCode(() => validatePolicy(withFunction), 'INVALID_POLICY')
    const withDate = { ...valid, profiles: { p: { id: 'p', candidates: [{ provider: 'x', model: 'm' }], reasoning: new Date() } } }
    // A Date's prototype is neither null nor Object.prototype — the prototype
    // guard is the designated catcher for non-plain values.
    expectCode(() => validatePolicy(withDate), 'PROTECTED_KEY')
    const withUndefined = { ...valid, agents: { a: { id: 'a', role: 'r', profile: 'p', maxDepth: undefined } } }
    expectCode(() => validatePolicy(withUndefined), 'INVALID_POLICY')
  })
  it('merges nested entities field-wise across layers (object replace, not alias chasing)', () => {
    const policy = loadPolicyLayers({
      defaults: {
        profiles: {
          p: { id: 'p', reasoning: 'high', candidates: [{ provider: 'deepseek', model: 'deepseek-v4-pro' }] },
        },
        agents: {
          a: {
            id: 'a', role: 'worker', profile: 'p',
            tools: { allow: ['read'], deny: ['shell'] },
            verification: { required: true, maxIterations: 3 },
          },
        },
        categories: { c: { id: 'c', agent: 'a' } },
      },
      project: {
        agents: {
          a: {
            // nested merge: profile replaced, tools merged, verification replaced
            profile: 'p',
            tools: { deny: ['shell', 'network'] },
          },
        },
      },
    })
    const agent = policy.agents['a']
    expect(agent?.profile).toBe('p')
    expect(agent?.role).toBe('worker')
    expect(agent?.tools).toEqual({ allow: ['read'], deny: ['shell', 'network'] })
    // profile-level fields from the base layer survive
    expect(policy.profiles['p']?.reasoning).toBe('high')
  })
})

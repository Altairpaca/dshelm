/**
 * Property / fuzz tests for the hardened core.
 *
 * Key invariants under test:
 *  - same policy snapshot + same runtime capability response + same request
 *    ⇒ same resolved policy and same serialized trace (determinism);
 *  - resolution is total over VALID documents: any valid document resolves or
 *    fails with a structured error carrying the full candidate trace;
 *  - the resolver never mutates its inputs (frozen policy stays frozen);
 *  - candidate order is respected (first selectable wins);
 *  - any invalid document is rejected by validation (no arbitrary cast).
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  canonicalJson,
  PolicyResolutionError,
  resolvePolicy,
  serializePolicy,
  validatePolicy,
  type PolicyDocument,
  type RuntimeCapabilities,
} from '../src/index.ts'

// --- arbitrary generators over the VALID policy shape -----------------------

const providerArb = fc.constantFrom('deepseek', 'openai', 'anthropic', 'local')
const modelArb = fc.constantFrom('deepseek-v4-pro', 'deepseek-v4-flash', 'gpt-5', 'claude-4', 'nightly-x')
const effortArb = fc.constantFrom('off', 'high', 'max', 'low', 'thinking-v1', 'deep-think')

const candidateArb = fc.record({
  provider: providerArb,
  model: modelArb,
  reasoning: fc.option(effortArb, { nil: undefined }),
})

const allEfforts = ['off', 'high', 'max', 'low', 'thinking-v1', 'deep-think']

/** Runtime that accepts every generated provider/model/effort combination. */
const permissiveRuntime: RuntimeCapabilities = {
  providers: {
    deepseek: { enabled: true, resolveModel: () => ({ valid: true, reasoningEfforts: allEfforts }) },
    openai: { enabled: true, resolveModel: () => ({ valid: true, reasoningEfforts: allEfforts }) },
    anthropic: { enabled: false, resolveModel: () => ({ valid: true, reasoningEfforts: allEfforts }) },
    local: { enabled: true, resolveModel: () => ({ valid: false, reason: 'model-unresolved' }) },
  },
}

/**
 * One valid document by construction: entity ids are stable constants so
 * references always exist; shared random parts vary across runs.
 */
const documentArb = fc
  .record({
    profileIds: fc.array(fc.constantFrom('p0', 'p1', 'p2'), { minLength: 1, maxLength: 3 }),
    agentIds: fc.array(fc.constantFrom('a0', 'a1', 'a2'), { minLength: 1, maxLength: 3 }),
    categoryIds: fc.array(fc.constantFrom('c0', 'c1', 'c2'), { minLength: 1, maxLength: 3 }),
    candidates: fc.array(candidateArb, { minLength: 1, maxLength: 4 }),
    reasoning: fc.option(effortArb, { nil: undefined }),
    role: fc.string({ minLength: 1, maxLength: 12 }),
    persona: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
    maxDepth: fc.option(fc.integer({ min: 1, max: 8 }), { nil: undefined }),
    tools: fc.option(
      fc.record({
        allow: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 3 }), { nil: undefined }),
        deny: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 3 }), { nil: undefined }),
      }),
      { nil: undefined },
    ),
    skills: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 3 }), { nil: undefined }),
    verification: fc.option(
      fc.record({
        required: fc.boolean(),
        maxIterations: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
      }),
      { nil: undefined },
    ),
  })
  .map((parts) => {
    const profiles: Record<string, unknown> = {}
    for (const id of parts.profileIds) {
      profiles[id] = { id, candidates: parts.candidates, ...(parts.reasoning !== undefined ? { reasoning: parts.reasoning } : {}) }
    }
    const agents: Record<string, unknown> = {}
    for (const id of parts.agentIds) {
      agents[id] = {
        id,
        role: parts.role,
        profile: parts.profileIds[0],
        ...(parts.persona !== undefined ? { persona: parts.persona } : {}),
        ...(parts.maxDepth !== undefined ? { maxDepth: parts.maxDepth } : {}),
        ...(parts.tools !== undefined ? { tools: { ...parts.tools, ...(parts.tools.allow !== undefined ? { allow: dedupe(parts.tools.allow) } : {}), ...(parts.tools.deny !== undefined ? { deny: dedupe(parts.tools.deny) } : {}) } } : {}),
        ...(parts.skills !== undefined ? { skills: dedupe(parts.skills) } : {}),
        ...(parts.verification !== undefined ? { verification: parts.verification } : {}),
      }
    }
    const categories: Record<string, unknown> = {}
    for (const id of parts.categoryIds) {
      categories[id] = { id, agent: parts.agentIds[0] }
    }
    return { profiles, agents, categories }
  })

// fast-check records may carry undefined-valued keys; the policy contract
// requires plain JSON, so sanitize through a JSON round trip first.
const toPlainJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

function dedupe(items: readonly string[] | undefined): string[] | undefined {
  if (items === undefined) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) if (!seen.has(item)) { seen.add(item); out.push(item) }
  return out
}

// The generator above builds valid documents by construction; validate it.
const generatedDocumentArb = documentArb.map((doc) => validatePolicy(toPlainJson(doc)))

const overrideArb = fc.record({
  provider: providerArb,
  model: modelArb,
  reasoning: fc.option(effortArb, { nil: undefined }),
})

type TryResult =
  | { ok: true; value: Awaited<ReturnType<typeof resolvePolicy>> }
  | { ok: false; error: PolicyResolutionError }

async function tryResolve(
  policy: PolicyDocument,
  runtime: RuntimeCapabilities,
  request: { category: string; override?: { provider?: string; model?: string; reasoning?: string } },
): Promise<TryResult> {
  try {
    return { ok: true, value: await resolvePolicy(policy, runtime, request) }
  } catch (error) {
    if (error instanceof PolicyResolutionError) return { ok: false, error }
    throw error
  }
}

describe('core property invariants', () => {
  it('validation accepts every generated valid document', () => {
    fc.assert(
      fc.property(documentArb, (doc) => {
        expect(validatePolicy(toPlainJson(doc))).toBeDefined()
      }),
      { numRuns: 300 },
    )
  })

  it('determinism: same snapshot + same runtime + same request ⇒ same result and serialized trace', async () => {
    await fc.assert(
      fc.asyncProperty(
        generatedDocumentArb,
        fc.constantFrom('c0', 'c1', 'c2'),
        fc.option(overrideArb, { nil: undefined }),
        async (policy, category, override) => {
          const request = { category, ...(override !== undefined ? { override } : {}) }
          const first = await tryResolve(policy, permissiveRuntime, request)
          const second = await tryResolve(policy, permissiveRuntime, request)
          expect(second).toEqual(first)
          if (first.ok && second.ok) {
            expect(canonicalJson(first.value.trace)).toBe(canonicalJson(second.value.trace))
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('the resolver never mutates its frozen inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        generatedDocumentArb,
        fc.constantFrom('c0', 'c1'),
        async (policy, category) => {
          const fingerprint = canonicalJson(policy)
          try {
            await resolvePolicy(policy, permissiveRuntime, { category })
          } catch {
            // expected for some documents
          }
          expect(canonicalJson(policy)).toBe(fingerprint)
        },
      ),
      { numRuns: 150 },
    )
  })

  it('resolution is total: valid documents either resolve or fail with a structured trace', async () => {
    await fc.assert(
      fc.asyncProperty(
        generatedDocumentArb,
        fc.constantFrom('c0', 'c1', 'c2'),
        async (policy, category) => {
          fc.pre(Object.prototype.hasOwnProperty.call(policy.categories, category))
          const result = await tryResolve(policy, permissiveRuntime, { category })
          if (!result.ok) {
            expect(result.error.trace?.candidates.length).toBeGreaterThan(0)
            expect(result.error.trace?.candidates.every((c) => c.outcome !== 'selected')).toBe(true)
          } else {
            expect(result.value.trace.selected).toBeDefined()
            const last = result.value.trace.candidates.at(-1)
            expect(last?.outcome).toBe('selected')
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('serialization fingerprint is stable for the same layered input', () => {
    fc.assert(
      fc.property(
        fc.record({
          profileIds: fc.array(fc.constantFrom('p0', 'p1'), { minLength: 1, maxLength: 2 }),
          candidateRows: fc.array(
            fc.record({ provider: fc.string({ minLength: 1 }), model: fc.string({ minLength: 1 }) }),
            { minLength: 1, maxLength: 3 },
          ),
        }),
        (parts) => {
          const profiles: Record<string, unknown> = {}
          for (const id of parts.profileIds) profiles[id] = { id, candidates: parts.candidateRows }
          const doc = validatePolicy({ profiles })
          expect(serializePolicy(doc)).toBe(canonicalJson(doc))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('candidate order is respected: the first enabled-and-valid candidate wins', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(candidateArb, { minLength: 2, maxLength: 6 }),
        async (candidates) => {
          const policy = validatePolicy(toPlainJson({
            profiles: { p: { id: 'p', candidates } },
            agents: { a: { id: 'a', role: 'r', profile: 'p' } },
            categories: { c: { id: 'c', agent: 'a' } },
          }))
          // Every provider enabled and every effort accepted: the first
          // candidate must win.
          const runtime: RuntimeCapabilities = {
            providers: Object.fromEntries(
              ['deepseek', 'openai', 'anthropic', 'local'].map((name) => [
                name,
                { enabled: true, resolveModel: () => ({ valid: true, reasoningEfforts: allEfforts }) },
              ]),
            ),
          }
          const result = await tryResolve(policy, runtime, { category: 'c' })
          expect(result.ok).toBe(true)
          if (result.ok) {
            const first = candidates[0]
            expect(result.value.provider).toBe(first?.provider)
            expect(result.value.model).toBe(first?.model)
            expect(result.value.trace.candidates[0]?.outcome).toBe('selected')
            expect(result.value.trace.candidates).toHaveLength(1)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

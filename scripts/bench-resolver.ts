/**
 * Resolver performance baseline (P1): small policy / ~100 entities / ~1000
 * entities × 10k resolutions; p50/p95/p99 + rough memory + trace size.
 * Records a baseline; no premature optimization.
 */
import { performance } from 'node:perf_hooks'
import { resolvePolicy, validatePolicy, type PolicyDocument, type RuntimeCapabilities } from '../packages/core/src/index.ts'

function buildPolicy(entityCount: number): PolicyDocument {
  const profiles: Record<string, unknown> = {}
  const agents: Record<string, unknown> = {}
  const categories: Record<string, unknown> = {}
  for (let i = 0; i < entityCount; i += 1) {
    profiles['p' + i] = { id: 'p' + i, candidates: [{ provider: 'deepseek', model: 'model-' + i }] }
    agents['a' + i] = { id: 'a' + i, role: 'role' + i, profile: 'p' + i }
    categories['c' + i] = { id: 'c' + i, agent: 'a' + i }
  }
  return validatePolicy({ profiles, agents, categories }) as unknown as PolicyDocument
}

const runtime: RuntimeCapabilities = {
  providers: { deepseek: { enabled: true, resolveModel: () => ({ valid: true, reasoningEfforts: ['off', 'high'] }) } },
}

async function bench(label: string, policy: PolicyDocument, iterations: number): Promise<void> {
  const samples: number[] = []
  let traceSize = 0
  for (let i = 0; i < iterations; i += 1) {
    const category = 'c' + (i % Object.keys(policy.categories).length)
    const start = performance.now()
    const resolved = await resolvePolicy(policy, runtime, { category })
    samples.push(performance.now() - start)
    traceSize += JSON.stringify(resolved.trace).length
  }
  samples.sort((a, b) => a - b)
  const p = (q: number): number => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))] ?? 0
  const mem = process.memoryUsage()
  console.log(`${label}: iterations=${iterations} p50=${p(0.5).toFixed(3)}ms p95=${p(0.95).toFixed(3)}ms p99=${p(0.99).toFixed(3)}ms avgTrace=${(traceSize / iterations).toFixed(0)}B rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB`)
}

const small = buildPolicy(3)
const mid = buildPolicy(100)
const large = buildPolicy(1000)
await bench('small (3 entities)', small, 10000)
await bench('mid (~100 entities)', mid, 10000)
await bench('large (~1000 entities)', large, 10000)

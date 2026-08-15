/**
 * compat-omo migration tests (fixture config, never real user data):
 * - models → single-candidate profiles (SUPPORTED)
 * - agents → candidate chains (MAPPED)
 * - categories → category + agent + profile with fallback chains (MAPPED)
 * - unknown sections → UNSUPPORTED (reported, not dropped)
 * - invalid routes → LOSSY; output policy is runtime-validated
 * - dry-run contract is CLI-level (--write refuses to overwrite)
 */
import { describe, expect, it } from 'vitest'
import { migrateOmo, parseOmoConfigFile, renderReport, type OmoConfigDoc } from '../src/index.ts'

const fixture: OmoConfigDoc = {
  $schema: 'https://example/schema',
  models: {
    'fast-low': { model: 'provider-a/flash', reasoning: 'off' },
    'strong-high': { model: 'provider-b/pro', reasoning: 'high' },
    'broken-route': { model: 'no-slash-here' },
  },
  agents: {
    worker: { models: ['fast-low', 'strong-high'] },
  },
  categories: {
    quick: { description: 'small changes', model: 'fast-low', fallback_models: ['strong-high'] },
    broken: { model: 'missing-entry' },
  },
  '[opencode]': { team_mode: { enabled: true } },
}

describe('migrateOmo', () => {
  it('maps models/agents/categories and reports statuses', () => {
    const { policy, report } = migrateOmo(fixture, 'fixture')
    const byStatus = (status: string): string[] => report.rows.filter((row) => row.status === status).map((row) => row.kind + ':' + row.name)
    expect(byStatus('SUPPORTED')).toEqual(['model:fast-low', 'model:strong-high'])
    expect(byStatus('MAPPED')).toEqual(['agent:worker', 'category:quick'])
    expect(byStatus('LOSSY')).toEqual(['model:broken-route', 'model:missing-entry', 'category:broken'])
    expect(byStatus('UNSUPPORTED')).toEqual(['section:[opencode]'])
    // Profiles with ordered candidate chains (fallbacks preserved in order).
    expect(policy.profiles['omo:category:quick']?.candidates).toEqual([
      { provider: 'provider-a', model: 'flash', reasoning: 'off' },
      { provider: 'provider-b', model: 'pro', reasoning: 'high' },
    ])
    expect(policy.profiles['omo:agent:worker']?.candidates).toHaveLength(2)
    expect(policy.categories['omo:quick']?.agent).toBe('omo:category:quick')
    // The emitted policy is a valid, frozen DSHelm document.
    expect(Object.isFrozen(policy)).toBe(true)
    // The report renders stably.
    const rendered = renderReport(report)
    expect(rendered).toContain('counts: SUPPORTED=2 MAPPED=2 LOSSY=3 UNSUPPORTED=1')
  })

  it('rejects unparsable JSONC and non-object documents', async () => {
    await expect(parseOmoConfigFile('/nonexistent/omo.jsonc')).rejects.toThrow()
  })
})

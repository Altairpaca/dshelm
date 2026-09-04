import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AhiSummarySchema, knowledgeBundleFromAhiSummaries, runtimeKnowledgeOverlay } from '../src/index.ts'

const fixturePath = fileURLToPath(new URL('./fixtures/ahi-summary.v1.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown

function mapping(capability: 'longHorizonCoding' | 'planning' = 'longHorizonCoding') {
  return {
    provider: 'fixture-provider',
    displayName: 'Fixture Model',
    capability,
    confidence: 0.8,
    observedAt: '2026-09-04T00:00:00Z',
    staleAfterDays: 30,
    sourceUrl: 'https://github.com/Altairpaca/agent-harness-index',
    sourceCommit: 'abcdef1234567890',
  } as const
}

describe('AHI empirical evidence bridge', () => {
  it('parses an AHI summary and creates standard empirical model knowledge', () => {
    const parsed = AhiSummarySchema.parse(fixture)
    const bundle = knowledgeBundleFromAhiSummaries(
      [{ summary: parsed, mapping: mapping() }],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T01:00:00Z' },
    )

    expect(bundle.records).toHaveLength(1)
    const record = bundle.records[0]!
    expect(record.provider).toBe('fixture-provider')
    expect(record.model).toBe('fixture-model')
    expect(record.soft).toEqual([
      expect.objectContaining({
        capability: 'longHorizonCoding',
        score: 0.75,
        confidence: 0.8,
        scoreBasis: 'empirical-evaluation',
      }),
    ])
    expect(record.evidence[0]).toEqual(expect.objectContaining({
      layer: 'empirical',
      claimType: 'longHorizonCoding',
      confidence: 0.8,
    }))
    expect(record.evidence[0]!.value).toEqual(expect.objectContaining({
      benchmark: 'fixture-coding-bench',
      harness: 'fixture-harness',
      observations: 4,
      successes: 3,
      score: 0.75,
    }))
  })

  it('feeds the existing DSHelm runtime overlay without resolver-specific AHI code', () => {
    const bundle = knowledgeBundleFromAhiSummaries(
      [{ summary: fixture, mapping: mapping() }],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T01:00:00Z' },
    )
    const overlay = runtimeKnowledgeOverlay(bundle.records[0]!)

    expect(overlay.softScores?.longHorizonCoding).toBeCloseTo(0.6)
    expect(overlay.evidence).toEqual([
      expect.objectContaining({ layer: 'empirical', confidence: 0.8 }),
    ])
  })

  it('requires the benchmark-to-capability mapping instead of inferring it from names', () => {
    const coding = knowledgeBundleFromAhiSummaries(
      [{ summary: fixture, mapping: mapping('planning') }],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T01:00:00Z' },
    )
    expect(coding.records[0]!.soft[0]!.capability).toBe('planning')
  })

  it('rejects internally inconsistent summaries', () => {
    const invalid = { ...(fixture as Record<string, unknown>), success_rate: 0.5 }
    expect(() => AhiSummarySchema.parse(invalid)).toThrow(/success_rate must equal successes \/ observations/)
  })

  it('rejects duplicate capability mappings for one provider/model', () => {
    expect(() => knowledgeBundleFromAhiSummaries(
      [
        { summary: fixture, mapping: mapping() },
        { summary: fixture, mapping: mapping() },
      ],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T01:00:00Z' },
    )).toThrow(/duplicate AHI capability mapping/)
  })
})

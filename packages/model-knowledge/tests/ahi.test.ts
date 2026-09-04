import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AhiSummarySchema, knowledgeBundleFromAhiSummaries, runtimeKnowledgeOverlay } from '../src/index.ts'

const AHI_GOLDEN_COMMIT = '30af58e99b86f8dfe39e24126a08cd9186d664c6'
const AHI_GOLDEN_SOURCE_URL = `https://github.com/Altairpaca/agent-harness-index/blob/${AHI_GOLDEN_COMMIT}/tests/fixtures/skillbench-golden-summary.v1.json`
const GOLDEN_EVIDENCE_ID = 'ahi:fixture-provider:fixture-model:fixture-harness:longHorizonCoding:4f6eeaba3354:32bc35c2c956:0d435a1e8407'

const fixturePath = fileURLToPath(new URL('./fixtures/ahi-summary.v1.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown
const goldenFixturePath = fileURLToPath(new URL('./fixtures/ahi-skillbench-golden-summary.v1.json', import.meta.url))
const goldenFixture = JSON.parse(readFileSync(goldenFixturePath, 'utf8')) as unknown

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

  it('consumes the pinned AHI SkillBench golden summary without semantic drift', () => {
    const parsed = AhiSummarySchema.parse(goldenFixture)
    const observedAt = '2026-09-04T18:00:00+08:00'
    const generatedAt = '2026-09-04T19:00:00+08:00'
    const bundle = knowledgeBundleFromAhiSummaries(
      [{
        summary: parsed,
        mapping: {
          provider: 'fixture-provider',
          displayName: 'Fixture Model',
          capability: 'longHorizonCoding',
          confidence: 0.8,
          observedAt,
          staleAfterDays: 30,
          sourceUrl: AHI_GOLDEN_SOURCE_URL,
          sourceCommit: AHI_GOLDEN_COMMIT,
        },
      }],
      { bundleId: 'ahi-skillbench-golden', generatedAt },
    )

    expect(bundle).toEqual({
      schemaVersion: 1,
      bundleId: 'ahi-skillbench-golden',
      generatedAt,
      records: [{
        id: 'fixture-provider/fixture-model',
        provider: 'fixture-provider',
        model: 'fixture-model',
        displayName: 'Fixture Model',
        hard: {},
        soft: [{
          capability: 'longHorizonCoding',
          score: 1,
          confidence: 0.8,
          scoreBasis: 'empirical-evaluation',
          evidenceIds: [GOLDEN_EVIDENCE_ID],
        }],
        adaptationHints: [],
        evidence: [{
          id: GOLDEN_EVIDENCE_ID,
          layer: 'empirical',
          source: 'agent-harness-index:skillbench-fixture',
          sourceUrl: AHI_GOLDEN_SOURCE_URL,
          sourceCommit: AHI_GOLDEN_COMMIT,
          observedAt,
          subject: 'fixture-provider/fixture-model',
          claimType: 'longHorizonCoding',
          value: {
            benchmark: 'skillbench-fixture',
            benchmarkVersion: '1',
            harness: 'fixture-harness',
            harnessVersion: '1.2.3',
            modelVersion: '2026-08-31',
            score: 1,
            observations: 1,
            successes: 1,
            wilson95Low: 0.20654931437723742,
            wilson95High: 1,
            taskSetSha256: '4f6eeaba335444e611bb2629e2078976937e32863dde934ff7f1ff03244e1ce1',
            configurationSha256: '32bc35c2c9567835be1c0f50129678d5eebcda5f84509149425b6d87a27434fc',
            environmentSha256: '0d435a1e8407264720c153cf519ba81edca28a44033b0e36933a6f4c7825e730',
          },
          confidence: 0.8,
          staleAfterDays: 30,
        }],
      }],
    })

    expect(runtimeKnowledgeOverlay(bundle.records[0]!)).toEqual({
      softScores: { longHorizonCoding: 0.8 },
      evidence: [{
        source: 'agent-harness-index:skillbench-fixture',
        layer: 'empirical',
        confidence: 0.8,
      }],
    })
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

  it('requires offset-aware observation and bundle timestamps', () => {
    expect(() => knowledgeBundleFromAhiSummaries(
      [{ summary: fixture, mapping: { ...mapping(), observedAt: '2026-09-04T00:00:00' } }],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T01:00:00Z' },
    )).toThrow(/observedAt must be an offset-aware ISO 8601 timestamp/)

    expect(() => knowledgeBundleFromAhiSummaries(
      [{ summary: fixture, mapping: { ...mapping(), observedAt: '2026-09-04T08:00:00+08:00' } }],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T09:00:00' },
    )).toThrow(/generatedAt must be an offset-aware ISO 8601 timestamp/)

    expect(() => knowledgeBundleFromAhiSummaries(
      [{ summary: fixture, mapping: { ...mapping(), observedAt: '2026-09-04T08:00:00+08:00' } }],
      { bundleId: 'fixture-ahi', generatedAt: '2026-09-04T09:00:00+08:00' },
    )).not.toThrow()
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

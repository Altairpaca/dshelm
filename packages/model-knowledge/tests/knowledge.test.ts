import { describe, expect, it } from 'vitest'
import {
  BASELINE_KNOWLEDGE_BUNDLE,
  explainModel,
  knowledgeStatus,
  parseKnowledgeBundle,
  runtimeKnowledgeOverlay,
  type KnowledgeBundle,
} from '../src/index.ts'

describe('model knowledge', () => {
  it('keeps baseline records evidence-backed and exposes explainable hard capabilities', () => {
    const record = BASELINE_KNOWLEDGE_BUNDLE.records.find((entry) => entry.model === 'deepseek-v4-flash')
    expect(record).toBeDefined()
    if (record === undefined) return
    expect(record.evidence.some((item) => item.layer === 'runtime')).toBe(true)
    expect(explainModel(BASELINE_KNOWLEDGE_BUNDLE, 'deepseek', 'deepseek-v4-flash')).toMatchObject({
      found: true,
      hard: { runtimeReady: false },
    })
  })

  it('tracks current DSH DeepSeek multimodal and reasoning catalog facts without manufacturing runtime readiness', () => {
    const v41 = explainModel(BASELINE_KNOWLEDGE_BUNDLE, 'deepseek', 'deepseek-flash')
    expect(v41).toMatchObject({
      found: true,
      displayName: 'DeepSeek-V41-Flash',
      hard: {
        runtimeReady: false,
        contextWindow: 1_000_000,
        vision: true,
        reasoningEfforts: ['off', 'low', 'high', 'max'],
      },
    })
    if (v41.found) expect(v41.soft).toEqual([])
    const v41Record = BASELINE_KNOWLEDGE_BUNDLE.records.find((entry) => entry.model === 'deepseek-flash')
    expect(v41Record?.evidence.some((item) => item.source.includes('dsh-v0.1.5-rc.1'))).toBe(true)
    expect(v41Record?.evidence.find((item) => item.id === 'deepseek-v41-dsh-reasoning')).toMatchObject({
      layer: 'runtime',
      claimType: 'reasoningEfforts',
      value: ['off', 'low', 'high', 'max'],
    })

    const visionExp = explainModel(BASELINE_KNOWLEDGE_BUNDLE, 'deepseek', 'deepseek-v4-flash-vision-exp')
    expect(visionExp).toMatchObject({
      found: true,
      displayName: 'DeepSeek-V4-Flash-Vision-Exp',
      hard: {
        runtimeReady: false,
        contextWindow: 1_000_000,
        vision: true,
        reasoningEfforts: ['off', 'low', 'high', 'max'],
      },
    })
    if (visionExp.found) expect(visionExp.soft).toEqual([])
  })

  it('refreshes only current DSH catalog facts for older DeepSeek V4 routes', () => {
    for (const model of ['deepseek-v4-flash', 'deepseek-v4-pro']) {
      const route = model.endsWith('flash') ? 'flash' : 'pro'
      const record = BASELINE_KNOWLEDGE_BUNDLE.records.find((entry) => entry.provider === 'deepseek' && entry.model === model)
      expect(record).toBeDefined()
      expect(record?.hard.contextWindow).toBe(1_000_000)
      expect(record?.hard.reasoningEfforts).toEqual(['off', 'low', 'high', 'max'])
      expect(record?.evidence.find((item) => item.id === `deepseek-v4-${route}-dsh-context-015`)).toMatchObject({
        layer: 'runtime',
        claimType: 'contextWindow',
        value: 1_000_000,
        sourceCommit: '183f08e9c6dde7e36cd2318eaee70b0da08fb35e',
      })
      expect(record?.evidence.find((item) => item.id === `deepseek-v4-${route}-dsh-reasoning-015`)).toMatchObject({
        layer: 'runtime',
        claimType: 'reasoningEfforts',
        value: ['off', 'low', 'high', 'max'],
        sourceCommit: '183f08e9c6dde7e36cd2318eaee70b0da08fb35e',
      })
      expect(record?.evidence.some((item) => item.id === `deepseek-${route}-reasoning`)).toBe(false)
    }

    const legacyFlash = BASELINE_KNOWLEDGE_BUNDLE.records.find((entry) => entry.model === 'deepseek-v4-flash')
    expect(legacyFlash?.soft.find((item) => item.capability === 'fanOutSuitability')?.score).toBe(0.88)
    expect(legacyFlash?.evidence.find((item) => item.id === 'deepseek-flash-protocol')?.observedAt).toBe('2026-08-18T03:00:00+08:00')

    const unrelated = BASELINE_KNOWLEDGE_BUNDLE.records.find((entry) => entry.provider === 'openai')
    expect(unrelated?.evidence[0]?.observedAt).toBe('2026-08-18T03:00:00+08:00')
    expect(() => parseKnowledgeBundle(BASELINE_KNOWLEDGE_BUNDLE)).not.toThrow()
  })

  it('parses a data-only bundle and rejects evidence-free records', () => {
    const bundle: KnowledgeBundle = {
      schemaVersion: 1,
      bundleId: 'fixture',
      generatedAt: '2026-08-18T00:00:00.000Z',
      records: [{
        id: 'fixture/open-model',
        provider: 'local',
        model: 'open-model',
        displayName: 'Fixture Open Model',
        hard: { localDeployment: true },
        soft: [],
        adaptationHints: [],
        evidence: [{
          id: 'fixture-source',
          layer: 'official',
          source: 'fixture',
          observedAt: '2026-08-18T00:00:00.000Z',
          subject: 'local/open-model',
          claimType: 'localDeployment',
          value: true,
          confidence: 1,
          staleAfterDays: 90,
        }],
      }],
    }
    expect(parseKnowledgeBundle(bundle)).toEqual(bundle)
    expect(() => parseKnowledgeBundle({ ...bundle, records: [{ ...bundle.records[0], evidence: [] }] })).toThrow()
  })

  it('rejects populated hard claims without matching evidence', () => {
    const bundle = {
      schemaVersion: 1 as const,
      bundleId: 'fixture-integrity',
      generatedAt: '2026-08-18T00:00:00.000Z',
      records: [{
        id: 'fixture/model',
        provider: 'fixture',
        model: 'model',
        displayName: 'Fixture',
        hard: { protocol: 'openai-responses' },
        soft: [],
        adaptationHints: [],
        evidence: [{
          id: 'fixture-runtime',
          layer: 'runtime' as const,
          source: 'fixture',
          observedAt: '2026-08-18T00:00:00.000Z',
          subject: 'fixture/model',
          claimType: 'runtimeReady' as const,
          value: false,
          confidence: 1,
          staleAfterDays: 30,
        }],
      }],
    }
    expect(() => parseKnowledgeBundle(bundle)).toThrow(/protocol/)
  })

  it('rejects hard capability values that contradict their evidence', () => {
    const record = BASELINE_KNOWLEDGE_BUNDLE.records[0]
    expect(() => parseKnowledgeBundle({
      ...BASELINE_KNOWLEDGE_BUNDLE,
      records: [{ ...record, hard: { ...record.hard, runtimeReady: true } }],
    })).toThrow(/contradicts runtimeReady/)
  })

  it('rejects a soft capability backed by a different claim type without derivation', () => {
    const record = BASELINE_KNOWLEDGE_BUNDLE.records[0]
    const invalid = {
      ...record,
      soft: [{ capability: 'planning' as const, score: 0.8, confidence: 0.4, scoreBasis: 'maintainer-heuristic' as const, evidenceIds: ['deepseek-flash-agentic'] }],
    }
    expect(() => parseKnowledgeBundle({ ...BASELINE_KNOWLEDGE_BUNDLE, records: [invalid] })).toThrow(/not planning/)
  })

  it('exposes score basis and claim evidence in explain output', () => {
    const explanation = explainModel(BASELINE_KNOWLEDGE_BUNDLE, 'deepseek', 'deepseek-v4-flash')
    expect(explanation).toMatchObject({ found: true })
    if (!explanation.found) return
    expect(explanation.soft[0]).toMatchObject({ scoreBasis: 'maintainer-heuristic', evidence: [{ claimType: 'agenticCoding' }] })
  })

  it('reports stale evidence without pretending that stale data is runtime truth', () => {
    const result = knowledgeStatus(BASELINE_KNOWLEDGE_BUNDLE, new Date('2027-01-01T00:00:00.000Z'))
    expect(result.status).toBe('stale')
    expect(result.staleEvidenceCount).toBeGreaterThan(0)
    expect(result.remoteExecutableCode).toBe(false)
  })

  it('projects knowledge into routing evidence without manufacturing runtime readiness', () => {
    const record = {
      ...BASELINE_KNOWLEDGE_BUNDLE.records[0],
      soft: [{ capability: 'planning', score: 0.9, confidence: 0.8, scoreBasis: 'maintainer-heuristic', evidenceIds: ['dsh-keyless-exact-model-flash'] }],
    }
    const overlay = runtimeKnowledgeOverlay(record)
    expect(overlay.softScores?.strongPlanning).toBeCloseTo(0.72)
    expect(overlay.evidence[0]?.layer).toBe('runtime')
    expect('runtimeReady' in overlay).toBe(false)
  })
})

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

  it('reports stale evidence without pretending that stale data is runtime truth', () => {
    const result = knowledgeStatus(BASELINE_KNOWLEDGE_BUNDLE, new Date('2027-01-01T00:00:00.000Z'))
    expect(result.status).toBe('stale')
    expect(result.staleEvidenceCount).toBeGreaterThan(0)
    expect(result.remoteExecutableCode).toBe(false)
  })

  it('projects knowledge into routing evidence without manufacturing runtime readiness', () => {
    const record = {
      ...BASELINE_KNOWLEDGE_BUNDLE.records[0],
      soft: [{ capability: 'planning', score: 0.9, confidence: 0.8, evidenceIds: ['dsh-keyless-exact-model-flash'] }],
    }
    const overlay = runtimeKnowledgeOverlay(record)
    expect(overlay.softScores?.strongPlanning).toBeCloseTo(0.72)
    expect(overlay.evidence[0]?.layer).toBe('runtime')
    expect('runtimeReady' in overlay).toBe(false)
  })
})

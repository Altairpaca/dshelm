/**
 * DSHelm OmO compatibility — read-only migration parser and mapper.
 *
 * Behavioral port: the mapper translates the OmO config MODEL into the
 * DSHelm policy model (agents/categories/models/reasoning/fallback chains).
 * No OmO source is copied (SUL-1.0; see docs/ecosystem/source-ledger.md).
 *
 * Safety: reads ONLY the user's OmO config file (default ~/.omo/omo.jsonc).
 * Never reads credentials, auth stores, or session data. Dry-run by default.
 */
import { readFile } from 'node:fs/promises'
import { parse } from 'jsonc-parser'
import { validatePolicy, type PolicyDocument } from '@dshelm/core'

// ---------------------------------------------------------------------------
// Parsed OmO document (minimal structural types)
// ---------------------------------------------------------------------------

export interface OmoModelEntry {
  /** "provider/model-id" route string. */
  model: string
  /** Opaque reasoning-effort id (adapter-owned vocabulary). */
  reasoning?: string
}

export interface OmoAgentEntry {
  /** Ordered model-profile names (fallback chain). */
  models: string[]
}

export interface OmoCategoryEntry {
  description?: string
  /** Primary model-profile name. */
  model?: string
  /** Ordered fallback model-profile names. */
  fallback_models?: string[]
}

export interface OmoConfigDoc {
  models?: Record<string, OmoModelEntry>
  agents?: Record<string, OmoAgentEntry>
  categories?: Record<string, OmoCategoryEntry>
  /** Unknown sections (team_mode, background_task, ...) — reported, not mapped. */
  [section: string]: unknown
}

// ---------------------------------------------------------------------------
// Migration report
// ---------------------------------------------------------------------------

export type MigrationStatus = 'SUPPORTED' | 'MAPPED' | 'LOSSY' | 'UNSUPPORTED'

export interface MigrationRow {
  readonly kind: 'model' | 'agent' | 'category' | 'section'
  readonly name: string
  readonly status: MigrationStatus
  readonly note: string
}

export interface MigrationReport {
  readonly source: string
  readonly rows: readonly MigrationRow[]
  readonly counts: Readonly<Record<MigrationStatus, number>>
}

// ---------------------------------------------------------------------------
// Parser (read-only)
// ---------------------------------------------------------------------------

/** Parse an OmO config file. Rejects unparsable JSONC; never reads anything else. */
export async function parseOmoConfigFile(path: string): Promise<OmoConfigDoc> {
  const text = await readFile(path, 'utf8')
  const errors: { error: unknown }[] = []
  const doc = parse(text, errors as never, { allowTrailingComma: true }) as unknown
  if (errors.length > 0) {
    throw new Error('omo config: invalid JSONC at ' + path)
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('omo config: must be a JSON object at ' + path)
  }
  return doc as OmoConfigDoc
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function splitRoute(route: string): { provider: string; model: string } | undefined {
  const slash = route.indexOf('/')
  if (slash <= 0 || slash === route.length - 1) return undefined
  return { provider: route.slice(0, slash), model: route.slice(slash + 1) }
}

type ResolvedModel = { provider: string; model: string; reasoning?: string }

/** Resolve one model entry once; later references reuse the cached result. */
const modelCache = new Map<string, ResolvedModel | undefined>()

function modelRow(name: string, entry: OmoModelEntry | undefined, rows: MigrationRow[]): ResolvedModel | undefined {
  if (modelCache.has(name)) return modelCache.get(name)
  if (entry === undefined) {
    rows.push({ kind: 'model', name, status: 'LOSSY', note: 'entry missing' })
    return undefined
  }
  const route = splitRoute(entry.model)
  if (route === undefined) {
    rows.push({ kind: 'model', name, status: 'LOSSY', note: 'route "' + entry.model + '" is not provider/model' })
    return undefined
  }
  rows.push({ kind: 'model', name, status: 'SUPPORTED', note: route.provider + '/' + route.model })
  const resolved: ResolvedModel = { ...route, ...(entry.reasoning !== undefined ? { reasoning: entry.reasoning } : {}) }
  modelCache.set(name, resolved)
  return resolved
}

function profileForModelChain(
  id: string,
  names: readonly string[],
  doc: OmoConfigDoc,
  rows: MigrationRow[],
): {
  candidates: { provider: string; model: string; reasoning?: string }[]
  reasoning?: string
} | undefined {
  const candidates: { provider: string; model: string; reasoning?: string }[] = []
  let chainReasoning: string | undefined
  for (const name of names) {
    const resolved = modelRow(name, doc.models?.[name], rows)
    if (resolved === undefined) continue
    candidates.push(resolved)
    chainReasoning ??= resolved.reasoning
  }
  if (candidates.length === 0) return undefined
  return { candidates, ...(chainReasoning !== undefined ? { reasoning: chainReasoning } : {}) }
}

/**
 * Map an OmO document onto a DSHelm policy document (plain JSON, validated).
 * Every mapping decision is recorded in the report.
 */
export function migrateOmo(doc: OmoConfigDoc, source: string): { policy: PolicyDocument; report: MigrationReport } {
  const rows: MigrationRow[] = []
  const profiles: Record<string, unknown> = {}
  const agents: Record<string, unknown> = {}
  const categories: Record<string, unknown> = {}

  // 1. Models → DSHelm profiles (single-candidate).
  for (const [name, entry] of Object.entries(doc.models ?? {})) {
    const resolved = modelRow(name, entry, rows)
    if (resolved === undefined) continue
    profiles['omo:model:' + name] = {
      id: 'omo:model:' + name,
      candidates: [{ provider: resolved.provider, model: resolved.model }],
      ...(resolved.reasoning !== undefined ? { reasoning: resolved.reasoning } : {}),
    }
  }

  // 2. Agents → DSHelm profiles (ordered candidate chain) + AgentSpec.
  for (const [name, entry] of Object.entries(doc.agents ?? {})) {
    const chain = profileForModelChain('omo:agent:' + name, entry.models ?? [], doc, rows)
    if (chain === undefined) {
      rows.push({ kind: 'agent', name, status: 'LOSSY', note: 'no resolvable models' })
      continue
    }
    profiles['omo:agent:' + name] = {
      id: 'omo:agent:' + name,
      candidates: chain.candidates,
      ...(chain.reasoning !== undefined ? { reasoning: chain.reasoning } : {}),
    }
    agents['omo:' + name] = { id: 'omo:' + name, role: name, profile: 'omo:agent:' + name }
    rows.push({ kind: 'agent', name, status: 'MAPPED', note: 'chain of ' + chain.candidates.length + ' candidate(s)' })
  }

  // 3. Categories → DSHelm category + per-category agent/profile (fallback chain).
  for (const [name, entry] of Object.entries(doc.categories ?? {})) {
    const chainNames = [entry.model, ...(entry.fallback_models ?? [])].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    const chain = profileForModelChain('omo:category:' + name, chainNames, doc, rows)
    if (chain === undefined) {
      rows.push({ kind: 'category', name, status: 'LOSSY', note: 'no resolvable model' })
      continue
    }
    const agentId = 'omo:category:' + name
    profiles['omo:category:' + name] = {
      id: 'omo:category:' + name,
      candidates: chain.candidates,
      ...(chain.reasoning !== undefined ? { reasoning: chain.reasoning } : {}),
    }
    agents[agentId] = { id: agentId, role: 'category:' + name, profile: 'omo:category:' + name }
    categories['omo:' + name] = {
      id: 'omo:' + name,
      agent: agentId,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
    }
    rows.push({
      kind: 'category',
      name,
      status: 'MAPPED',
      note: chain.candidates.length + ' candidate(s) (model + fallbacks)',
    })
  }

  // 4. Unknown sections → UNSUPPORTED (reported, never silently dropped).
  const mappedKeys = new Set(['models', 'agents', 'categories', '$schema', '_migrations'])
  for (const section of Object.keys(doc)) {
    if (mappedKeys.has(section)) continue
    rows.push({ kind: 'section', name: section, status: 'UNSUPPORTED', note: 'runtime behavior section — not mapped in v0.2' })
  }

  const counts: Record<MigrationStatus, number> = { SUPPORTED: 0, MAPPED: 0, LOSSY: 0, UNSUPPORTED: 0 }
  for (const row of rows) counts[row.status] += 1

  const policy = validatePolicy({ profiles, agents, categories }) as unknown as PolicyDocument
  return { policy, report: { source, rows, counts } }
}

/** Render the report as a stable table for CLI output. */
export function renderReport(report: MigrationReport): string {
  const lines = ['OmO migration report', 'source: ' + report.source, '']
  for (const row of report.rows) {
    lines.push(row.status.padEnd(12) + ' ' + row.kind.padEnd(9) + ' ' + row.name.padEnd(28) + ' ' + row.note)
  }
  lines.push('', 'counts: ' + Object.entries(report.counts).map(([k, v]) => k + '=' + v).join(' '))
  return lines.join('\n')
}
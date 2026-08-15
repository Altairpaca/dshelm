/**
 * Policy configuration loading: JSONC parsing, safe layered merge, and REAL
 * runtime validation. Round-2 fixes:
 *  - nested per-entity validation (no more `as unknown as PolicyDocument`);
 *  - candidate validation (non-empty, well-formed);
 *  - reference validation (profile/agent refs exist after merge);
 *  - key/id consistency (entity id == owning map key);
 *  - unknown-field policy: top-level sections and nested entity fields are
 *    allowlisted; anything else is rejected;
 *  - prototype-pollution guard: `__proto__` / `prototype` / `constructor`
 *    keys are rejected in every layer and in the merged document;
 *  - plain-JSON validation: the merged document is plain, JSON-serializable
 *    data (deep-frozen for deterministic resolution);
 *  - deterministic canonical serialization for snapshots and traces.
 */
import { parse, type ParseError } from 'jsonc-parser'
import {
  ConfigResolutionError,
  type PolicyDocument,
  type PolicyLayerValue,
  type PolicyLayers,
} from './contracts.ts'

const layerNames = ['defaults', 'user', 'project', 'request'] as const
const allowedTopLevelKeys = new Set(['profiles', 'agents', 'categories'])

/** Keys that must never appear in policy data (prototype-pollution guard). */
export const PROTECTED_KEYS = ['__proto__', 'prototype', 'constructor'] as const

// ---------------------------------------------------------------------------
// Layer parsing + safe merge
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reject protected keys anywhere in a parsed layer (own properties only). */
function assertNoProtectedKeys(value: unknown, path: string, layer: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProtectedKeys(item, `${path}[${index}]`, layer))
    return
  }
  if (!isRecord(value)) return
  for (const key of Object.keys(value)) {
    if ((PROTECTED_KEYS as readonly string[]).includes(key)) {
      throw new ConfigResolutionError('PROTECTED_KEY', `Protected key "${key}" is not allowed in policy data`, {
        layer,
        path: path === '' ? key : `${path}.${key}`,
      })
    }
    assertNoProtectedKeys(value[key], path === '' ? key : `${path}.${key}`, layer)
  }
}

/**
 * Reject prototype-MUTATION pollution. JSON parsers that assign parsed
 * members with `object[name] = value` silently swallow a `"__proto__"`
 * member by replacing the object's prototype instead of creating a key
 * (verified against jsonc-parser), so an own-key walk alone cannot see it.
 * Every object in the tree must keep a null or `Object.prototype` prototype.
 */
function assertCleanPrototypes(value: unknown, path: string, layer: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCleanPrototypes(item, `${path}[${index}]`, layer))
    return
  }
  if (!isRecord(value)) return
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype) {
    throw new ConfigResolutionError(
      'PROTECTED_KEY',
      `Prototype pollution attempt at ${path === '' ? '<root>' : path}`,
      { layer, ...(path === '' ? {} : { path }) },
    )
  }
  for (const key of Object.keys(value)) {
    assertCleanPrototypes(value[key], path === '' ? key : `${path}.${key}`, layer)
  }
}

function parseLayer(value: PolicyLayerValue, layer: string): Record<string, unknown> {
  let parsed: unknown
  if (typeof value === 'string') {
    const errors: ParseError[] = []
    parsed = parse(value, errors, { allowTrailingComma: true })
    if (errors.length > 0) {
      throw new ConfigResolutionError(
        'INVALID_JSONC',
        `Invalid JSONC in ${layer} at offset ${errors[0]?.offset ?? 0}`,
        { layer },
      )
    }
  } else {
    parsed = value
  }
  if (!isRecord(parsed)) {
    throw new ConfigResolutionError('INVALID_JSONC', `${layer} must contain a JSON object`, { layer })
  }
  assertNoProtectedKeys(parsed, '', layer)
  assertCleanPrototypes(parsed, '', layer)
  for (const key of Object.keys(parsed)) {
    if (!allowedTopLevelKeys.has(key)) {
      throw new ConfigResolutionError('UNKNOWN_KEY', `Unknown policy section "${key}"`, { layer, path: key })
    }
  }
  return parsed
}

/**
 * Recursive plain-object merge with a prototype-pollution guard: protected
 * keys were already rejected per layer, and the copy here never uses
 * assignment through inherited setters (`Object.defineProperty` + own-key
 * checks). Arrays are replaced wholesale (policy arrays are not merged).
 */
function merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>
  for (const key of Object.keys(base)) {
    defineSafe(result, key, base[key])
  }
  for (const key of Object.keys(override)) {
    if ((PROTECTED_KEYS as readonly string[]).includes(key)) {
      throw new ConfigResolutionError('PROTECTED_KEY', `Protected key "${key}" is not allowed in policy data`, {
        path: key,
      })
    }
    const previous = Object.prototype.hasOwnProperty.call(result, key) ? result[key] : undefined
    const next = override[key]
    defineSafe(result, key, isRecord(previous) && isRecord(next) ? merge(previous, next) : next)
  }
  return result
}

function defineSafe(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    // configurable so an override layer may replace the field; the final
    // document is frozen by validatePolicyDocument afterwards.
    configurable: true,
    writable: true,
  })
}

// ---------------------------------------------------------------------------
// Deep validation of the merged document
// ---------------------------------------------------------------------------

const PROFILE_FIELDS = new Set(['id', 'candidates', 'reasoning'])
const CANDIDATE_FIELDS = new Set(['provider', 'model', 'reasoning'])
const AGENT_FIELDS = new Set(['id', 'role', 'profile', 'persona', 'maxDepth', 'tools', 'skills', 'verification'])
const TOOL_FIELDS = new Set(['allow', 'deny'])
const VERIFICATION_FIELDS = new Set(['required', 'maxIterations'])
const CATEGORY_FIELDS = new Set(['id', 'agent', 'description'])

function fail(code: ConfigResolutionError['code'], message: string, path?: string, layer?: string): never {
  throw new ConfigResolutionError(code, message, {
    ...(path !== undefined ? { path } : {}),
    ...(layer !== undefined ? { layer } : {}),
  })
}

function assertNonEmptyString(value: unknown, path: string, layer?: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_POLICY', `${path} must be a non-empty string`, path, layer)
  }
}

function assertStringArray(value: unknown, path: string, layer?: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    fail('INVALID_POLICY', `${path} must be an array of non-empty strings`, path, layer)
  }
  const seen = new Set<string>()
  for (const item of value) {
    if (seen.has(item)) fail('INVALID_POLICY', `${path} contains duplicate "${item}"`, path, layer)
    seen.add(item)
  }
}

function assertPositiveInt(value: unknown, path: string, layer?: string): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    fail('INVALID_POLICY', `${path} must be a positive safe integer`, path, layer)
  }
}

function rejectUnknownFields(record: Record<string, unknown>, allowed: Set<string>, path: string, layer?: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail('INVALID_POLICY', `Unknown field "${key}" at ${path}`, `${path}.${key}`, layer)
    }
  }
}

function validateProfile(id: string, value: unknown, layer?: string): void {
  const path = `profiles.${id}`
  if (!isRecord(value)) fail('INVALID_POLICY', `${path} must be an object`, path, layer)
  const profile = value as Record<string, unknown>
  rejectUnknownFields(profile, PROFILE_FIELDS, path, layer)
  if (profile.id !== id) {
    fail('ID_MISMATCH', `${path}.id ("${String(profile.id)}") does not match its map key "${id}"`, `${path}.id`, layer)
  }
  if (profile.reasoning !== undefined) assertNonEmptyString(profile.reasoning, `${path}.reasoning`, layer)
  if (!Array.isArray(profile.candidates) || profile.candidates.length === 0) {
    fail('INVALID_POLICY', `${path}.candidates must be a non-empty array`, `${path}.candidates`, layer)
  }
  profile.candidates.forEach((candidate, index) => {
    const cpath = `${path}.candidates[${index}]`
    if (!isRecord(candidate)) fail('INVALID_POLICY', `${cpath} must be an object`, cpath, layer)
    rejectUnknownFields(candidate as Record<string, unknown>, CANDIDATE_FIELDS, cpath, layer)
    assertNonEmptyString((candidate as Record<string, unknown>).provider, `${cpath}.provider`, layer)
    assertNonEmptyString((candidate as Record<string, unknown>).model, `${cpath}.model`, layer)
    const reasoning = (candidate as Record<string, unknown>).reasoning
    if (reasoning !== undefined) assertNonEmptyString(reasoning, `${cpath}.reasoning`, layer)
  })
}

function validateAgent(id: string, value: unknown, layer?: string): void {
  const path = `agents.${id}`
  if (!isRecord(value)) fail('INVALID_POLICY', `${path} must be an object`, path, layer)
  const agent = value as Record<string, unknown>
  rejectUnknownFields(agent, AGENT_FIELDS, path, layer)
  if (agent.id !== id) {
    fail('ID_MISMATCH', `${path}.id ("${String(agent.id)}") does not match its map key "${id}"`, `${path}.id`, layer)
  }
  assertNonEmptyString(agent.role, `${path}.role`, layer)
  assertNonEmptyString(agent.profile, `${path}.profile`, layer)
  if (agent.persona !== undefined) assertNonEmptyString(agent.persona, `${path}.persona`, layer)
  if (agent.maxDepth !== undefined) assertPositiveInt(agent.maxDepth, `${path}.maxDepth`, layer)
  if (agent.skills !== undefined) assertStringArray(agent.skills, `${path}.skills`, layer)
  if (agent.tools !== undefined) {
    const tpath = `${path}.tools`
    if (!isRecord(agent.tools)) fail('INVALID_POLICY', `${tpath} must be an object`, tpath, layer)
    const tools = agent.tools as Record<string, unknown>
    rejectUnknownFields(tools, TOOL_FIELDS, tpath, layer)
    if (tools.allow !== undefined) assertStringArray(tools.allow, `${tpath}.allow`, layer)
    if (tools.deny !== undefined) assertStringArray(tools.deny, `${tpath}.deny`, layer)
  }
  if (agent.verification !== undefined) {
    const vpath = `${path}.verification`
    if (!isRecord(agent.verification)) fail('INVALID_POLICY', `${vpath} must be an object`, vpath, layer)
    const verification = agent.verification as Record<string, unknown>
    rejectUnknownFields(verification, VERIFICATION_FIELDS, vpath, layer)
    if (typeof verification.required !== 'boolean') {
      fail('INVALID_POLICY', `${vpath}.required must be a boolean`, `${vpath}.required`, layer)
    }
    if (verification.maxIterations !== undefined) {
      assertPositiveInt(verification.maxIterations, `${vpath}.maxIterations`, layer)
    }
  }
}

function validateCategory(id: string, value: unknown, layer?: string): void {
  const path = `categories.${id}`
  if (!isRecord(value)) fail('INVALID_POLICY', `${path} must be an object`, path, layer)
  const category = value as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(category, 'inherits')) {
    fail(
      'INHERITS_REMOVED',
      `${path}.inherits is removed in v0.1: category inheritance was alias chasing with silently vanishing child fields; see docs/decisions/v0.1-alpha-hardening.md`,
      `${path}.inherits`,
      layer,
    )
  }
  rejectUnknownFields(category, CATEGORY_FIELDS, path, layer)
  if (category.id !== id) {
    fail('ID_MISMATCH', `${path}.id ("${String(category.id)}") does not match its map key "${id}"`, `${path}.id`, layer)
  }
  assertNonEmptyString(category.agent, `${path}.agent`, layer)
  if (category.description !== undefined) assertNonEmptyString(category.description, `${path}.description`, layer)
}

/** Validate the merged document: entities, references, plain-JSON, freeze. */
export function validatePolicyDocument(merged: Record<string, unknown>, layer?: string): PolicyDocument {
  assertNoProtectedKeys(merged, '', layer ?? 'merged')
  assertCleanPrototypes(merged, '', layer ?? 'merged')
  for (const key of Object.keys(merged)) {
    if (!allowedTopLevelKeys.has(key)) {
      fail('UNKNOWN_KEY', `Unknown policy section "${key}"`, key, layer)
    }
  }
  const profiles = merged['profiles']
  const agents = merged['agents']
  const categories = merged['categories']
  if (profiles !== undefined) {
    if (!isRecord(profiles)) fail('INVALID_POLICY', 'profiles must be an object', 'profiles', layer)
    for (const [id, value] of Object.entries(profiles)) validateProfile(id, value, layer)
  }
  if (agents !== undefined) {
    if (!isRecord(agents)) fail('INVALID_POLICY', 'agents must be an object', 'agents', layer)
    for (const [id, value] of Object.entries(agents)) validateAgent(id, value, layer)
  }
  if (categories !== undefined) {
    if (!isRecord(categories)) fail('INVALID_POLICY', 'categories must be an object', 'categories', layer)
    for (const [id, value] of Object.entries(categories)) validateCategory(id, value, layer)
  }
  // Reference validation (cross-entity; only meaningful after the full merge).
  if (agents !== undefined && profiles !== undefined) {
    for (const [id, value] of Object.entries(agents)) {
      const agent = value as { profile?: unknown }
      if (typeof agent.profile === 'string' && !Object.prototype.hasOwnProperty.call(profiles, agent.profile)) {
        fail('UNKNOWN_REFERENCE', `agents.${id}.profile references unknown profile "${String(agent.profile)}"`, `agents.${id}.profile`, layer)
      }
    }
  }
  if (categories !== undefined && agents !== undefined) {
    for (const [id, value] of Object.entries(categories)) {
      const category = value as { agent?: unknown }
      if (typeof category.agent === 'string' && !Object.prototype.hasOwnProperty.call(agents, category.agent)) {
        fail('UNKNOWN_REFERENCE', `categories.${id}.agent references unknown agent "${String(category.agent)}"`, `categories.${id}.agent`, layer)
      }
    }
  }
  const document = merged as unknown as PolicyDocument
  // Plain-JSON validation: a JSON round trip must be structurally identical.
  const roundTrip = JSON.parse(JSON.stringify(document))
  if (!deepEqual(roundTrip, document)) {
    fail('INVALID_POLICY', 'policy document is not plain JSON-serializable data', '', layer)
  }
  return deepFreeze(document)
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false
    return left.every((item, index) => deepEqual(item, (right as unknown[])[index]))
  }
  if (isRecord(left)) {
    if (!isRecord(right)) return false
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) return false
    return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]))
  }
  return false
}

function deepFreeze<T>(value: T): T {
  if (isRecord(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key])
    Object.freeze(value)
  } else if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item)
    Object.freeze(value)
  }
  return value
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load, merge, and RUNTIME-VALIDATE the policy layers into a frozen document. */
export function loadPolicyLayers(layers: PolicyLayers): PolicyDocument {
  let merged: Record<string, unknown> = Object.create(null) as Record<string, unknown>
  for (const layer of layerNames) {
    const value = layers[layer]
    if (value === undefined) continue
    merged = merge(merged, parseLayer(value, layer))
  }
  return validatePolicyDocument(merged)
}

/** Validate an already-built plain policy object (programmatic use). */
export function validatePolicy(value: unknown): PolicyDocument {
  if (!isRecord(value)) {
    throw new ConfigResolutionError('INVALID_POLICY', 'policy must be an object', { path: '' })
  }
  return validatePolicyDocument(value as Record<string, unknown>)
}

/**
 * Canonical deterministic serialization: object keys sorted recursively,
 * arrays in insertion order, no whitespace. Same input ⇒ same string.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key])
    }
    return sorted
  }
  return value
}

/** Deterministic serialization of a policy document (snapshot fingerprint). */
export function serializePolicy(policy: PolicyDocument): string {
  return canonicalJson(policy)
}

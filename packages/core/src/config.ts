import { parse, type ParseError } from 'jsonc-parser'
import {
  ConfigResolutionError,
  type PolicyDocument,
  type PolicyLayerValue,
  type PolicyLayers,
} from './contracts.ts'

const layerNames = ['defaults', 'user', 'project', 'request'] as const
const allowedKeys = new Set(['profiles', 'agents', 'categories'])

export function loadPolicyLayers(layers: PolicyLayers): PolicyDocument {
  let merged: Record<string, unknown> = {}
  for (const layer of layerNames) {
    const value = layers[layer]
    if (value === undefined) continue
    merged = merge(merged, parseLayer(value, layer))
  }
  return merged as unknown as PolicyDocument
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
        layer,
      )
    }
  } else {
    parsed = value
  }
  if (!isRecord(parsed)) {
    throw new ConfigResolutionError('INVALID_JSONC', `${layer} must contain a JSON object`, layer)
  }
  for (const key of Object.keys(parsed)) {
    if (!allowedKeys.has(key)) {
      throw new ConfigResolutionError('UNKNOWN_KEY', `Unknown policy key ${key}`, layer)
    }
  }
  return parsed
}

function merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const previous = result[key]
    result[key] = isRecord(previous) && isRecord(value) ? merge(previous, value) : value
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

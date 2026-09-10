import type {
  EffectiveRouteObservation,
  RouteIdentity,
  RouteResolutionCause,
} from '@dshelm/core'
import { snapshotSessionLog } from './session-log-compat.ts'

interface ResolvedRouteInput {
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly reasoning?: string
}

export interface ObserveEffectiveRouteOptions {
  /** DSH Session or compatible log surface. */
  readonly session: unknown
  /** DSHelm's pre-execution policy result. */
  readonly resolved: ResolvedRouteInput
  /** Caller-owned request intent, when it is known independently of policy. */
  readonly requested?: RouteIdentity
  /** Why DSHelm intentionally changed the requested route, when known. */
  readonly resolutionCause?: RouteResolutionCause
  readonly childId?: string
  readonly sessionId?: string
  /** Injectable clock for deterministic fixtures. */
  readonly now?: () => string
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined
}

/**
 * Read provider/model/reasoning from one durable DSH `request/header` event.
 *
 * This deliberately uses a structural read rather than trusting a particular
 * DSH SessionEvent declaration generation. A malformed/incomplete header is
 * not evidence and therefore yields undefined instead of falling back to the
 * policy-selected route.
 */
function routeFromRequestHeader(event: unknown): RouteIdentity | undefined {
  const eventRecord = asRecord(event)
  if (eventRecord?.type !== 'request/header') return undefined
  const data = asRecord(eventRecord.data)
  const header = asRecord(data?.header)
  const config = asRecord(header?.config)
  const provider = config?.provider
  const model = config?.model
  if (typeof provider !== 'string' || provider.length === 0) return undefined
  if (typeof model !== 'string' || model.length === 0) return undefined
  const reasoning = config?.reasoningEffort
  return {
    provider,
    model,
    ...(typeof reasoning === 'string' && reasoning.length > 0 ? { reasoning } : {}),
  }
}

/**
 * Build an EffectiveRouteObservation from the latest valid durable DSH request
 * header in a Session log.
 *
 * The function returns undefined when no valid runtime header exists. It never
 * substitutes `resolved` for missing runtime evidence, preserving the core
 * requested → resolved → effective truth boundary.
 */
export function observeEffectiveRouteFromSession(
  options: ObserveEffectiveRouteOptions,
): EffectiveRouteObservation | undefined {
  const events = snapshotSessionLog(options.session)
  let effective: RouteIdentity | undefined
  for (let index = events.length - 1; index >= 0; index -= 1) {
    effective = routeFromRequestHeader(events[index])
    if (effective !== undefined) break
  }
  if (effective === undefined) return undefined

  const resolved: RouteIdentity = {
    provider: options.resolved.provider,
    model: options.resolved.model,
    ...(options.resolved.reasoning !== undefined ? { reasoning: options.resolved.reasoning } : {}),
  }

  return {
    version: 1,
    ...(options.requested !== undefined ? { requested: options.requested } : {}),
    resolved,
    effective,
    ...(options.resolutionCause !== undefined ? { resolutionCause: options.resolutionCause } : {}),
    role: options.resolved.role,
    ...(options.childId !== undefined ? { childId: options.childId } : {}),
    ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
    evidenceSource: 'dsh.session.request/header',
    observedAt: (options.now ?? (() => new Date().toISOString()))(),
  }
}

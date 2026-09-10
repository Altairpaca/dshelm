import type { ReasoningEffort } from './contracts.ts'

/** Provider/model/reasoning identity at one point in the routing lifecycle. */
export interface RouteIdentity {
  readonly provider: string
  readonly model: string
  readonly reasoning?: ReasoningEffort
}

/** Why a requested route was intentionally changed before execution, when known. */
export type RouteResolutionCause = 'policy' | 'explicit-override' | 'fallback' | 'unknown'

/** Individual route fields whose values differ across two routing states. */
export type RouteFieldChange = 'provider' | 'model' | 'reasoning'

/** User-facing summary of requested-to-effective route divergence. */
export type RouteDivergenceKind =
  | 'same-route'
  | 'provider-change'
  | 'model-change'
  | 'reasoning-change'
  | 'explicit-override'
  | 'fallback'
  | 'unknown'

/**
 * Routing state before durable runtime evidence is necessarily available.
 *
 * `requested` is optional because some callers only have a policy-resolved
 * route. `effective` is optional until a DSH request/session record proves what
 * actually executed. Missing runtime evidence must stay unknown rather than be
 * inferred from `resolved`.
 */
export interface EffectiveRouteState {
  readonly requested?: RouteIdentity
  readonly resolved: RouteIdentity
  readonly effective?: RouteIdentity
  readonly resolutionCause?: RouteResolutionCause
}

/**
 * Durable observation of an effective route.
 *
 * The source is intentionally an opaque, stable producer-owned identifier
 * (`request/header`, adapter request record, session record, ...). Core does
 * not decide which DSH seam is authoritative; adapters must only emit this
 * record when they have runtime evidence rather than UI/config inference.
 */
export interface EffectiveRouteObservation extends EffectiveRouteState {
  readonly version: 1
  readonly effective: RouteIdentity
  readonly role: string
  readonly childId?: string
  readonly sessionId?: string
  readonly evidenceSource: string
  readonly observedAt: string
}

export interface RouteDivergence {
  readonly kind: RouteDivergenceKind
  /** Requested (or resolved when requested is absent) -> effective. */
  readonly changes: readonly RouteFieldChange[]
  /** Requested -> resolved. Empty when requested is absent. */
  readonly policyChanges: readonly RouteFieldChange[]
  /** Resolved -> effective. Empty when effective evidence is absent. */
  readonly runtimeChanges: readonly RouteFieldChange[]
  /** Whether runtime evidence exactly matches the pre-execution resolution. */
  readonly matchesResolved?: boolean
}

function diffRoute(left: RouteIdentity, right: RouteIdentity): RouteFieldChange[] {
  const changes: RouteFieldChange[] = []
  if (left.provider !== right.provider) changes.push('provider')
  if (left.model !== right.model) changes.push('model')
  if (left.reasoning !== right.reasoning) changes.push('reasoning')
  return changes
}

/**
 * Classify route truth without inventing missing runtime state.
 *
 * Provider changes take precedence over model/reasoning changes in the compact
 * `kind`, while `changes` preserves every changed field. Explicit overrides and
 * fallbacks retain their known cause so an intentional divergence is not shown
 * as unexplained runtime drift.
 */
export function classifyRouteDivergence(state: EffectiveRouteState): RouteDivergence {
  const policyChanges = state.requested === undefined
    ? []
    : diffRoute(state.requested, state.resolved)

  if (state.effective === undefined) {
    return {
      kind: 'unknown',
      changes: [],
      policyChanges,
      runtimeChanges: [],
    }
  }

  const runtimeChanges = diffRoute(state.resolved, state.effective)
  const baseline = state.requested ?? state.resolved
  const changes = diffRoute(baseline, state.effective)
  const matchesResolved = runtimeChanges.length === 0

  if (changes.length === 0) {
    return { kind: 'same-route', changes, policyChanges, runtimeChanges, matchesResolved }
  }
  if (state.resolutionCause === 'explicit-override') {
    return { kind: 'explicit-override', changes, policyChanges, runtimeChanges, matchesResolved }
  }
  if (state.resolutionCause === 'fallback') {
    return { kind: 'fallback', changes, policyChanges, runtimeChanges, matchesResolved }
  }
  if (changes.includes('provider')) {
    return { kind: 'provider-change', changes, policyChanges, runtimeChanges, matchesResolved }
  }
  if (changes.includes('model')) {
    return { kind: 'model-change', changes, policyChanges, runtimeChanges, matchesResolved }
  }
  return { kind: 'reasoning-change', changes, policyChanges, runtimeChanges, matchesResolved }
}

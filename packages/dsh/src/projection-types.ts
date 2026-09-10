import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-session-projection/types'
import type { ControlPlaneProjectionValue } from './session-events.ts'

/**
 * Host-only augmentation for the merge-extensible DSH projection maps.
 *
 * Kept out of `session-events.ts` because that shared wire-types module is also
 * compiled into the browser client declaration graph. rc.7 uses only
 * `SessionProjectionMap`; current DSH separates internal fold state into
 * `SessionProjectionStateMap`. Declaring both keeps one DSHelm projection key
 * valid across the two generations without leaking host augmentation into the
 * browser declaration graph.
 *
 * The explicit type-only imports are load-bearing: the root import activates
 * DSH's `Context.sessionProjections` augmentation, while the `/types` import
 * makes this declaration an augmentation of the published module rather than
 * a new ambient module after `projection.ts` stopped importing the
 * generation-specific `ProjectionDefinition` type.
 */
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    'dshelm.controlPlane': ControlPlaneProjectionValue
  }

  interface SessionProjectionStateMap {
    'dshelm.controlPlane': ControlPlaneProjectionValue | undefined
  }
}

export {}

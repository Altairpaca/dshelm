import type { ControlPlaneProjectionValue } from './session-events.ts'

/**
 * Host-only augmentation for the merge-extensible DSH projection map.
 *
 * Kept out of `session-events.ts` because that shared wire-types module is also
 * compiled into the browser client declaration graph. Both rc.7 and 0.1.5
 * publish this augmentation target from `@deepseek-ai/dsh-session-projection/types`.
 */
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    'dshelm.controlPlane': ControlPlaneProjectionValue
  }
}

export {}

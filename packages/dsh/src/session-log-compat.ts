import type { SessionEvent } from '@deepseek-ai/dsh-session'

/**
 * Narrow compatibility face for the DSH session-log read API.
 *
 * The verified 0.1.0-rc.x baseline exposes `session.events`. Current DSH
 * releases expose stable log snapshots through `snapshotEvents()` (plus
 * `eventAt()` / `seq`). Keeping this bridge structural lets DSHelm stop
 * depending directly on the removed getter without widening the verified
 * package baseline before the 0.1.5 candidate journey is complete.
 */
interface SessionLogCompat {
  readonly events?: readonly SessionEvent[]
  snapshotEvents?: () => readonly SessionEvent[]
}

/** Return a stable session-event snapshot across legacy and current DSH APIs. */
export function snapshotSessionLog(session: unknown): readonly SessionEvent[] {
  const compatible = session as SessionLogCompat
  if (typeof compatible.snapshotEvents === 'function') {
    return compatible.snapshotEvents()
  }
  if (compatible.events !== undefined) {
    return compatible.events
  }
  throw new Error('unsupported DSH session log API: expected snapshotEvents() or events')
}

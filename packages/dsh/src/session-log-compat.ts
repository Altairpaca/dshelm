import type { SessionEvent } from '@deepseek-ai/dsh-session'

/**
 * Narrow compatibility face for the DSH session-log read API.
 *
 * DSH 0.1.0-rc.x exposed `session.events`; the 0.1.2 line replaces that
 * materialized getter with `snapshotEvents()` / `eventAt()` / `seq`.
 * Keeping the bridge structural lets DSHelm run against both shapes while the
 * npm dependency baseline is upgraded in one verified step.
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

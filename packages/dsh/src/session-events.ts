/**
 * DSHelm session events (merge-extensible `SessionEventMap` entry) and the
 * control-plane projection wire value.
 *
 * Transport design: the host appends a whole-value `dshelm/control-plane`
 * event to the PARENT session after every policy-driven delegation;
 * `dsh-session-projection` folds it into the `dshelm.controlPlane` projection
 * key, which reaches the browser through the official projection wire path.
 * No second UI-only explanation model exists: the projection value IS the
 * canonical `ResolutionTrace`-derived snapshot.
 *
 * This shared file is compiled into both host and browser declarations. Keep
 * the host-only SessionProjectionMap augmentation in `projection-types.ts` so
 * the browser build does not need to resolve that host package subpath.
 */
import type { SessionEventMap } from '@deepseek-ai/dsh-session/types'
import type { ResolutionTrace } from '@dshelm/core'

/** One delegated role's effective execution (roles × models matrix row). */
export interface ControlPlaneRoleRow {
  readonly role: string
  readonly category: string
  readonly agent: string
  readonly profile: string
  readonly provider: string
  readonly model: string
  readonly reasoning?: string
  readonly persona?: string
  readonly maxDepth?: number
  readonly tools?: { readonly allow?: readonly string[]; readonly deny?: readonly string[] }
  readonly verification?: { readonly required: boolean; readonly maxIterations?: number }
  readonly skills?: readonly string[]
}

/** Whole-value control-plane snapshot appended after each delegation. */
export interface ControlPlaneSnapshot {
  readonly version: 1
  /** The request that produced this snapshot. */
  readonly request: { readonly category: string; readonly override?: { readonly provider?: string; readonly model?: string; readonly reasoning?: string } }
  /** Roles resolved so far (append-only whole snapshot). */
  readonly roles: readonly ControlPlaneRoleRow[]
  /** The inspector: one canonical ResolutionTrace. */
  readonly inspector: {
    readonly request: string
    readonly trace: ResolutionTrace
  }
  /** Provenance source label of this snapshot. */
  readonly source: string
}

/** Wire value of the `dshelm.controlPlane` session projection. */
export type ControlPlaneProjectionValue = ControlPlaneSnapshot

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Whole-value DSHelm control-plane snapshot. `ignorable` is set by the
     * projection contract: this event is informational for reconstruction and
     * never changes how the underlying Session log is interpreted.
     */
    'dshelm/control-plane': ControlPlaneSnapshot
  }
}

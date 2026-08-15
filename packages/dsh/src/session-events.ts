/**
 * DSHelm session events (merge-extensible `SessionEventMap` entry) and the
 * control-plane projection value.
 *
 * Transport design (v0.1): the host appends a whole-value
 * `dshelm/control-plane` event to the PARENT session after every
 * policy-driven delegation; `dsh-session-projection` folds it into the
 * `dshelm.controlPlane` projection key, which reaches the browser through
 * the official `session/projection` wire frames and the client's
 * `useProjection` seat. No second UI-only explanation model exists: the
 * projection value IS the canonical `ResolutionTrace`-derived snapshot.
 *
 * Augmentation target: `SessionEventMap` is declared in the
 * `@deepseek-ai/dsh-session/types` submodule (lib/types/types.d.ts), NOT the
 * package root — augmenting the root is a silent no-op (verified rc.6;
 * official pattern: subagent/src/descriptor.ts).
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
     * Whole-value DSHelm control-plane snapshot. `ignorable` is set: the
     * snapshot is informational for reconstruction — the policy trace never
     * changes how the log is interpreted.
     */
    'dshelm/control-plane': ControlPlaneSnapshot
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    'dshelm.controlPlane': ControlPlaneProjectionValue
  }
}

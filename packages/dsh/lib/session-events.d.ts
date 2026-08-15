import type { ResolutionTrace } from '@dshelm/core';
/** One delegated role's effective execution (roles × models matrix row). */
export interface ControlPlaneRoleRow {
    readonly role: string;
    readonly category: string;
    readonly agent: string;
    readonly profile: string;
    readonly provider: string;
    readonly model: string;
    readonly reasoning?: string;
    readonly persona?: string;
    readonly maxDepth?: number;
    readonly tools?: {
        readonly allow?: readonly string[];
        readonly deny?: readonly string[];
    };
    readonly verification?: {
        readonly required: boolean;
        readonly maxIterations?: number;
    };
    readonly skills?: readonly string[];
}
/** Whole-value control-plane snapshot appended after each delegation. */
export interface ControlPlaneSnapshot {
    readonly version: 1;
    /** The request that produced this snapshot. */
    readonly request: {
        readonly category: string;
        readonly override?: {
            readonly provider?: string;
            readonly model?: string;
            readonly reasoning?: string;
        };
    };
    /** Roles resolved so far (append-only whole snapshot). */
    readonly roles: readonly ControlPlaneRoleRow[];
    /** The inspector: one canonical ResolutionTrace. */
    readonly inspector: {
        readonly request: string;
        readonly trace: ResolutionTrace;
    };
    /** Provenance source label of this snapshot. */
    readonly source: string;
}
/** Wire value of the `dshelm.controlPlane` session projection. */
export type ControlPlaneProjectionValue = ControlPlaneSnapshot;
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /**
         * Whole-value DSHelm control-plane snapshot. `ignorable` is set: the
         * snapshot is informational for reconstruction — the policy trace never
         * changes how the log is interpreted.
         */
        'dshelm/control-plane': ControlPlaneSnapshot;
    }
}
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        'dshelm.controlPlane': ControlPlaneProjectionValue;
    }
}
//# sourceMappingURL=session-events.d.ts.map
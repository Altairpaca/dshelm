/**
 * The REAL DSHelm host service: provided by this package's plugin fiber
 * under `dshelm.policy` (Cordis `Service` base class — the same
 * registration path as `ctx.llm`, `ctx.subagents`, ...).
 *
 * Lifecycle: construction registers the service through `ctx.reflect.provide`
 * in the plugin fiber; disposal unregisters it. A duplicate registration in
 * the same scope fails loud ("service ... has been registered at ...").
 *
 * API: `resolve(request)`, `snapshot()`, `explain(request)` — plus the
 * delegation hook the slice runner uses to publish control-plane snapshots.
 */
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import {
  PolicyResolutionError,
  resolvePolicy,
  type PolicyDocument,
  type ResolveRequest,
  type ResolvedAgentPolicy,
  type ResolutionTrace,
  type RuntimeCapabilities,
} from '@dshelm/core'
import { loadPolicyLayers, type PolicyLayers } from '@dshelm/core'
import { createDshCapabilities, attachAdvisoryCatalog, type DshKnowledgeLookup, type LlmLike } from './capabilities.ts'
import type { ControlPlaneRoleRow, ControlPlaneSnapshot } from './session-events.ts'

/** Public face of the host service. */
export interface DSHelmPolicyServiceFace {
  /** Resolve one request against the live policy + runtime; fails loud. */
  resolve(request: ResolveRequest): Promise<ResolvedAgentPolicy>
  /** Resolve and return the canonical trace (inspector input). */
  explain(request: ResolveRequest): Promise<ResolutionTrace>
  /** Current control-plane snapshot (roles × models + inspector). */
  snapshot(): ControlPlaneSnapshot
  /** Record one delegated role into the snapshot and publish the event. */
  recordDelegation(resolved: ResolvedAgentPolicy, sessionId: string): void
  /** Current merged policy document (frozen). */
  policy(): PolicyDocument
}

export interface DSHelmPolicyServiceOptions {
  /** Layer sources; re-read on every resolve so settings/project edits take
   *  effect without a restart (the merged document is runtime-validated each
   *  time — never a stale cast). */
  readonly layers: () => PolicyLayers
  readonly llm: LlmLike
  readonly knowledge?: DshKnowledgeLookup
  /** Publish channel for control-plane events; absent = snapshot-only. */
  readonly publish?: (sessionId: string, snapshot: ControlPlaneSnapshot) => void
}

/** One delegation recorded on the host (per session). */
interface SessionRecord {
  roles: ControlPlaneRoleRow[]
  last: ControlPlaneSnapshot | undefined
}

export class DSHelmPolicyService extends Service implements DSHelmPolicyServiceFace {
  static inject = ['llm', 'sessions']

  private readonly layers: () => PolicyLayers
  private readonly llm: LlmLike
  private readonly knowledge: DshKnowledgeLookup | undefined
  private readonly publish: ((sessionId: string, snapshot: ControlPlaneSnapshot) => void) | undefined
  private readonly records = new Map<string, SessionRecord>()

  constructor(ctx: Context, options: DSHelmPolicyServiceOptions) {
    super(ctx, 'dshelm.policy')
    this.layers = options.layers
    this.llm = options.llm
    this.knowledge = options.knowledge
    this.publish = options.publish
  }

  /** Current merged, runtime-validated policy document (frozen). */
  policy(): PolicyDocument {
    return loadPolicyLayers(this.layers())
  }

  async resolve(request: ResolveRequest): Promise<ResolvedAgentPolicy> {
    const capabilities = createDshCapabilities(this.llm, this.knowledge)
    return resolvePolicy(this.policy(), capabilities, request)
  }

  async explain(request: ResolveRequest): Promise<ResolutionTrace> {
    try {
      const resolved = await this.resolve(request)
      return resolved.trace
    } catch (error) {
      if (error instanceof PolicyResolutionError && error.trace !== undefined) {
        return error.trace
      }
      throw error
    }
  }

  snapshot(): ControlPlaneSnapshot {
    // Aggregate every session record into one snapshot (single host-wide view
    // for the Web control plane in v0.1; per-session views ride the projection).
    const roles: ControlPlaneRoleRow[] = []
    let inspector: ControlPlaneSnapshot['inspector'] | undefined
    for (const record of this.records.values()) {
      roles.push(...record.roles)
      if (inspector === undefined && record.last !== undefined) inspector = record.last.inspector
    }
    return {
      version: 1,
      request: inspector?.trace.request ?? { category: '' },
      roles,
      inspector: inspector ?? {
        request: 'no-delegation',
        trace: {
          version: 1,
          request: { category: '' },
          category: '',
          agent: '',
          profile: '',
          candidates: [],
          fields: [],
        },
      },
      source: 'host:dshelm.policy',
    }
  }

  recordDelegation(resolved: ResolvedAgentPolicy, sessionId: string): void {
    let record = this.records.get(sessionId)
    if (record === undefined) {
      record = { roles: [], last: undefined }
      this.records.set(sessionId, record)
    }
    const row: ControlPlaneRoleRow = {
      role: resolved.role,
      category: resolved.category,
      agent: resolved.trace.agent,
      profile: resolved.trace.profile,
      provider: resolved.provider,
      model: resolved.model,
      ...(resolved.reasoning !== undefined ? { reasoning: resolved.reasoning } : {}),
      ...(resolved.persona !== undefined ? { persona: resolved.persona } : {}),
      ...(resolved.maxDepth !== undefined ? { maxDepth: resolved.maxDepth } : {}),
      ...(resolved.tools !== undefined ? { tools: resolved.tools } : {}),
      ...(resolved.verification !== undefined ? { verification: resolved.verification } : {}),
      ...(resolved.skills !== undefined ? { skills: resolved.skills } : {}),
    }
    record.roles.push(row)
    const snapshot: ControlPlaneSnapshot = {
      version: 1,
      request: resolved.trace.request,
      roles: [...record.roles],
      inspector: {
        request: resolved.category,
        trace: resolved.trace,
      },
      source: `host:dshelm.policy:session:${sessionId}`,
    }
    record.last = snapshot
    this.publish?.(sessionId, snapshot)
  }

  /** Full capability snapshot including advisory catalog (inspector view). */
  async capabilitiesWithCatalog(): Promise<RuntimeCapabilities> {
    return attachAdvisoryCatalog(createDshCapabilities(this.llm, this.knowledge), this.llm)
  }
}

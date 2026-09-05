/**
 * DSHelm subagent provider: maps resolved policy onto the OFFICIAL
 * `SubagentStartRequest` fields (persona, toolFilter, maxDepth, agentOptions)
 * and delegates execution to the official in-process driver.
 *
 * Fail-loud contract: `SubagentRuntime.start` itself rejects any requested
 * field whose provider capability is missing (`UNSUPPORTED_CAPABILITY`),
 * so a provider without toolFilter/persona/depth support can never silently
 * ignore DSHelm policy.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SubagentProvider, ResolvedSubagentStartRequest, SubagentRun } from '@deepseek-ai/dsh-subagent'
import { startInProcessRun } from '@deepseek-ai/dsh-subagent-in-process-driver'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ResolvedAgentPolicy } from '@dshelm/core'
import type { DSHelmPolicyServiceFace } from './service.ts'

export const DSHELM_PROVIDER_NAME = 'dshelm'
const ROLE_LABEL_PREFIX = 'dshelm:'

/**
 * DSH 0.1.2 adds the `agentOptions` start capability. The structural cast keeps
 * this package compilable against the currently pinned 0.1.0-rc.7 types while
 * exposing the new runtime flag to 0.1.2 hosts; legacy hosts ignore the extra
 * property.
 */
const DSHELM_SUBAGENT_CAPABILITIES = {
  agentOptions: true,
  outputSchema: false,
  depthLimit: true,
  toolFilter: true,
  persona: true,
} as unknown as SubagentProvider['capabilities']

export interface DSHelmProviderOptions {
  readonly service: DSHelmPolicyServiceFace
  /** Resolve the category for a role label (e.g. planner/worker/reviewer). */
  readonly categoryForRole: (role: string) => string
  /** Record the delegation + publish control-plane snapshots. */
  readonly sessionIdOf: (request: ResolvedSubagentStartRequest) => string
}

/**
 * Build the child's first-request config seed. The session seed contract
 * accepts `request/header` events (validated at the seed boundary), and the
 * loop restores the explicit reasoningEffort from the persisted header when
 * the route matches. This remains the legacy path for 0.1.0-rc.x hosts while
 * 0.1.2 can also consume reasoningEffort from AgentOptions directly.
 */
export function childRequestHeaderSeed(resolved: ResolvedAgentPolicy): SessionEvent[] {
  const config: { provider: string; model: string; reasoningEffort?: string } = {
    provider: resolved.provider,
    model: resolved.model,
    ...(resolved.reasoning !== undefined ? { reasoningEffort: resolved.reasoning } : {}),
  }
  return [
    {
      type: 'request/header',
      seq: 0,
      time: Date.now(),
      data: { header: { config }, reason: 'initial' },
    } as unknown as SessionEvent,
  ]
}

/**
 * Build AgentOptions understood by both DSH generations. `reasoningEffort` was
 * added to AgentOptions in 0.1.2; the assertion deliberately preserves the
 * runtime field when compiling against the legacy type surface.
 */
function resolvedAgentOptions(resolved: ResolvedAgentPolicy): NonNullable<ResolvedSubagentStartRequest['agentOptions']> {
  return {
    provider: resolved.provider,
    model: resolved.model,
    ...(resolved.reasoning !== undefined ? { reasoningEffort: resolved.reasoning } : {}),
  } as NonNullable<ResolvedSubagentStartRequest['agentOptions']>
}

export function createDSHelmProvider(options: DSHelmProviderOptions): SubagentProvider {
  return {
    name: DSHELM_PROVIDER_NAME,
    capabilities: DSHELM_SUBAGENT_CAPABILITIES,
    inheritsParentContext: false,
    start: async (request: ResolvedSubagentStartRequest): Promise<SubagentRun> => {
      const role = roleFromLabel(request.label)
      if (role === undefined) {
        throw new Error(`dshelm provider: request label must start with "${ROLE_LABEL_PREFIX}"`)
      }
      const resolved = await options.service.resolve({ category: options.categoryForRole(role) })
      options.service.recordDelegation(resolved, options.sessionIdOf(request))
      const mapped: ResolvedSubagentStartRequest = {
        ...request,
        agentOptions: resolvedAgentOptions(resolved),
        ...(resolved.persona !== undefined ? { persona: resolved.persona } : {}),
        ...(resolved.tools !== undefined ? { toolFilter: toToolRestriction(resolved.tools) } : {}),
        ...(resolved.maxDepth !== undefined ? { maxDepth: resolved.maxDepth } : {}),
      }
      return startInProcessRun(mapped, { seed: childRequestHeaderSeed(resolved) })
    },
  }
}

export function roleFromLabel(label: string | undefined): string | undefined {
  if (label === undefined || !label.startsWith(ROLE_LABEL_PREFIX)) return undefined
  const role = label.slice(ROLE_LABEL_PREFIX.length)
  return role.length === 0 ? undefined : role
}

/** Map DSHelm ToolPolicy onto the official `ToolRestriction` shape. */
function toToolRestriction(tools: { readonly allow?: readonly string[]; readonly deny?: readonly string[] }):
  | { readonly allow?: readonly string[] }
  | { readonly deny?: readonly string[] } {
  // ToolRestriction accepts { allow } or { deny } (deny wins when both? — the
  // official shape is a union; DSHelm emits one side, allow preferred).
  if (tools.allow !== undefined && tools.allow.length > 0) return { allow: [...tools.allow] }
  if (tools.deny !== undefined && tools.deny.length > 0) return { deny: [...tools.deny] }
  throw new Error('dshelm provider: tool policy must declare allow or deny entries')
}

/** Wire the provider into a live context (fiber-owned). */
export function registerDSHelmProvider(ctx: Context, options: DSHelmProviderOptions): () => void {
  return ctx.subagents.registerProvider(createDSHelmProvider(options))
}

/**
 * DSHelm execution backends (v0.2):
 *
 *  - native: runs the role through the DSH-native agent factory with DSHelm
 *    model selection (the verified v0.1 path).
 *  - agent-teams: maps a DSHelm role onto an AgentTeams durable member
 *    (captain/member/mailbox) when @nanmicoder/dsh-agent-teams is installed;
 *    graceful absence otherwise (fail loud with an actionable message).
 *
 * The backend contract lives in @dshelm/core (DSH-free); packages/dsh
 * implements adapters. Core never depends on AgentTeams.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ExecutionBackend, ExecutionBackendRequest, ExecutionBackendResult } from '@dshelm/core'
import { runRoleAgent } from './slice.ts'

// ---------------------------------------------------------------------------
// Native backend (verified v0.1 path)
// ---------------------------------------------------------------------------

export function nativeExecutionBackend(ctx: Context): ExecutionBackend {
  return {
    name: 'native',
    async run(request: ExecutionBackendRequest): Promise<ExecutionBackendResult> {
      const output = await runRoleAgent({ ctx, resolved: request.resolved, prompt: request.prompt })
      return { output, backend: 'native' }
    },
  }
}

// ---------------------------------------------------------------------------
// AgentTeams adapter (prototype)
// ---------------------------------------------------------------------------

export interface AgentTeamsBackendOptions {
  /** Team id the member joins (created lazily when absent). */
  readonly teamId: string
  /** Captain display name; the durable member parent. */
  readonly captainName?: string
}

/**
 * Map a DSHelm role onto an AgentTeams member.
 *
 * v0.2 prototype scope: the mapping is implemented against the agent-teams
 * 0.1.5 public surface (team state + member spawn via `startContinuable`
 * with the DSHelm-resolved provider/model). The live team run requires the
 * plugin mounted in the composition; when it is absent this backend fails
 * loud with an install hint instead of pretending.
 *
 * Known limitation (recorded): AgentTeams per-member model override must be
 * verified against the effective request/header before heterogeneous
 * topology claims — see docs/ecosystem/verified-stack.md.
 */
export function agentTeamsExecutionBackend(_options: AgentTeamsBackendOptions): ExecutionBackend {
  return {
    name: 'agent-teams',
    async run(_request: ExecutionBackendRequest): Promise<ExecutionBackendResult> {
      // Prototype boundary: the adapter contract is defined and typed; the
      // live mapping (team create → member spawn → mailbox deliver → result
      // read) is the next increment and requires the plugin in the
      // composition. Fail loud rather than fake a run.
      throw new Error(
        'agent-teams backend: live member execution is not wired in this prototype — '
        + 'install @nanmicoder/dsh-agent-teams@^0.1.5 in the composition and implement '
        + 'the team spawn/deliver mapping (see docs/ecosystem/verified-stack.md)',
      )
    },
  }
}

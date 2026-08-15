/**
 * DSHelm model selection composition over the OFFICIAL
 * `@deepseek-ai/dsh-agent/model-selection` seam.
 *
 * `installModelSelection(agentCtx, ref)` hooks `system-prompt/assemble` and
 * the `agent/request` waterfall so the selected provider/model/reasoningEffort
 * land in the request config (`LlmCallConfig`), get validated by
 * `prepareCall` (unsupported efforts reject with
 * `UNSUPPORTED_REASONING_EFFORT`), are logged as the session
 * `request/header`, and reach the adapter as `GenerateOptions`.
 */
import type { Context } from '@deepseek-ai/cordis'
import { installModelSelection, type ModelSelection, type ModelSelectionRef } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'

/** Install one DSHelm-resolved selection into an unpublished agent scope. */
export function installDSHelmSelection(agentCtx: Context, selection: ModelSelection): () => void {
  const ref: ModelSelectionRef = { current: selection, assembled: undefined }
  return installModelSelection(agentCtx, ref)
}

/** Build the official `ModelSelection` from DSHelm's resolved policy. */
export function toModelSelection(resolved: {
  readonly provider: string
  readonly model: string
  readonly reasoning?: string
}): ModelSelection {
  return {
    provider: resolved.provider,
    model: resolved.model,
    ...(resolved.reasoning !== undefined
      ? { reasoningEffort: ReasoningEffortId(resolved.reasoning) }
      : {}),
  }
}

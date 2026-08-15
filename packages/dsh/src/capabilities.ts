/**
 * DSH runtime capability adapter: maps `ctx.llm` onto the core
 * `RuntimeCapabilities` contract.
 *
 * Contract fixes (round 2):
 *  - `listModels` is ADVISORY only (catalog visibility); it never gates
 *    routing (DSH doc: "Catalog membership is advisory and never changes
 *    routing or request validation").
 *  - exact-model correctness uses `ctx.llm.resolveModelInfo`; dynamic /
 *    unlisted-but-valid models resolve as valid (the DeepSeek adapter returns
 *    the uncatalogued fallback `{ provider, id: model, name: model }`).
 *  - reasoning efforts are the adapter's own opaque ids from
 *    `resolveModelInfo(...).reasoning.efforts[].id`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { ExactModelInfo, RuntimeCapabilities, RuntimeProviderCapability } from '@dshelm/core'

export type LlmLike = Pick<LlmRuntime, 'listProviders' | 'resolveModelInfo' | 'listModels'>

/**
 * Build the runtime capability snapshot from a live `ctx.llm`. Provider
 * routes with a registered adapter are enabled; exact-model answers come from
 * `resolveModelInfo`.
 */
export function createDshCapabilities(llm: LlmLike): RuntimeCapabilities {
  const providers: Record<string, RuntimeProviderCapability> = {}
  for (const provider of llm.listProviders()) {
    providers[provider.id] = {
      enabled: true,
      resolveModel: async (model, signal) => {
        try {
          const info = await llm.resolveModelInfo(provider.id, model, signal)
          return toExactModelInfo(info)
        } catch (error) {
          return classifyLlmError(error)
        }
      },
    }
  }
  return { providers }
}

/**
 * Attach advisory catalog visibility (selector metadata only) from
 * `listModels`. Never used for routing; exposed for the inspector's
 * catalog-visibility view.
 */
export async function attachAdvisoryCatalog(
  capabilities: RuntimeCapabilities,
  llm: LlmLike,
): Promise<RuntimeCapabilities> {
  const providers: Record<string, RuntimeProviderCapability> = { ...capabilities.providers }
  await Promise.all(
    Object.keys(providers).map(async (providerId) => {
      try {
        const models = await llm.listModels(providerId)
        const catalog: Record<string, { readonly visible: boolean }> = {}
        for (const model of models) catalog[model.id] = { visible: true }
        const current = providers[providerId]
        if (current === undefined) return
        providers[providerId] = { ...current, catalog }
      } catch {
        // Advisory: a catalog failure never fails capability construction.
      }
    }),
  )
  return { providers }
}

function toExactModelInfo(
  info: Awaited<ReturnType<LlmLike['resolveModelInfo']>>,
): ExactModelInfo {
  return {
    valid: true,
    ...(info.reasoning !== undefined
      ? {
        reasoningEfforts: info.reasoning.efforts.map((effort) => effort.id),
        ...(info.reasoning.defaultEffort !== undefined
          ? { defaultReasoningEffort: info.reasoning.defaultEffort }
          : {}),
      }
      : {}),
  }
}

/** Map `LlmError` codes onto the core exact-model vocabulary. */
function classifyLlmError(error: unknown): ExactModelInfo {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'NO_ADAPTER') {
    // Provider route vanished between snapshot and resolution.
    return { valid: false, reason: 'model-unresolved' }
  }
  if (
    code === 'INVALID_MODEL_INFO'
    || code === 'INVALID_MODEL_CONTEXT'
    || code === 'INVALID_MODEL_MAX_TOKENS'
    || code === 'INVALID_MODEL_REASONING'
  ) {
    return { valid: false, reason: 'model-invalid' }
  }
  return { valid: false, reason: 'model-unresolved' }
}

/**
 * Session projection unit for the DSHelm control plane.
 *
 * The host publishes whole-value `dshelm/control-plane` events; this unit
 * folds them into the `dshelm.controlPlane` projection key, which the
 * official `session/projection` wire + client `useProjection` seat deliver
 * to the browser. Registered through `ctx.sessionProjections.register`.
 */
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ControlPlaneProjectionValue } from './session-events.ts'

/**
 * Zod schema for the wire payload (schema-validated before it leaves the host).
 *
 * The annotation is `z.ZodType<ControlPlaneProjectionValue>`: zod's inferred
 * output spells optional fields as `T | undefined` while the interfaces use
 * exact optional properties, so the annotation is a variance-only cast — the
 * runtime `parse` (the projection drive's only runtime consumer) is unchanged.
 */
export const controlPlaneSchema: z.ZodType<ControlPlaneProjectionValue> = z.object({
  version: z.literal(1),
  request: z.object({
    category: z.string(),
    override: z.object({
      provider: z.string().optional(),
      model: z.string().optional(),
      reasoning: z.string().optional(),
    }).optional(),
  }),
  roles: z.array(z.object({
    role: z.string(),
    category: z.string(),
    agent: z.string(),
    profile: z.string(),
    provider: z.string(),
    model: z.string(),
    reasoning: z.string().optional(),
    persona: z.string().optional(),
    maxDepth: z.number().int().positive().optional(),
    tools: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
    verification: z.object({
      required: z.boolean(),
      maxIterations: z.number().int().positive().optional(),
    }).optional(),
    skills: z.array(z.string()).optional(),
  })),
  inspector: z.object({
    request: z.string(),
    trace: z.record(z.string(), z.unknown()),
  }),
  source: z.string(),
}) as unknown as z.ZodType<ControlPlaneProjectionValue>

/** Internal fold state: the latest whole snapshot. */
type ControlPlaneState = ControlPlaneProjectionValue | undefined

export const dshelmControlPlaneProjection: ProjectionDefinition<'dshelm.controlPlane', ControlPlaneState> = {
  key: 'dshelm.controlPlane',
  schema: controlPlaneSchema,
  init: () => undefined,
  apply: (state, event: SessionEvent) =>
    event.type === 'dshelm/control-plane' ? event.data : state,
  view: (state) => {
    if (state === undefined) {
      return {
        version: 1,
        request: { category: '' },
        roles: [],
        inspector: { request: 'no-delegation', trace: { version: 1, request: { category: '' }, category: '', agent: '', profile: '', candidates: [], fields: [] } },
        source: 'projection:empty',
      }
    }
    return state
  },
  stateVersion: 1,
}

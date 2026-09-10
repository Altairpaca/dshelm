/**
 * Session projection unit for the DSHelm control plane.
 *
 * The host publishes whole-value `dshelm/control-plane` events; this unit
 * folds them into the `dshelm.controlPlane` projection key, which the
 * official session-projection wire + client projection face deliver to the
 * browser. Registered through `ctx.sessionProjections.register`.
 */
import { z } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import './projection-types.ts'
import type { ControlPlaneProjectionValue } from './session-events.ts'

/**
 * Zod schema for the wire payload (schema-validated before it leaves the host).
 *
 * The annotation is `z.ZodType<ControlPlaneProjectionValue>`: zod's inferred
 * output spells optional fields as `T | undefined` while the interfaces use
 * exact optional properties, so the annotation is a variance-only cast — the
 * runtime `parse` is unchanged.
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

const controlPlaneStateSchema = controlPlaneSchema.optional() as unknown as z.ZodType<ControlPlaneState>

function viewControlPlane(state: ControlPlaneState): ControlPlaneProjectionValue {
  if (state === undefined) {
    return {
      version: 1,
      request: { category: '' },
      roles: [],
      inspector: {
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
      source: 'projection:empty',
    }
  }
  return state
}

/**
 * Dual-generation projection definition.
 *
 * rc.7 reads the top-level `schema` + `view` fields. Current DSH separates the
 * persisted fold state (`stateSchema`) from the client wire surface (`wire`).
 * Keeping both structural contracts on one object lets each registry consume
 * only the fields it owns while the actual fold/view semantics stay identical.
 */
export const dshelmControlPlaneProjection = {
  key: 'dshelm.controlPlane' as const,
  // rc.7 projection contract.
  schema: controlPlaneSchema,
  view: viewControlPlane,
  // Current projection contract.
  stateSchema: controlPlaneStateSchema,
  wire: {
    viewSchema: controlPlaneSchema,
    view: viewControlPlane,
  },
  // A no-argument initializer remains assignable to the current initializer,
  // whose SessionHeader/inheritedEventCount inputs are not needed here.
  init: (): ControlPlaneState => undefined,
  apply: (state: ControlPlaneState, event: SessionEvent): ControlPlaneState =>
    event.type === 'dshelm/control-plane' ? event.data : state,
  stateVersion: 1,
}

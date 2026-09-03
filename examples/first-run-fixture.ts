import {
  resolvePolicy,
  type PolicyDocument,
  type ResolvedAgentPolicy,
  type RuntimeCapabilities,
  type TaskRequirements,
} from '../packages/core/src/index.ts'

const policy: PolicyDocument = {
  profiles: {
    'planning-deep': {
      id: 'planning-deep',
      reasoning: 'max',
      candidates: [
        { provider: 'fixture', model: 'reasoning-pro' },
        { provider: 'fixture', model: 'fast-worker' },
      ],
    },
    'execution-fast': {
      id: 'execution-fast',
      reasoning: 'high',
      candidates: [
        { provider: 'fixture', model: 'fast-worker' },
        { provider: 'fixture', model: 'reasoning-pro' },
      ],
    },
    'review-independent': {
      id: 'review-independent',
      reasoning: 'max',
      candidates: [
        { provider: 'fixture', model: 'reasoning-pro' },
        { provider: 'fixture', model: 'fast-worker' },
      ],
    },
  },
  agents: {
    planner: {
      id: 'planner',
      role: 'planner',
      profile: 'planning-deep',
      persona: 'Plan the task and expose assumptions before execution.',
      maxDepth: 2,
      verification: { required: true, maxIterations: 1 },
    },
    worker: {
      id: 'worker',
      role: 'worker',
      profile: 'execution-fast',
      persona: 'Execute one bounded sub-task and return evidence.',
    },
    reviewer: {
      id: 'reviewer',
      role: 'reviewer',
      profile: 'review-independent',
      persona: 'Review independently and identify unsupported claims.',
      verification: { required: true, maxIterations: 1 },
    },
  },
  categories: {
    plan: { id: 'plan', agent: 'planner', description: 'Plan a bounded research task.' },
    execute: { id: 'execute', agent: 'worker', description: 'Execute one bounded sub-task.' },
    review: { id: 'review', agent: 'reviewer', description: 'Independently review the result.' },
  },
}

const runtime: RuntimeCapabilities = {
  knowledgeSnapshot: 'first-run-fixture-v1',
  providers: {
    fixture: {
      enabled: true,
      resolveModel: (model) => {
        if (model === 'reasoning-pro') {
          return {
            valid: true,
            authReady: true,
            backend: 'fixture',
            harness: 'offline-example',
            reasoningEfforts: ['high', 'max'],
            softScores: {
              strongPlanning: 0.96,
              cheapParallelism: 0.34,
              independentVerification: 0.94,
              fastLatency: 0.45,
            },
            evidence: [{ source: 'checked-in-fixture', layer: 'runtime', confidence: 1 }],
          }
        }
        if (model === 'fast-worker') {
          return {
            valid: true,
            authReady: true,
            backend: 'fixture',
            harness: 'offline-example',
            reasoningEfforts: ['off', 'high', 'max'],
            softScores: {
              strongPlanning: 0.70,
              cheapParallelism: 0.97,
              independentVerification: 0.62,
              fastLatency: 0.96,
            },
            evidence: [{ source: 'checked-in-fixture', layer: 'runtime', confidence: 1 }],
          }
        }
        return { valid: false, reason: 'model-unresolved' }
      },
    },
  },
}

export interface FirstRunStep {
  readonly step: 'planner' | 'worker-a' | 'worker-b' | 'reviewer'
  readonly request: TaskRequirements
  readonly resolution: ResolvedAgentPolicy
}

export interface FirstRunResult {
  readonly fixture: 'offline-routing-only'
  readonly note: string
  readonly steps: readonly FirstRunStep[]
}

async function resolveStep(
  step: FirstRunStep['step'],
  category: 'plan' | 'execute' | 'review',
  requirements: TaskRequirements,
): Promise<FirstRunStep> {
  return {
    step,
    request: requirements,
    resolution: await resolvePolicy(policy, runtime, { category, requirements }),
  }
}

export async function buildFirstRunResult(): Promise<FirstRunResult> {
  const steps = await Promise.all([
    resolveStep('planner', 'plan', { needsStrongPlanning: true, authConstraint: 'authenticated' }),
    resolveStep('worker-a', 'execute', { needsCheapParallelism: true, needsFastLatency: true, authConstraint: 'authenticated' }),
    resolveStep('worker-b', 'execute', { needsCheapParallelism: true, needsFastLatency: true, authConstraint: 'authenticated' }),
    resolveStep('reviewer', 'review', { needsIndependentVerification: true, authConstraint: 'authenticated' }),
  ])

  return {
    fixture: 'offline-routing-only',
    note: 'This fixture demonstrates DSHelm routing and Resolution Trace only; it performs no provider calls or task execution.',
    steps,
  }
}

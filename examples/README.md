# DSHelm examples

DSHelm keeps two first-run fixtures separate so evidence is not overstated:

| Command | What is real | What is synthetic |
| --- | --- | --- |
| `pnpm example:first-run` | DSHelm Core resolution and Resolution Trace | runtime/provider capability fixture; no agent execution |
| `pnpm example:dsh-execution` | DSH Context, agent factory, AgentLoop, planner/worker/reviewer dataflow, request routing | deterministic LLM adapter; no external provider or credential |

## 1. Offline routing fixture

The smallest example is intentionally **offline and credential-free**. It demonstrates the DSHelm policy resolver and Resolution Trace across a bounded role sequence:

```text
planner → worker A
        → worker B
        → reviewer
```

Run from the repository root after `pnpm install`:

```bash
pnpm example:first-run
```

The command prints deterministic JSON containing, for every role:

- the routing requirements;
- resolved role/provider/model/reasoning level;
- selected candidate;
- all candidate outcomes and scores;
- model-knowledge snapshot and evidence provenance;
- field-level Resolution Trace provenance.

The checked-in runtime is a synthetic fixture (`fixture/reasoning-pro` and `fixture/fast-worker`). It performs **no network request, provider authentication, tool execution, or agent task execution**. Its purpose is to make the routing/explanation contract observable before a user configures real providers.

Expected selection:

| Step | Requirement | Selected fixture model |
| --- | --- | --- |
| planner | strong planning | `reasoning-pro` |
| worker A | cheap parallelism + fast latency | `fast-worker` |
| worker B | cheap parallelism + fast latency | `fast-worker` |
| reviewer | independent verification | `reasoning-pro` |

The fixture is covered by `packages/core/tests/first-run-example.test.ts`.

## 2. Real DSH execution with a synthetic provider

The second fixture crosses the execution boundary without requiring an API key:

```bash
pnpm example:dsh-execution
```

It composes the real DSH services used by DSHelm (`LlmRuntime`, sessions, system prompt, tools, agent registry, AgentLoop, session projections, and subagents), registers a deterministic in-process LLM adapter, then runs the repository's `runPolicySlice` contract:

```text
goal
  → planner executes and emits PlanArtifact
  → two bounded workers execute through AgentLoop
  → reviewer executes and emits PASS / REVISE
```

The emitted JSON includes:

- the planner artifact and both worker outputs;
- the reviewer verdict and revision count;
- every DSHelm resolved policy and Resolution Trace;
- `requestRoutes`, captured from the actual DSH LLM adapter calls.

The fixture test asserts that `requestRoutes` exactly match the provider/model routes in the DSHelm resolutions. This demonstrates that routing decisions are carried into real DSH agent requests. The model responses remain deterministic fixture data, so this is **not** evidence that any external provider, model quality, OAuth flow, or network path works.

The execution fixture is covered by `packages/dsh/tests/dsh-execution-example.test.ts`, and CI records both first-run JSON outputs as short-lived artifacts.

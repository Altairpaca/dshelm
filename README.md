# DeepHelm

**The agent control plane for DeepSeek Harness.**

> Built for DSH. Designed to grow beyond it.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#project-status)

DeepHelm is an open-source policy, routing, and orchestration control layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

DeepSeek Harness already provides the runtime primitives needed to build capable coding agents. DeepHelm focuses on a different question: **how should those primitives be configured, composed, routed, and observed when one workflow contains multiple agents and multiple models?**

The goal is a single place to define and inspect:

- agent roles and responsibilities;
- model/provider profiles and reasoning policies;
- task categories and routing rules;
- tools, skills, prompts, and permissions;
- fallback and verification policies;
- multi-agent delegation and orchestration policies;
- the final configuration that was actually resolved at runtime.

## Project status

> [!WARNING]
> DeepHelm is in **pre-alpha** development. There is no stable configuration schema or public API yet.

The first milestone is deliberately DSH-first. We want to prove the policy model against real DeepSeek Harness capabilities before generalizing it into a broader harness abstraction.

### Verified v0.1 vertical slice

The current bootstrap branch contains a runnable, keyless vertical slice:

- `@deephelm/core` resolves category -> agent -> model profile -> runtime
  candidate deterministically and emits JSON-safe provenance;
- JSONC defaults, user, project, and request layers merge in that order with
  fail-loud parse and unknown-key diagnostics;
- `@deephelm/dsh` maps the pinned DSH LLM catalog and `ctx.subagents.start`
  seam, then runs planner -> two workers -> reviewer with heterogeneous model
  assignments;
- the native client module renders a Roles x Models matrix and Resolution
  Inspector from host-provided state;
- a fresh local DSH profile can install the bundle and show it in
  `--dump-config`.

Validated against DSH commit
`47f943859bef60e4160492346772ded9b24f765a`. A credentialed provider E2E is
not claimed; keyless tests use a real pinned Cordis/SubagentRuntime
composition.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm run qa:web -- --profile deephelm-v01 --url http://127.0.0.1:19876
```

## Why DeepHelm?

A mature multi-agent setup quickly needs answers to questions such as:

- Which agent should handle this task?
- Which model and provider should that agent use?
- Should a cheap/fast model execute after a stronger model plans?
- Which tools and skills should be available to each role?
- What happens when a provider fails or a result does not verify?
- Which tasks may run in parallel?
- Which model reviews the result?
- Why did the runtime choose this exact configuration?

DeepHelm aims to make those decisions **explicit, reusable, composable, and observable** rather than scattering them across prompts, provider settings, workflow code, and plugin-specific configuration.

## Mental model

```text
                    DeepHelm
         ┌──────────────┴──────────────┐
         │                             │
     Policy Core                Visual Control Plane
         │                             │
         └──────────────┬──────────────┘
                        │
                    DSH Adapter
                        │
       ┌────────────────┼────────────────┐
       │                │                │
    Subagents        Workflows        Presets
       │                │                │
       └────────────────┼────────────────┘
                        │
                DeepSeek Harness
```

DeepHelm is **not intended to replace the DeepSeek Harness runtime**. It should sit above DSH's native capabilities and make heterogeneous agent policy easier to configure and understand.

## Core concepts

### Agents

Named roles with their own model policy, instructions, tools, skills, and execution constraints.

Examples might include `planner`, `explore`, `executor`, `reviewer`, and `librarian`.

### Model profiles

Reusable model/provider configurations so orchestration logic does not need to hard-code a concrete model everywhere.

### Categories

Task intent can resolve into an agent, model profile, or policy bundle. A small task may route differently from a deep reasoning or independent verification task.

### Policy resolution

A routing decision should be inspectable as a chain rather than hidden behind a generic agent label:

```text
request
  → category
  → agent role
  → model profile
  → provider / model
  → tools / skills
  → fallback policy
  → verification policy
```

The WebUI should eventually make this resolved path visible for every delegated run.

## Conceptual configuration

The syntax below is illustrative only; it is **not** the final DeepHelm schema.

```yaml
models:
  reasoning-high:
    provider: deepseek
    model: deepseek-v4-pro
    reasoning: high

  fast-worker:
    provider: deepseek
    model: deepseek-v4-flash

agents:
  planner:
    model: reasoning-high

  executor:
    model: fast-worker

  reviewer:
    model: reasoning-high

categories:
  quick: executor
  deep: planner
  review: reviewer
```

A representative workflow could then express a policy such as:

```text
Planner (strong reasoning)
        ↓
parallel Executors (fast models)
        ↓
Reviewer (independent verification)
```

without forcing the workflow engine itself to own provider-specific configuration.

## Initial roadmap

### v0.1 — DSH-native control plane

- [ ] Define `AgentSpec`, `ModelProfile`, `CategorySpec`, and routing policy primitives.
- [ ] Build a deterministic policy-resolution engine with traceable decisions.
- [ ] Expose DeepHelm through a native DSH/Cordis integration surface.
- [ ] Spawn genuinely heterogeneous DSH subagents from resolved policy.
- [ ] Add a WebUI agent × model configuration view.
- [ ] Add a runtime resolution inspector.
- [ ] Ship one end-to-end planner → workers → reviewer preset.
- [ ] Explore import of existing orchestration configuration without coupling DeepHelm to another harness runtime.

### Later

- [ ] Fallback, budget, concurrency, and verification policies.
- [ ] Policy composition and reusable profiles.
- [ ] Integration with existing DSH workflow/team plugins instead of reimplementing their runtimes.
- [ ] Evaluate additional harness adapters only after the DSH abstraction proves stable.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the current design boundary.

## Design principles

1. **DSH first.** Solve a real DeepSeek Harness problem before designing a universal abstraction.
2. **Policy, not another runtime.** Reuse DSH's execution primitives instead of rebuilding them.
3. **Observable by default.** Every routing decision should be explainable from the resolved policy path.
4. **Heterogeneous by design.** Different roles may use different providers, models, reasoning levels, tools, and fallbacks.
5. **Composable with the ecosystem.** DeepHelm should be useful to other DSH plugins rather than swallowing them.
6. **Clean implementation boundaries.** Ideas and configuration formats may be studied across the agent ecosystem, but third-party code is only reused when its license permits it and attribution requirements are satisfied.

## Contributing

DeepHelm is early enough that architecture discussions are especially valuable. If you want to help define agent policy, DSH integration boundaries, model routing, WebUI observability, or compatibility strategy, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Non-affiliation

DeepHelm is an independent open-source project. It is not an official DeepSeek product and is not affiliated with, endorsed by, or maintained by DeepSeek.

DeepSeek, DeepSeek Harness, and other referenced project names belong to their respective owners.

## License

DeepHelm is licensed under the [Apache License 2.0](LICENSE).

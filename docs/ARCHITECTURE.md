# DeepHelm Architecture

This document records the intended architectural boundary for DeepHelm while the project is still pre-alpha. It is a design target, not an API guarantee.

## What DeepHelm owns

DeepHelm should own policy and policy resolution:

- agent role definitions;
- model/provider profiles;
- category and capability routing;
- prompt/tool/skill policy;
- fallback, verification, budget, and concurrency policy;
- resolution traces that explain the effective runtime configuration;
- a visual control plane for editing and inspecting those policies.

## What DeepHelm should not own

DeepHelm should not become a second DeepSeek Harness runtime. In particular, it should avoid reimplementing execution primitives already provided by DSH or mature ecosystem plugins, including session lifecycle, generic subagent execution, workflow persistence, provider transports, or terminal/runtime infrastructure.

The default question should be: **can DeepHelm configure or compose this capability instead of replacing it?**

## DSH-first architecture

```text
User / WebUI
    │
    ▼
DeepHelm Policy Model
    │
    ▼
Deterministic Resolver ───────► Resolution Trace
    │
    ▼
DSH Adapter / Cordis Service
    │
    ├──► subagents
    ├──► presets
    ├──► workflows
    └──► compatible DSH plugins
```

The first implementation should target public DSH capability seams directly. A harness-neutral core is useful only where the abstraction survives contact with a real DSH implementation.

## Core domain model

The exact TypeScript schema is not final. The initial model should be small enough to reason about and strict enough to resolve deterministically.

```ts
interface ModelProfile {
  id: string
  provider?: string
  model?: string
  reasoning?: string
  fallbacks?: string[]
}

interface AgentSpec {
  id: string
  role?: string
  modelProfile?: string
  persona?: string
  promptAppend?: string[]
  tools?: {
    allow?: string[]
    deny?: string[]
  }
  skills?: string[]
}

interface CategorySpec {
  id: string
  agent?: string
  modelProfile?: string
}
```

Future policy types may cover verification, retry, budget, depth, concurrency, and workflow composition. They should not be added before their resolution semantics are clear.

## Resolution requirements

Policy resolution should be:

1. **Deterministic** — the same inputs and policy snapshot produce the same resolved configuration.
2. **Traceable** — every override has a visible source.
3. **Layered** — defaults, profiles, categories, agents, and request-level overrides have an explicit precedence order.
4. **Validatable** — unknown providers/models/skills and contradictory policies should fail early or produce explicit warnings.
5. **Serializable** — the resolved policy can be inspected, logged, tested, and reproduced.

A resolution trace should eventually look like:

```text
review-task
  category = review                 [request classifier]
  agent = reviewer                  [category:review]
  modelProfile = reasoning-high     [agent:reviewer]
  provider = deepseek               [profile:reasoning-high]
  model = deepseek-v4-pro           [profile:reasoning-high]
  verification = independent        [agent:reviewer]
```

## Integration contract

The DSH integration should expose a stable DeepHelm-facing service rather than requiring every consumer to understand internal storage or UI state.

Conceptually:

```ts
interface AgentPolicyService {
  resolve(request: ResolveRequest): Promise<ResolvedAgentPolicy>
  explain(request: ResolveRequest): Promise<ResolutionTrace>
  listAgents(): Promise<AgentSpec[]>
  listModelProfiles(): Promise<ModelProfile[]>
}
```

The concrete Cordis service name and API will be chosen after validating DSH conventions in code.

## Web control plane

The first useful UI should prioritize configuration clarity over visual complexity.

A minimal agent × model matrix:

```text
Role        Provider      Model            Reasoning   Fallback
planner     DeepSeek      V4 Pro           high        ...
executor    DeepSeek      V4 Flash         normal      ...
reviewer    DeepSeek      V4 Pro           high        ...
```

The more important feature is the **resolved configuration inspector**. Users should be able to select a delegated run and see which category, agent, profile, provider, tools, and policies produced it.

## Compatibility strategy

DeepHelm should prefer adapters and importers over source-level coupling to other harness projects.

For external configuration ecosystems:

1. parse the source configuration;
2. convert supported concepts into the DeepHelm policy model;
3. show unsupported or lossy mappings explicitly;
4. never silently change execution semantics;
5. respect the upstream project's license for any reused code or assets.

## v0.1 acceptance criteria

v0.1 should not mean feature parity with any other agent framework. It should mean that the architecture is real.

A v0.1 candidate should be able to:

- define at least three roles with different model profiles;
- resolve a task category into a concrete DSH subagent configuration;
- run a planner → workers → reviewer flow using genuinely heterogeneous model assignments;
- show the effective routing decision in the WebUI;
- reproduce the same decision from the same policy snapshot;
- do all of the above without patching DSH core.

## Open design questions

These decisions are intentionally not frozen yet:

- JSON/JSONC/YAML vs DSH-native configuration representation;
- monorepo/package boundaries;
- exact Cordis service API;
- whether routing classification belongs in core or a plugin;
- how model capability metadata is discovered;
- interoperability contracts with workflow/team plugins;
- how much of the WebUI should be DSH-native versus reusable.

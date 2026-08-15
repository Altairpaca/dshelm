# DSHelm Architecture

This document records the intended architectural boundary for DSHelm while the
project is still pre-alpha. It is a design target, not an API guarantee.

## What DSHelm is

DSHelm is the **batteries-included agent layer for DeepSeek Harness (DSH)** —
an OmO-inspired, DSH-native, ecosystem-composable agent distribution.

- DSHelm is NOT a DSH fork.
- DSHelm is NOT another agent loop.
- DSHelm is NOT another AgentTeams.
- DSHelm is NOT a 700-plugin collection.

It is an integrated distribution: a deterministic policy/routing kernel plus a
user-facing product surface (agents, roles, model profiles, skills, teams and
workflow integration, observability, Web control surfaces, conversation
interop) whose execution is composed from DSH-native primitives and mature
ecosystem capabilities wherever they exist.

## Layering

```text
                 DSHelm
        batteries-included agent layer
                    |
          +---------+----------+
          |                    |
     DSHelm Core          Integrated UX
 policy/config/trace      web/agents/skills
          |
     Execution Adapters
          |
  +-------+--------+---------+
  |                |         |
DSH Native     AgentTeams   Workflow/...
  |
DeepSeek Harness
```

## What DSHelm Core owns

DSHelm Core owns policy and policy resolution only:

- agent role definitions;
- model/provider profiles (ordered candidates, fallback);
- category and capability routing;
- tool/persona/depth/skills policy (skills are metadata-only in v0.1);
- verification policy (bounded revision);
- reasoning-effort policy as opaque adapter-owned identifiers;
- runtime capability validation (exact-model seams, NOT catalog membership);
- resolution traces that explain the effective runtime configuration;
- configuration precedence: defaults → user → project → request → runtime
  validation (`.dshelm/config.jsonc` + `.dshelm/local/` gitignored).

Core imports no DSH package and no AgentTeams.

## What DSHelm should not own

DSHelm should not become a second DeepSeek Harness runtime. In particular, it
must not reimplement execution primitives already provided by DSH or mature
ecosystem plugins:

- session lifecycle;
- generic subagent execution (in-process driver, spawn/fork providers);
- provider transport and adapter registration;
- durable team mailbox / team state (dsh-agent-teams owns this; DSHelm
  provides policy → AgentTeams adapter direction, not a second runtime);
- workflow persistence (workflow plugins own this);
- generic fallback runtime (fallback/router plugins own this);
- terminal/runtime infrastructure;
- DSH Web shell (DSHelm composes into it via official slots).

The default question is: **can DSHelm configure or compose this capability
instead of replacing it?**

## Execution adapters

v0.1 ships the **DSH Native** adapter: resolved policy maps onto official seams
(`AgentRegistry.create` + `installModelSelection`, `SubagentStartRequest`
fields, in-process driver, session projection). Future backends (agent-teams,
workflow) plug in behind a thin adapter contract; `packages/core` never
depends on any backend.

## DSH-native integration surface (v0.1, implemented)

- `dshelm.policy` — real Cordis host service (resolve / explain / snapshot /
  recordDelegation) provided by the DSHelm bundle itself; fiber-owned
  lifecycle; duplicate registration fails loud.
- `dshelm` subagent provider — maps resolved policy onto
  `SubagentStartRequest` (persona, toolFilter, maxDepth, agentOptions);
  delegates to the official in-process driver; unsupported capabilities fail
  loud via `UNSUPPORTED_CAPABILITY`.
- Model selection — official `installModelSelection` composition so
  provider/model/reasoningEffort reach the request config, get validated by
  `prepareCall`, are logged as `request/header`, and reach the adapter as
  `GenerateOptions`.
- Exact-model validation — `ctx.llm.resolveModelInfo`; `listModels` is
  advisory catalog metadata and never a routing gate.
- Host→client transport — whole-value `dshelm/control-plane` session events
  folded by `dshelm.controlPlane` session projection into official
  `session/projection` wire frames; client consumes via `useProjection`
  (RPC surface is fixed; no plugin RPC extension point exists).
- Client UI — DSH-native slot registration (SessionProjection-derived);
  renderer smoke (`qa:web-renderer`) is explicitly separated from real DSH
  Web QA (`qa:dsh-web`).

## Configuration precedence

Policy layers are JSON/JSONC and merge from lowest to highest precedence:

```text
defaults -> user -> project -> request -> runtime capability validation
```

- `.dshelm/config.jsonc` is the committed project layer.
- `.dshelm/local/` is gitignored runtime-local state.
- The user layer comes from `ctx.settings` (official settings namespace)
  when a settings provider is composed.
- Malformed JSONC, unknown keys, ID mismatches, dangling references, empty
  candidate lists, protected keys, and non-JSON values produce
  machine-readable `ConfigResolutionError` diagnostics. The merged document
  is deep-frozen and plain-JSON round-trip validated before use.

## Core domain model (v0.1)

```ts
interface ModelProfile {
  id: string
  candidates: ModelCandidate[]   // ordered; first selectable wins
  reasoning?: string             // opaque adapter-owned effort id
}

interface ModelCandidate {
  provider: string
  model: string
  reasoning?: string
}

interface AgentSpec {
  id: string
  role: string
  profile: string                // profile id reference
  persona?: string               // SubagentStartRequest.persona
  maxDepth?: number              // SubagentStartRequest.maxDepth
  tools?: { allow?: string[]; deny?: string[] }  // toolFilter
  skills?: string[]              // METADATA-ONLY in v0.1
  verification?: { required: boolean; maxIterations?: number }
}

interface CategorySpec {
  id: string
  agent: string                 // agent id reference
}
```

`inherits` was REMOVED in v0.1 (no real use case; alias chasing made child
fields silently vanish). Categories have no inheritance.

## Resolution requirements

Policy resolution must be:

1. **Deterministic** — the same inputs and policy snapshot produce the same
   resolved configuration and the same serialized trace.
2. **Traceable** — every candidate evaluation and field override has a visible
   source; the Resolution Inspector consumes the canonical trace structure.
3. **Layered** — defaults, user, project, categories, agents, and request-level
   overrides have an explicit precedence order.
4. **Validatable** — runtime capability answers (exact model, reasoning
   support) gate selection; unknown providers/models/efforts fail loud.
5. **Serializable** — the resolved policy and trace can be inspected, logged,
   tested, and reproduced.

## Web control plane

The first useful UI prioritizes configuration clarity over visual complexity:

- a Roles × Models matrix;
- a **Resolution Inspector** showing category, agent, profile, provider,
  model, reasoning, candidate rejections, tools, persona, depth,
  verification, and provenance — all rendered from the canonical host/core
  trace, never from a second UI-only explanation model.

## Compatibility strategy

DSHelm prefers adapters and importers over source-level coupling to other
harness projects. OmO is a behavioral/product/UX reference; its source is
never copied. For external configuration ecosystems (future):

1. parse the source configuration;
2. convert supported concepts into the DSHelm policy model;
3. show unsupported or lossy mappings explicitly;
4. never silently change execution semantics;
5. respect the upstream project's license for any reused code or assets.

Conversation import (INDEX / ARCHIVE / CONTINUE) is designed in the
conversation-import ADR; no importer ships in v0.1.

## v0.1 acceptance criteria

v0.1 does not mean feature parity with any other agent framework. It means the
architecture is real:

- at least three roles with different model profiles resolve deterministically;
- exact-model validation goes through the runtime seam (not catalog
  membership), and dynamic unlisted-but-valid models resolve;
- resolved provider/model/reasoningEffort appear in the actual DSH request
  config (`request/header` == ResolutionTrace), proven by a keyless test
  with a real agent loop and test adapter;
- a planner → workers → reviewer slice runs with real data flow
  (PlanArtifact → WorkerResults → structured verdict → bounded revision);
- the effective routing decision is visible in the WebUI from the canonical
  trace;
- the same decision reproduces from the same policy snapshot;
- all of the above without patching DSH core.

## Reference evidence

The DSH seam evidence table lives in
`docs/decisions/v0.1-alpha-hardening.md` §3 (pinned checkout
`47f943859bef60e4160492346772ded9b24f765a`, installed CLI `0.1.0-rc.6`).

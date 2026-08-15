# DSHelm

**The batteries-included agent layer for DeepSeek Harness.**

> OmO-inspired. DSH-native. Ecosystem-composable.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#project-status)

DSHelm is an open-source, batteries-included **agent distribution** for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

DSHelm Core provides the deterministic policy and routing kernel. Execution is
**composed** from DSH-native primitives and mature ecosystem capabilities
wherever possible — DSHelm does not fork DSH, does not reimplement the agent
loop, and does not duplicate durable team/workflow runtimes.

What DSHelm gives you is a single place to define and inspect:

- agent roles and responsibilities;
- model/provider profiles, fallback candidates, and reasoning policy;
- task categories and routing rules;
- tool, persona, depth, and skills policy;
- verification (bounded revision) and orchestration semantics;
- team/workflow integration (composed, not reimplemented);
- long-running task UX and observability;
- the **Resolution Trace** — the final configuration actually resolved at
  runtime, rendered by the Web control plane.

## What DSHelm is NOT

- NOT a DeepSeek Harness fork.
- NOT another agent loop.
- NOT another AgentTeams (teams are composed through the ecosystem).
- NOT a 700-plugin collection.

It is an integrated distribution / agent layer: policy, configuration,
routing, provenance, and user surfaces — on top of the DSH execution plane.

## Where DSHelm sits in the ecosystem

| Project | Role |
|---|---|
| DeepSeek Harness | runtime / kernel / plugin substrate |
| AgentTeams | durable team execution (captain/members/mailbox/task DAG) |
| Oh-My-DSH | community capability library and catalog |
| Sisyphus presets | workflow/persona port of OmO's Sisyphus loop |
| OmO | behavioral/product reference (not a DSH project) |
| **DSHelm** | **verified integrated agent distribution for DSH** |

DSHelm does not compete on raw feature count. Its job is composition,
compatibility, verification, observability, migration, and opinionated
defaults: install DSHelm and a bare DSH becomes a complete, configurable,
observable, heterogeneous-model, multi-agent coding environment.

## Project status

> [!WARNING]
> DSHelm is in **pre-alpha** (v0.1-alpha hardening in progress). There is no
> stable configuration schema or public API yet.

### v0.1-alpha hardening status

What is **proven** (hermetic tests + typecheck + build + real boot):

- `@dshelm/core`: runtime-validated policy documents (nested schema,
  prototype-pollution guard on config AND resolver inputs, key/id
  consistency, reference validation, non-empty candidates, unknown-field
  rejection, non-JSON value rejection, plain-JSON round-trip, deep-freeze),
  deterministic resolver with per-candidate structured evaluation,
  aggregated candidate traces that carry the error, opaque reasoning
  strings, canonical deterministic serialization, property/fuzz coverage,
  performance baseline (`pnpm bench`).
- `@dshelm/dsh`: real `dshelm.policy` Cordis host service provided by the
  bundle itself (resolve/explain/snapshot; inject-declared; fiber
  lifecycle; duplicate registration fails loud), DSH runtime capability
  adapter (`resolveModelInfo`-based exact-model validation; `listModels`
  advisory only; unlisted-but-valid models resolve), session-projection
  transport (`dshelm/control-plane` events folded by a real
  SessionProjectionRegistry), subagent provider mapping onto official
  `SubagentStartRequest` seams, model-selection composition onto official
  `installModelSelection`, config precedence (`.dshelm/config.jsonc`
  project layer; settings user layer with official fallback;
  `.dshelm/local/` gitignored).
- **Keyless real-execution contract**: DSHelm ResolutionTrace == actual DSH
  `request/header` == adapter `GenerateOptions` (provider/model/
  reasoningEffort), proven through a real agent loop with a scripted
  rc.6 adapter.
- **Reference vertical slice**: goal → planner PlanArtifact → bounded
  parallel workers → WorkerResults → structured reviewer verdict, with
  bounded revision and real roles × models snapshots.
- **Distribution**: `pnpm pack` + fresh npm install of both tarballs (all
  exports exist), fresh DSH_HOME profile composition (`qa:dsh-host`: dump
  config shows the `dshelm` bundle row; the profile boots past the loader
  with the real bundle).
- CI lanes: core-unit, core-property, typecheck, build, dsh-contract,
  pack-install (+ informational upstream lane).

What is **blocked / deferred** (recorded, not claimed):

- DSH Web client: round-3 blocker RESOLVED —
  `@deepseek-ai/dsh-client-runtime@0.1.0-rc.6` is published and has no
  `dsh-compact` dependency (the 0.0.1-rc.1 line was the stale latest tag).
  A real client bundle now builds (tsdown, `__ModuleLoader__` closure,
  projection-fed control-plane panel); live browser rendering still needs a
  real Web shell session (`qa:dsh-web` reserved for that). `qa:web-renderer`
  remains the standalone renderer smoke; `qa:dsh-host` verifies the packed
  host lane + client bundle shape.
- Credentialed E2E: no DeepSeek credential in this environment (external
  blocker; keyless acceptance does not depend on it).
- npm `@dshelm` scope publish: requires registry credentials (checked as a
  pre-publish gate, not a v0.1-alpha acceptance blocker).

The master acceptance checklist lives in
`docs/decisions/v0.1-alpha-hardening.md`. Nothing in this README claims
"verified production behavior" beyond what those tests prove.

## Layout

```text
packages/core   policy kernel: contracts, JSONC loading, validation, resolver, traces
packages/dsh    DSH adapter: host service, capability adapter, projection, provider, slice
docs/decisions  master contract + ADRs (rename, conversation import, ...)
patches/        DEV-ENVIRONMENT-ONLY DSH workarounds (never a DSHelm runtime dependency)
```

## Development

Requires Node `>=22.19`, pnpm `11.7.0`.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

- `qa:web-renderer` — standalone renderer smoke (DOM + responsive, fake
  snapshot). Proves nothing about DSH integration.
- `qa:web-renderer` — standalone renderer smoke (DOM + responsive, fake
  snapshot). Proves nothing about DSH integration.
- `qa:dsh-host` — real DSH host/profile lane: fresh DSH_HOME, scratch
  profile, packed `@dshelm/dsh` bundle, `--dump-config` composition,
  client manifest, loader boot (fail loud).
- `qa:dsh-web` — reserved for future real-browser (Playwright) DSH Web
  integration: slot rendering, `useProjection`, reload/dispose.

## Configuration

Project policy lives in `.dshelm/config.jsonc` (committable). Runtime-local
state lives in `.dshelm/local/` (gitignored). Precedence:
`defaults → user → project → request → runtime validation`.

Example:

```jsonc
// .dshelm/config.jsonc
{
  "profiles": {
    "reasoning-high": {
      "id": "reasoning-high",
      "reasoning": "high",
      "candidates": [{ "provider": "deepseek", "model": "deepseek-v4-pro" }]
    },
    "fast-worker": {
      "id": "fast-worker",
      "candidates": [{ "provider": "deepseek", "model": "deepseek-v4-flash" }]
    }
  },
  "agents": {
    "planner": { "id": "planner", "role": "planner", "profile": "reasoning-high" },
    "executor": { "id": "executor", "role": "worker", "profile": "fast-worker" },
    "reviewer": { "id": "reviewer", "role": "reviewer", "profile": "reasoning-high" }
  },
  "categories": {
    "deep": { "id": "deep", "agent": "planner" },
    "quick": { "id": "quick", "agent": "executor" },
    "review": { "id": "review", "agent": "reviewer" }
  }
}
```

## Roadmap

### v0.1 — Core + DSH integration baseline (in main)

- [x] Runtime policy schema validation + prototype-pollution guard
- [x] Opaque reasoning contract (no invented vocabulary)
- [x] Per-candidate evaluation + aggregated traces (inspector-ready)
- [x] `inherits` removed with explicit error
- [x] Real `dshelm.policy` Cordis host service (bundle-provided)
- [x] `.dshelm/config.jsonc` precedence (defaults → user → project → request)
- [x] Reasoning into the real DSH request config — `request/header` and
  adapter `GenerateOptions` == ResolutionTrace (keyless contract test)
- [x] Real vertical slice dataflow (planner → workers → reviewer, bounded
  revision) — keyless proof against a real agent loop
- [x] Hermetic CI (core-unit, core-property, typecheck, build, dsh-contract,
  pack-install) + pack/install + fresh DSH profile composition (`qa:dsh-host`)
- [~] Real DSH Web slot rendering: client bundle built (projection-fed panel,
  `__ModuleLoader__` registration); live browser verification pending a real
  Web shell session

### v0.2 — Verified Distribution

- [ ] `dshelm doctor` (DSH/Cordis/DSHelm versions, installed capabilities,
  provider/model/reasoning support, known blockers)
- [ ] AgentTeams adapter (ExecutionBackend contract; policy → durable team
  execution)
- [ ] OmO migration alpha (`dshelm migrate omo`, dry-run, SUPPORTED/MAPPED/
  LOSSY/UNSUPPORTED report)
- [ ] Resolution Trace extended through the execution backend
- [ ] Verified Stack: combinations of DSH native + AgentTeams + memory +
  search/research + Sisyphus behavior, each labeled VERIFIED/PARTIAL/
  EXPERIMENTAL/BROKEN with evidence

### v0.3 — Integrated Web control plane

- [ ] Teams/tasks/sessions/routing visible and steerable from the Web UI

### v0.4 — Compatibility + presets + ecosystem distribution

- [ ] Skills execution via DSH presets (currently metadata-only)
- [ ] Conversation import (INDEX / ARCHIVE / CONTINUE)
- [ ] Fallback/budget/concurrency policies with real backends

## Design principles

1. **DSH first.** Solve a real DeepSeek Harness problem before designing a
   universal abstraction.
2. **Compose, don't rebuild.** Reuse DSH's execution primitives and mature
   ecosystem plugins; implement only real gaps.
3. **Observable by default.** Every routing decision is explainable from the
   canonical Resolution Trace.
4. **Heterogeneous by design.** Different roles may use different providers,
   models, reasoning efforts, tools, and fallbacks — with request/header
   evidence required before claiming success.
5. **OmO-inspired, not OmO-copied.** Behavioral/product/UX reference only;
   no source port.
6. **Clean implementation boundaries.** Third-party code is reused only when
   its license permits it and attribution requirements are satisfied.

## Contributing

DSHelm is early enough that architecture discussions are especially valuable.
See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md);
the master acceptance contract is
[`docs/decisions/v0.1-alpha-hardening.md`](docs/decisions/v0.1-alpha-hardening.md).

## Non-affiliation

DSHelm is an independent open-source project. It is not an official DeepSeek
product and is not affiliated with, endorsed by, or maintained by DeepSeek.

DeepSeek, DeepSeek Harness, and other referenced project names belong to their
respective owners.

## License

DSHelm is licensed under the [Apache License 2.0](LICENSE).
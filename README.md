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

## Project status

> [!WARNING]
> DSHelm is in **pre-alpha** (v0.1-alpha hardening in progress). There is no
> stable configuration schema or public API yet.

### Current bootstrap / implementation-in-progress

What is **proven** (hermetic tests + typecheck + build):

- `@dshelm/core`: runtime-validated policy documents (nested schema,
  prototype-pollution guard, key/id consistency, reference validation,
  non-empty candidates, unknown-field rejection, plain-JSON round-trip,
  deep-freeze), deterministic resolver with per-candidate structured
  evaluation, opaque reasoning strings, aggregated candidate traces,
  canonical deterministic serialization, property/fuzz coverage.
- `@dshelm/dsh`: real `dshelm.policy` Cordis host service
  (resolve/explain/snapshot), DSH runtime capability adapter
  (`resolveModelInfo`-based exact-model validation; `listModels` advisory
  only), session-projection transport (`dshelm/control-plane` events),
  subagent provider mapping onto official `SubagentStartRequest` seams,
  model-selection composition onto official `installModelSelection`,
  config precedence (`.dshelm/config.jsonc` project layer; settings user
  layer; `.dshelm/local/` gitignored).

What is **planned / in progress** (NOT yet claimed as verified):

- real DSH Web slot integration and `qa:dsh-web` (renderer smoke
  `qa:web-renderer` is explicitly NOT a DSH integration proof);
- keyless request/header == ResolutionTrace proof through a real agent loop;
- planner → workers → reviewer slice with real data flow and bounded
  revision;
- pack + fresh-install + fresh DSH profile composition;
- CI lanes and performance baselines.

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
- `qa:dsh-web` — real DSH Web QA: fresh DSH_HOME, scratch profile, real
  `@dshelm/dsh` bundle, native slot registration, host→client projection,
  reload/dispose.

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

### v0.1-alpha — hardening (current)

- [x] Runtime policy schema validation + prototype-pollution guard
- [x] Opaque reasoning contract (no invented vocabulary)
- [x] Per-candidate evaluation + aggregated traces
- [x] `inherits` removed with explicit error
- [x] Real `dshelm.policy` Cordis host service (bundle-provided)
- [x] `.dshelm/config.jsonc` precedence
- [ ] Reasoning into real DSH request config (`request/header` proof)
- [ ] Real DSH Web slot + `qa:dsh-web`
- [ ] Real vertical slice (planner → workers → reviewer dataflow)
- [ ] Hermetic CI + pack/install + fresh profile composition

### Later

- [ ] Fallback, budget, concurrency policies with real backends
- [ ] AgentTeams adapter/backend for team orchestration (policy → backend)
- [ ] Skills execution via DSH presets (currently metadata-only)
- [ ] Conversation import (INDEX / ARCHIVE / CONTINUE)
- [ ] `dshelm migrate omo` (behavioral migration, not source port)

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

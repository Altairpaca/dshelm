# DeepSeek Harness 0.1.2-rc.1 compatibility audit

Status: **source target — not yet promoted to the verified install baseline**

Upstream release: [`dsh-v0.1.2-rc.1`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-rc.1)  
Source commit: `a66e4702047846cdaa10c66c9d3df3951f5ea70d`  
Release date: 2026-09-03

DSHelm's currently verified npm/install baseline remains `0.1.0-rc.7`. This document records the source-level audit used to prepare the next promotion. A source audit is evidence about API shape; it is not a substitute for a fresh npm install, profile composition, boot, Web-client load, and execution journey.

## Promotion rule

A DSH release becomes DSHelm's `tested.dshPackages` baseline only when all of the following hold together:

- the required DSH npm packages exist at the exact candidate version;
- DSHelm manifests and `pnpm-lock.yaml` are regenerated coherently;
- workspace typecheck/build/tests pass against the candidate package graph;
- packed DSHelm packages install into a fresh project;
- an isolated `HOME` / `DSH_HOME` profile composes and boots;
- the `@dshelm/dsh` browser bundle is discovered and materialized by the candidate client-module graph;
- `doctor`, `explain`, first-run routing, real-DSH execution fixture, and uninstall remain valid;
- Web/client bundle seams used by `@dshelm/dsh` are available at the same candidate line.

Do not promote only the version strings.

## Audited seams

| Seam | 0.1.0-rc.7 baseline | 0.1.2-rc.1 source | DSHelm action | State |
| --- | --- | --- | --- | --- |
| Session log reads | `session.events` immutable snapshot getter | `seq`, `eventAt()`, `snapshotEvents()`; direct `events` removed | `snapshotSessionLog()` prefers `snapshotEvents()` and falls back to `events` | bridged |
| Subagent capability gate | no `agentOptions` flag | `SubagentCapabilities.agentOptions` required | advertise `agentOptions: true` structurally at runtime | bridged |
| Agent model options | provider/model/maxTokens | provider/model/`reasoningEffort`/maxTokens | map DSHelm reasoning into AgentOptions on current hosts | bridged |
| Legacy reasoning transport | `request/header` seed restores reasoning | current AgentOptions can carry reasoning directly | retain seed as legacy fallback while direct option is present | bridged |
| Subagent selection | provider-specific start behavior | caller-authorized provider/model/reasoning/max-output selection is first-class | continue resolving policy first, then map the resolved route onto the official seam | audited; max-output policy deferred |
| Browser client boot | `@deepseek-ai/dsh-client-runtime` supplied the browser runtime/types used by DSHelm | old `packages/client/runtime` is absent; `@deepseek-ai/dsh-client-modules@0.1.2-rc.1` owns `dsh.client` scanning, boot graph and plugin bundle delivery | remove browser-source type dependency on `dsh-client-runtime/client`; keep manifest migration for the exact package+lockfile promotion | source bridged; package graph blocked |
| Client session projection | DSHelm typed `ClientContext['sessions']` through the legacy runtime package | current official plugins use package-owned client extensions around `sessions.binding(id).session.projections.faceOf(...)` | type only the minimal structural sessions/projection face DSHelm actually consumes | bridged |
| Client plugin declaration | legacy package metadata injects runtime/UI packages | current module system scans package `dsh.client`, serves `./client`, and resolves client dependencies from the composed graph | retain verified metadata until candidate graph is available; migrate dependency/inject set with lockfile | pending promotion |
| Session persistence | external persistence plugins available | optional SQLite Session persistence backend removed | DSHelm owns no Session persistence backend | no direct impact |
| Profile execution | DSH profiles already used | product entry modes converge on DSH profiles | DSHelm profile/bundle architecture aligns with upstream direction | aligned |
| Remote API | legacy APIProxy still existed in earlier trains | old APIProxy removed after RPC unification | DSHelm does not depend on APIProxy | no direct impact |
| Provider login UI | no plugin model-settings login extension in baseline | plugins can add provider sign-in controls to Models settings | candidate future integration for DSHelm auth discovery; no support claim yet | opportunity |
| Continuable subagents | existing continuation seam | parent/continuable child can exchange later `send_message` traffic | current DSHelm reference slice remains bounded one-shot; evaluate separately | deferred |

## Code changes in this compatibility pass

### Session log bridge

`packages/dsh/src/session-log-compat.ts` uses a structural compatibility face rather than importing one generation-specific Session shape:

```text
0.1.2 host  → snapshotEvents() → stable event snapshot
legacy host → events           → stable event snapshot
unknown API → fail loud
```

`runRoleAgent()` now consumes this bridge when finding the final assistant message.

### Subagent model-option bridge

The DSHelm subagent provider now exposes an `agentOptions` capability at runtime. When policy resolves a reasoning effort, the mapped AgentOptions object includes `reasoningEffort` for current hosts. The `request/header` seed remains in place for the verified legacy line.

This is intentionally redundant during the transition: both paths carry the same resolved route, which prevents a compatibility window from silently dropping reasoning configuration.

### Browser client source bridge

The previous browser entry imported `ClientContext` and `SessionId` from `@deepseek-ai/dsh-client-runtime/client`. The 0.1.2 source tree no longer contains the old client-runtime package; the new `@deepseek-ai/dsh-client-modules` package owns web plugin discovery, the `__DSH_BOOT__` graph, `/plugins` bundle delivery, and lazy module materialization.

DSHelm's control-plane client does not need that removed package to express its own behavior. It now defines the narrow face it consumes:

```text
sessions.list.current
sessions.binding(sessionId)
  → session.projections.faceOf('dshelm.controlPlane')
  → getSnapshot() / subscribe()
```

The refactor also owns and disposes the projection subscription when the current session changes; the previous implementation subscribed to each projection without retaining its cleanup.

This is only the **source** half of the migration. `packages/dsh/package.json` still depends on and injects the legacy `@deepseek-ai/dsh-client-runtime@0.1.0-rc.7`, because changing that package graph without regenerating `pnpm-lock.yaml` would invalidate the verified install baseline. The manifest must move to the 0.1.2 client-module/API composition in the exact-version promotion PR.

## Known promotion blocker: client package graph

The source audit confirms the client architecture changed materially, not just by version number:

```text
0.1.0-rc.7
  @deepseek-ai/dsh-client-runtime
            ↓
0.1.2-rc.1
  @deepseek-ai/dsh-client-modules
  + package-owned API / UI client extensions
```

Official 0.1.2 plugins still use `dsh.client.inject` for service/plugin composition, while `@deepseek-ai/dsh-client-modules` owns discovery and loading. For DSHelm, the promotion must determine the minimal current inject set for the body-mounted control plane (at least the session-controller/provider of the `sessions` service) rather than mechanically replacing one package name with another.

That migration belongs with the candidate npm graph and a real Web bundle-load assertion.

## Evidence still missing before promotion

The following are intentionally **not** claimed by this source audit:

- successful installation of the entire `0.1.2-rc.1` npm dependency graph;
- absence of peer-dependency conflicts across DSH client/session/subagent packages;
- the final 0.1.2 `dsh.client.inject` set for `@dshelm/dsh`;
- successful `@dshelm/dsh` Web client discovery/materialization on the new module system;
- clean-profile boot on the new exact package set;
- external-provider authentication or live model quality;
- Linux/macOS/WSL2 parity on the new train.

These belong to the release and platform evidence gates, primarily issues [#7](https://github.com/Altairpaca/dshelm/issues/7) and [#8](https://github.com/Altairpaca/dshelm/issues/8).

## Maintainer checklist for the next DSH release

For later DSH trains, repeat the same sequence:

1. read the upstream release notes and exact source tag;
2. diff every DSH package imported or injected by `@dshelm/dsh`;
3. inspect the browser `dsh.client` graph separately from Node/runtime imports;
4. identify removed/added public seams before touching versions;
5. implement backward/forward bridges only where they preserve one semantic contract;
6. record source-target evidence separately from install evidence;
7. wait for the full npm package graph;
8. regenerate manifests/lockfile together;
9. run clean packed-install/profile/Web-client evidence;
10. only then update `tested` and README compatibility claims.

# DSHelm

DSHelm is an OmO-inspired, DSH-native distribution. It turns configured API keys,
provider-owned OAuth, product status probes, and DSH model capabilities into
evidence-backed, explainable routing resources. It is a resource discovery and
composition layer, not a second task runtime or a static role-to-model preset.

## Install

For a published release, the intended entry point is `dshelm init --yes`. The
package is not yet published to npm; the verified source checkout path is:

```bash
pnpm install --frozen-lockfile
pnpm build
node packages/cli/dist/index.js init --yes
node packages/cli/dist/index.js auth status
node packages/cli/dist/index.js doctor
```

`init` is idempotent. It writes project discovery metadata and installs the
official DSH profile at `$DSH_HOME/profiles/dshelm`; it never starts a browser
login or copies another product's credential files. Login is explicit:

```bash
dshelm auth login pi-ai/anthropic
dshelm auth login codex-native
```

The public package is `dshelm`; workspace packages remain available under `@dshelm/*` for DSH/plugin composition.

## Discovery and security

DSHelm currently probes configured host API-key references, provider-owned pi-ai
OAuth, selected version-gated product status surfaces, and DSH exact-model
capabilities. Codex and Claude descriptors are version-gated; Gemini and Qwen
shell login/logout are intentionally unsupported because their current public
auth flow is interactive. Products without a verified status surface are
reported as `unknown`, never guessed as authenticated. Generic subscription and
local-runtime discovery remain research work.

Only opaque `CredentialRef` values enter policy and traces. DSHelm-managed OAuth fallback storage is user-scoped under the platform config directory with restrictive permissions. Product-managed secrets remain with the product.

## Explainable routing

Routing is capability-driven. A task can request strong planning, cheap parallelism, long-horizon coding, independent verification, large context, local-only execution, structured output, a cost ceiling, or a harness constraint. Hard runtime requirements filter candidates first; evidence-backed model knowledge scores eligible resources; user policy remains the final override.

```bash
dshelm explain deepseek/deepseek-v4-flash
dshelm models explain anthropic/claude-sonnet-4-5
```

Explanations identify runtime, official, community, and empirical evidence. Product-managed execution is labeled when its final model or request headers cannot be observed. The baseline includes DeepSeek V4 Flash/Pro, GPT-5 mini, Claude Sonnet 4.5, local Qwen3, and gpt-oss examples. Soft scores are source-linked, confidence-weighted maintainer heuristics; the current bundle is model-global and only conditionally informative across harnesses, not a permanent role map or leaderboard.

## DSH and OmO composition

The `@dshelm/dsh` plugin provides the `dshelm.policy` host service and injects
the model knowledge snapshot into live exact-model resolution. DSH-native
composition is verified; AgentTeams integration is a deferred research/backend
verification item and is not claimed as a verified v0.3 route. OmO migration
preserves routing intent and emits `SUPPORTED`, `MAPPED`, `LOSSY`, or
`UNSUPPORTED`; credentials are never migrated.

```bash
dshelm migrate omo --config ~/.omo/omo.jsonc
```

## Verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Credentialed DeepSeek acceptance is opt-in and gated to `Asia/Shanghai 02:00–08:00` by `pnpm qa:deepseek-live`. Outside that window the lane reports `SKIPPED` without making a request.

Current package and DSH compatibility facts live in [`compatibility.json`](compatibility.json) and the bilingual v0.3 contract: [English](docs/decisions/v0.3-auth-model-orchestration.md), [简体中文](docs/decisions/v0.3-auth-model-orchestration.zh.md), [中文 README](README.zh-CN.md).

Apache License 2.0. DSHelm is independent and is not affiliated with DeepSeek or any referenced vendor.

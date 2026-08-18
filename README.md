# DSHelm

DSHelm is an OmO-inspired distribution for DeepSeek Harness (DSH). It discovers the models, subscriptions, API keys, local runtimes, and product CLIs already available on a machine, then builds an explainable execution topology from resources that are actually usable.

## Install

```bash
npx dshelm init --yes
dshelm auth status
dshelm models inspect
dshelm doctor
```

`init` is idempotent. It writes `.dshelm/profile.json` and `.dshelm/dsh-profile/package.json`, never starts a browser login, and never copies another product's credential files. Login is explicit:

```bash
dshelm auth login pi-ai/anthropic
dshelm auth login codex-native
```

The public package is `dshelm`; workspace packages remain available under `@dshelm/*` for DSH/plugin composition.

## Discovery and security

DSHelm probes host-managed API keys, provider-owned pi-ai OAuth, product-managed CLI accounts, DSH exact model resolution, reasoning efforts, runtime capabilities, and optional AgentTeams availability. Codex uses its documented top-level `login` and `logout` commands. Products without a verified status surface are reported as `unknown`, never guessed as authenticated.

Only opaque `CredentialRef` values enter policy and traces. DSHelm-managed OAuth fallback storage is user-scoped under the platform config directory with restrictive permissions. Product-managed secrets remain with the product.

## Explainable routing

Routing is capability-driven. A task can request strong planning, cheap parallelism, long-horizon coding, independent verification, large context, local-only execution, structured output, a cost ceiling, or a harness constraint. Hard runtime requirements filter candidates first; evidence-backed model knowledge scores eligible resources; user policy remains the final override.

```bash
dshelm explain deepseek/deepseek-v4-flash
dshelm models explain anthropic/claude-sonnet-4-5
```

Explanations identify runtime, official, community, and empirical evidence. Product-managed execution is labeled when its final model or request headers cannot be observed. The baseline includes DeepSeek V4 Flash/Pro, GPT-5 mini, Claude Sonnet 4.5, local Qwen3, and gpt-oss examples. Soft scores are source-linked, confidence-weighted, and harness-aware; they are not permanent roles or a leaderboard.

## DSH and OmO composition

The `@dshelm/dsh` plugin provides the `dshelm.policy` host service and injects the model knowledge snapshot into live exact-model resolution. It composes with DSH native subagents and describes AgentTeams as a durable backend when that plugin is installed. OmO migration preserves routing intent and emits `SUPPORTED`, `MAPPED`, `LOSSY`, or `UNSUPPORTED`; credentials are never migrated.

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

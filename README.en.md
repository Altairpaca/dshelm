<p align="center">
  <img src="docs/assets/banner.svg" alt="DSHelm — explainable model routing for DeepSeek Harness" width="100%">
</p>

<p align="center">English · <a href="README.md">简体中文</a></p>

<p align="center">
  <a href="https://github.com/Altairpaca/dshelm/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Altairpaca/dshelm/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-0f766e"></a>
  <a href="https://github.com/topics/dsh-plugin"><img alt="DeepSeek Harness plugin" src="https://img.shields.io/badge/DeepSeek_Harness-plugin-0891b2"></a>
  <img alt="status alpha" src="https://img.shields.io/badge/status-0.3.0--alpha-f97360">
</p>

<p align="center">
  <a href="#understand-dshelm-in-two-minutes">Overview</a> ·
  <a href="#credential-free-first-run">First run</a> ·
  <a href="#deepseek-harness-compatibility">DSH compatibility</a> ·
  <a href="#source-preview">Source install</a> ·
  <a href="#community-roadmap">Roadmap</a>
</p>

> [!IMPORTANT]
> DSHelm is a `0.3.0-alpha` **source preview**. The npm packages are not published yet and the project is not production-ready. DeepSeek Harness `0.1.2-rc.1` is currently tracked as the **source target**; it will not be promoted to the verified install baseline until the complete npm package set and clean-profile journey are proven.

<p align="center">
  <img src="docs/assets/compatibility-status.svg" alt="DSHelm compatibility status: source preview, verified DSH install baseline, and current DSH source target" width="100%">
</p>

## Understand DSHelm in two minutes

DSHelm is an **explainable multi-model routing control plane** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It does not replace DSH sessions, tools, workflows, providers, or agent execution. Before execution, it answers three questions:

1. **Which role / provider / model should handle this step?**
2. **Which runtime, authentication, context, or cost constraints eliminated alternatives?**
3. **Did the final choice come from defaults, a user/project override, or the current request?**

<p align="center">
  <img src="docs/assets/routing-flow.svg" alt="DSHelm routing flow from task requirements through hard gates, evidence, policy overrides, DSH execution and Resolution Trace" width="100%">
</p>

| DSHelm owns | DeepSeek Harness owns |
| --- | --- |
| policy, routing, capability evidence | agent lifecycle, sessions, tool execution |
| provider/model/reasoning selection | provider adapters and real model calls |
| user/project/request overrides | profile/plugin composition |
| Resolution Trace and selection explanation | host, Web, Headless, SDK execution surfaces |

**Planner, worker, and reviewer roles can use different models while every decision remains inspectable.**

### Real control plane

<p align="center">
  <img src="docs/assets/control-plane.png" alt="DSHelm Web control plane showing Roles × Models and Resolution Trace" width="94%">
</p>

## Credential-free first run

The repository keeps two deterministic fixtures separate because they prove different layers:

```bash
pnpm example:first-run
pnpm example:dsh-execution
```

| Command | What is real | What it deliberately does not prove |
| --- | --- | --- |
| `example:first-run` | DSHelm Core resolver + Resolution Trace | no DSH agent execution, no provider call |
| `example:dsh-execution` | real DSH `Context` + `AgentRegistry` + `AgentLoop`; planner → bounded workers → reviewer; actual request routes captured | synthetic LLM adapter, so no external network/OAuth/model-quality claim |

The execution fixture compares the routes received by the actual DSH adapter with the DSHelm resolutions one by one. It therefore proves that **DSHelm routing decisions reach the real DSH request path**. See [`examples/README.md`](examples/README.md) for the output contract and evidence boundary.

<details>
<summary><strong>Why keep two fixtures?</strong></summary>

Resolver and execution contracts are different failure domains. Keeping them separate makes routing regressions cheap to isolate while still providing a real DSH integration proof without requiring an API key.

</details>

## Current capabilities

| Capability | Status | Evidence today |
| --- | --- | --- |
| DSH-native profile / bundle | Alpha | isolated `dshelm` profile, `@dshelm/dsh` bundle, clean-profile journey |
| Multi-model routing | Alpha | hard gates, evidence scoring, policy overrides |
| Resolution Trace | Alpha | candidate outcomes, field provenance, selected route |
| Account/auth discovery | Alpha | API keys, provider OAuth, selected product login state; product credentials are not copied |
| Web control plane | Alpha | Roles × Models and latest routing explanation |
| planner → workers → reviewer | Alpha | deterministic real-DSH execution fixture |
| OmO migration | Preview | read-only SUPPORTED / MAPPED / LOSSY / UNSUPPORTED report |
| npm install | Release gate | unpublished; tracked in [#7](https://github.com/Altairpaca/dshelm/issues/7) |
| Cross-platform verification | Community evidence | Linux, macOS Apple Silicon, Windows 11 + WSL2 reports in progress |

## DeepSeek Harness compatibility

### Current state

DSHelm deliberately separates a verified install baseline from the newest upstream source target:

- **Verified install baseline — `0.1.0-rc.7`**: package/runtime, clean HOME, profile composition, bounded boot, doctor/explain/uninstall have been exercised.
- **Current source target — `0.1.2-rc.1`**: the latest DeepSeek Harness source release published on **September 3, 2026**. Forward-compatible bridges for confirmed API changes are now in DSHelm, while npm-package promotion and clean-profile verification remain pending.

The machine-readable status lives in [`compatibility.json`](compatibility.json). The current upstream target is [`dsh-v0.1.2-rc.1`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-rc.1).

### 0.1.2 changes already bridged

| Upstream change | DSHelm handling |
| --- | --- |
| `Session.events` replaced by `seq` / `eventAt()` / `snapshotEvents()` | session-log bridge prefers `snapshotEvents()` and falls back to legacy `events` |
| `SubagentCapabilities` adds the `agentOptions` gate | DSHelm provider advertises `agentOptions: true` at runtime while remaining compilable against the legacy type surface |
| `AgentOptions` adds `reasoningEffort` | current hosts receive the reasoning option directly; legacy hosts retain the `request/header` seed path |
| callers may specify provider/model/reasoning/max output for subagents | DSHelm maps policy resolution onto the official `agentOptions` seam; max-output policy is not claimed yet |

The package manifests are intentionally **not** force-bumped to `0.1.2-rc.1` in this step. Upstream npm publication is rolling on September 3, and the DSHelm lockfile still represents the verified legacy baseline. Promotion must happen together with complete package availability, lockfile regeneration, and a fresh install/profile boot.

<details>
<summary><strong>Why not claim generic “0.1.x support”?</strong></summary>

DSH prerelease session, subagent, client, and profile seams are still moving. DSHelm records compatibility per seam and per piece of evidence so a semver range does not imply a runtime guarantee that has not been measured. The exact release gate is documented in [`docs/RELEASING.md`](docs/RELEASING.md).

</details>

## Source preview

Requirements: Node.js `>=22.19.0`, pnpm `11.7.0`, and a DSH CLI matching the verified baseline. Check [`compatibility.json`](compatibility.json) before trying a newer DSH train.

```bash
git clone https://github.com/Altairpaca/dshelm.git
cd dshelm
corepack enable
pnpm install --frozen-lockfile
pnpm preview:init
```

`preview:init` builds the workspace and installs the source preview under `$DSH_HOME/profiles/dshelm`. It does not log into providers or copy Codex, Claude, or other product-owned credentials.

```bash
dsh --profile dshelm --dump-config
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js auth status
node packages/cli/dist/index.js explain deepseek/deepseek-v4-flash
dsh --profile dshelm
```

Uninstall preserves credentials by default:

```bash
node packages/cli/dist/index.js uninstall --yes
```

The intended post-publication entry point is `npx dshelm init --yes`; it remains documentation-only until registry artifacts and clean-install evidence exist.

## Workspace map

```text
@dshelm/core             policy schema · merge · resolver · Resolution Trace
@dshelm/model-knowledge  capability evidence · provenance · confidence
@dshelm/auth             provider/account capability discovery
@dshelm/dsh              DSH adapter · host service · subagent provider · Web client
@dshelm/compat-omo       read-only OmO migration

dshelm                   CLI · init · doctor · auth · explain · uninstall
```

[`release-packages.json`](release-packages.json) owns the publishable package graph and `pnpm qa:pack-install` owns the reusable packed-install journey. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full boundary.

## Community roadmap

| Issue | Next step |
| --- | --- |
| [#7 — npm alpha](https://github.com/Altairpaca/dshelm/issues/7) | DSH dependency promotion, registry publish, clean-HOME install/uninstall evidence |
| [#8 — platform matrix](https://github.com/Altairpaca/dshelm/issues/8) | reproducible Linux, macOS Apple Silicon, Windows 11 + WSL2 verification |
| [#9 — first-run evidence](https://github.com/Altairpaca/dshelm/issues/9) | deterministic execution fixture landed; add provider-backed evidence |
| [#10 — contributor entry points](https://github.com/Altairpaca/dshelm/issues/10) | provider/model evidence, platform verification, docs, routing examples, reproducible bugs |

DSHelm prefers upstream public contracts over parallel undocumented APIs. Relevant DeepSeek Harness discussions include [model planning/execution #3297](https://github.com/deepseek-ai/deepseek-harness/discussions/3297), [desktop host #3118](https://github.com/deepseek-ai/deepseek-harness/discussions/3118), [`dsh doctor` #1719](https://github.com/deepseek-ai/deepseek-harness/discussions/1719), and [CLI provider/fallback #3283](https://github.com/deepseek-ai/deepseek-harness/discussions/3283).

For contribution workflow, see [`CONTRIBUTING.md`](CONTRIBUTING.md); for support channels, [`SUPPORT.md`](SUPPORT.md); for participation expectations, [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Issues and pull requests are welcome in English or Simplified Chinese.

## Security and evidence boundaries

- Only opaque `CredentialRef` values enter policy and traces; product-owned secrets remain product-owned.
- Authentication state that cannot be confirmed is reported as `unknown`, never guessed as logged in.
- Soft model scores are maintainer heuristics with provenance and confidence, not a model leaderboard.
- Synthetic fixtures prove routing/execution contracts, not external-provider availability or model quality.
- DSHelm is an independent community project and is not affiliated with or endorsed by DeepSeek or any model/provider named in the repository.

Apache License 2.0.

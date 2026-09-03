# DSHelm

[简体中文](README.md)

DSHelm is an explainable multi-model routing layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps model selection, policy overrides, and routing evidence explicit while leaving sessions, tools, workflows, and execution to the DSH ecosystem.

> [!IMPORTANT]
> DSHelm is currently a `0.3.0-alpha` source preview. npm packages have not been published yet, and the project should not be treated as production-ready.

## What it provides

- **Capability-aware model routing**: apply runtime, authentication, context, and cost constraints before ranking candidates.
- **Resolution Trace**: record the selected role/model/reasoning level, override source, and candidate elimination reasons.
- **DSH-native integration**: use DSH extension surfaces instead of duplicating its session, tool, workflow, or desktop runtime.
- **Explicit user control**: project- and request-level configuration can override DSHelm recommendations.
- **Evidence-backed compatibility**: keep model and platform claims tied to reproducible runtime evidence rather than informal rankings.

## Current status — September 2026

The current `main` line contains the `0.3.0-alpha` authentication and model-orchestration work, DSH profile installation, `doctor` / `explain`, Resolution Trace, the Web control plane, and read-only OmO migration support.

The next public milestones are tracked as community issues:

| Issue | Goal |
| --- | --- |
| [#7 — npm alpha](https://github.com/Altairpaca/dshelm/issues/7) | Publish a verifiable public alpha and capture clean-HOME install/uninstall evidence |
| [#8 — platform evidence matrix](https://github.com/Altairpaca/dshelm/issues/8) | Collect reproducible Linux, macOS Apple Silicon, and Windows 11 + WSL2 installation reports |
| [#9 — first-run example](https://github.com/Altairpaca/dshelm/issues/9) | Ship a credential-light planner → workers → reviewer example with an observable trace |
| [#10 — contributor entry points](https://github.com/Altairpaca/dshelm/issues/10) | Define contribution paths for provider/model evidence, platform verification, docs, examples, and reproducible bugs |

The project remains a **source preview** until those release and verification gates are actually satisfied.

### Inspect routing before configuring a provider

A credential-free offline fixture shows how a planner, two workers, and a reviewer pass through the same resolver and emit Resolution Trace data:

```bash
pnpm example:first-run
```

This example validates the **routing and explanation contract only**. It performs no real provider, tool, or agent-task execution. See [`examples/README.md`](examples/README.md) for the expected output and scope.

## Source preview

Requirements: Node.js `>=22.19.0`, pnpm `11.7.0`, and a DSH CLI available on `PATH`. See [`compatibility.json`](compatibility.json) for the currently verified stack.

```bash
git clone https://github.com/Altairpaca/dshelm.git
cd dshelm
corepack enable
pnpm install --frozen-lockfile
pnpm preview:init
```

Then inspect the installed profile and routing state:

```bash
dsh --profile dshelm --dump-config
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js auth status
node packages/cli/dist/index.js explain deepseek/deepseek-v4-flash
dsh --profile dshelm
```

The source-preview installer does not copy Codex, Claude, or other product-owned credentials into DSHelm. Uninstall removes DSHelm-owned discovery/profile state while preserving credentials by default:

```bash
node packages/cli/dist/index.js uninstall --yes
```

The intended post-publication entry point is `npx dshelm init --yes`; it is deliberately not presented as a runnable installation command until the npm release exists.

## Architecture and community

```text
task requirements → runtime/auth hard constraints → model capability evidence → user/project/request overrides → DSH execution + Resolution Trace
```

DSHelm Core owns policy, configuration, routing, and explanation. DSH and its plugins remain responsible for task execution. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the boundary.

Compatibility work is tracked through reproducible evidence across DSH versions, providers/models, Linux, macOS, Windows 11 + WSL2, and credential/network/data-location boundaries. Public DSH interface questions should be discussed against the corresponding upstream contract rather than maintained as a parallel undocumented API.

For contribution workflow, use [`CONTRIBUTING.md`](CONTRIBUTING.md). For usage questions and channel selection, use [`SUPPORT.md`](SUPPORT.md). Community participation is covered by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Issues and pull requests are welcome in English or Simplified Chinese.

DSHelm is an independent project. It is not affiliated with or endorsed by DeepSeek or by any model/provider mentioned in the repository.

Apache License 2.0.

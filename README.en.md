# DSHelm

English documentation is being kept concise while the Chinese-first community release is prepared. See the [简体中文 README](README.md) for the current source-preview install, scope, screenshots, desktop strategy, and upstream DSH Discussion links.

DSHelm is an explainable multi-model routing layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is currently a `0.3.0-alpha` source preview; npm packages are not published yet.

```bash
git clone https://github.com/Altairpaca/dshelm.git
cd dshelm
corepack enable
pnpm install --frozen-lockfile
pnpm preview:init
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the boundary between DSHelm policy and DSH execution.

# DSHelm

DSHelm 是面向 DeepSeek Harness（DSH）的 OmO-inspired agent distribution。它会发现机器上已有的模型、订阅、API key、本地运行时和产品 CLI，再根据当前真实可用资源生成可解释的执行拓扑。

## 安装

```bash
npx dshelm init --yes
dshelm auth status
dshelm models inspect
dshelm doctor
```

`init` 可以重复执行，会写入 `.dshelm/profile.json` 和 `.dshelm/dsh-profile/package.json`，不会自动打开浏览器登录，也不会复制其他产品的 credential 文件。登录必须显式执行：

```bash
dshelm auth login pi-ai/anthropic
dshelm auth login codex-native
```

公开安装包名为 `dshelm`；工作区内仍可通过 `@dshelm/*` 使用 DSH/plugin package。

## 发现与安全

DSHelm 探测 host-managed API key、pi-ai provider-owned OAuth、产品自有 CLI 账户、DSH exact model resolution、reasoning effort、runtime capability 和可选 AgentTeams。Codex 使用已验证的顶层 `login` / `logout` 命令；没有稳定 status surface 的产品会报告 `unknown`，不会猜测已登录。

policy 和 trace 只保存不透明的 `CredentialRef`。DSHelm 自己管理的 OAuth fallback 位于用户级 platform config 目录并使用受限权限；产品自有 secret 仍由产品管理。

## 可解释路由

路由基于能力需求。任务可以要求强规划、廉价并行、长程 coding、独立验证、大上下文、本地执行、structured output、成本上限或 harness 约束。先过滤硬运行时要求，再用有证据的模型知识给候选评分，用户 policy 最后覆盖。

```bash
dshelm explain deepseek/deepseek-v4-flash
dshelm models explain anthropic/claude-sonnet-4-5
```

解释会标出 runtime、official、community、empirical evidence。无法观察产品 runtime 的最终模型或 request header 时，会明确标记为 product-managed。baseline 包含 DeepSeek V4 Flash/Pro、GPT-5 mini、Claude Sonnet 4.5、本地 Qwen3 和 gpt-oss 示例。软能力分数有来源、带置信度并考虑 harness 条件，不是永久角色或模型排行榜。

## DSH 与 OmO 组合

`@dshelm/dsh` plugin 提供 `dshelm.policy` host service，并把 model knowledge snapshot 注入 live exact-model resolution。它可以与 DSH native subagent 组合，也能在安装 AgentTeams 时描述 durable backend。OmO 迁移保留 routing intent，输出 `SUPPORTED`、`MAPPED`、`LOSSY`、`UNSUPPORTED`；credential 永远不会被迁移。

```bash
dshelm migrate omo --config ~/.omo/omo.jsonc
```

## 验证

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

带 credential 的 DeepSeek acceptance 仅在 `Asia/Shanghai 02:00–08:00` 且显式确认时运行，入口是 `pnpm qa:deepseek-live`。不在窗口内时只报告 `SKIPPED`，不会发起请求。

当前 package 和 DSH 兼容性事实见 [`compatibility.json`](compatibility.json)、[English README](README.md)、[English contract](docs/decisions/v0.3-auth-model-orchestration.md)。

Apache License 2.0。DSHelm 是独立项目，与 DeepSeek 或文中提及的模型/厂商无隶属或背书关系。

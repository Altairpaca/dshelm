# DSHelm

DSHelm 是受 OmO 启发、原生 DSH 的 distribution。它把已配置的 API key、
provider-owned OAuth、产品状态探测和 DSH 模型能力转换成有证据、可解释的路由
资源。它是资源发现与组合层，不是第二个 task runtime，也不是静态的角色到模型
preset。

## 安装

公开 release 的入口目标是 `dshelm init --yes`，但当前包尚未发布到 npm；已验证的
源码工作区路径是：

```bash
pnpm install --frozen-lockfile
pnpm build
node packages/cli/dist/index.js init --yes
node packages/cli/dist/index.js auth status
node packages/cli/dist/index.js doctor
```

`init` 可以重复执行，会写入项目发现 metadata，并在
`$DSH_HOME/profiles/dshelm` 安装官方 DSH profile；不会自动打开浏览器登录，也不
会复制其他产品的 credential 文件。登录必须显式执行：

```bash
dshelm auth login pi-ai/anthropic
dshelm auth login codex-native
```

公开安装包名为 `dshelm`；工作区内仍可通过 `@dshelm/*` 使用 DSH/plugin package。

## 发现与安全

DSHelm 当前探测已配置的 host API-key 引用、pi-ai provider-owned OAuth、少数经过版本
门控的产品状态 surface，以及 DSH exact-model capability。Codex 和 Claude descriptor
有版本门控；由于当前公开认证流程是交互式的，Gemini 和 Qwen 的 shell login/logout
明确标记为 unsupported。没有稳定 status surface 的产品会报告 `unknown`，不会猜测
已登录。通用订阅和本地 runtime discovery 仍属于 research。

policy 和 trace 只保存不透明的 `CredentialRef`。DSHelm 自己管理的 OAuth fallback 位于用户级 platform config 目录并使用受限权限；产品自有 secret 仍由产品管理。

## 可解释路由

路由基于能力需求。任务可以要求强规划、廉价并行、长程 coding、独立验证、大上下文、本地执行、structured output、成本上限或 harness 约束。先过滤硬运行时要求，再用有证据的模型知识给候选评分，用户 policy 最后覆盖。

```bash
dshelm explain deepseek/deepseek-v4-flash
dshelm models explain anthropic/claude-sonnet-4-5
```

解释会标出 runtime、official、community、empirical evidence 以及 soft claim 的
claim type、置信度和 heuristic 标记。无法观察产品 runtime 的最终模型或 request
header 时，会明确标记为 product-managed。baseline 包含 DeepSeek V4 Flash/Pro、
GPT-5 mini、Claude Sonnet 4.5、本地 Qwen3 和 gpt-oss 示例；当前 knowledge 是
model-global、harness-conditional 的有限证据，不是模型排行榜。

## DSH 与 OmO 组合

`@dshelm/dsh` plugin 提供 `dshelm.policy` host service，并把 model knowledge snapshot
注入 live exact-model resolution。DSH-native composition 已验证；AgentTeams 集成仍是
merge 后的 research/backend verification，不作为 v0.3 已验证路由。OmO 迁移保留 routing
intent，输出 `SUPPORTED`、`MAPPED`、`LOSSY`、`UNSUPPORTED`；credential 永远不会被迁移。

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

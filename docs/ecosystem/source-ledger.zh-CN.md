# 生态来源台账

该台账记录 DSHelm 使用的 DSH、pi-ai、AgentTeams、OmO、OpenCode、Qwen Code 和模型官方资料。每项引用都标注 license、commit/version、用途和证据层级。DSHelm 只实现行为兼容，不把第三方源码复制进 Apache-2.0 tree。

## 当前核验来源

| 来源 | 版本/提交 | 用途 | 处理方式 |
| --- | --- | --- | --- |
| DeepSeek Harness | `dsh-v0.1.0-rc.7` / `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca` | LLM、subagent、session、settings、projection seams | 已发布依赖与只读参考 |
| pi-ai | `0.82.1` / `b4f293684bba718d59cc1157679bcf6157b3a7f5` | provider catalog、CredentialStore、OAuth login/checkAuth/logout | 复用公开 library seam |
| DSH AgentTeams | `2b1141248f34ee28870d2e39462c0dbefaa5ffdb` | durable team/task/mailbox 生命周期 | 只记录能力，不重写 scheduler |
| Anthropic / OpenAI / DeepSeek / Qwen / gpt-oss 官方资料 | 2026-08-18 核验 | hard capability、license、auth、模型卡 | evidence-backed knowledge |

主清单见 [English source ledger](source-ledger.md)，模型知识机器可读 bundle 位于 `packages/model-knowledge/src/baseline.ts`。

## Native product auth 审计（2026-08-18）

| 产品 | 观察到的公开 seam | 已核验快照 | DSHelm 处理 |
| --- | --- | --- | --- |
| OpenAI Codex | 顶层 `codex login` / `codex logout`；app-server account API 包含 `account/read`、`account/login/start`、`account/login/cancel`、`account/logout` | CLI `0.147.0`；源码 `0acf302db5ffedea4b8ef0112f4cbcddd65cff57` | 当前版本门控 descriptor；app-server 是后续候选 |
| Claude Code | `claude auth login/status/logout` | `2.1.234`；源码 `354757e5b2d9aa1ebb62e5d05ecd384f0e11c0f7` | 当前版本门控 descriptor |
| Gemini CLI | 交互式 `/auth`；没有核验的 shell `auth login/logout` | `0.55.1`；源码 `24cc26ccb15522b55c4f8a63b2f894fb99b8e82a` | shell descriptor 为 unsupported，不猜命令 |
| Qwen Code | 交互式 `/auth`；旧版 `qwen auth` 已移除；daemon/SDK seam 不是 shell 契约 | `0.21.13`；源码 `179c8f80fd14da7e76b370ee58db1a733f9e21ae` | shell descriptor 为 unsupported；daemon/SDK 仅 research |
| xAI/Grok 原生产品 | 未核验到稳定公开 native CLI/app-server auth seam | 审计快照 | 不添加 native descriptor；provider-owned pi-ai OAuth 单独处理 |

descriptor 的版本信息只是兼容性证据，不承诺未来版本可用。版本未知或超出核验
范围时，不得执行敏感 login/logout 命令。

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

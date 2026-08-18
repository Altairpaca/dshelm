# 已验证技术栈

| 组件 | 状态 | 核验事实 |
| --- | --- | --- |
| Core policy resolver | VERIFIED | 类型检查、单元/property 测试、确定性候选评分 |
| DSH host service | VERIFIED | rc.7 seam、真实 Cordis composition、`dshelm.policy` 生命周期 |
| Model Knowledge overlay | VERIFIED | baseline bundle 注入 `ctx.llm.resolveModelInfo`，route-impact test 选择 Flash |
| pi-ai OAuth bridge | VERIFIED | `Models.checkAuth/login/logout`、用户级 0600 fallback、token redaction |
| Native product auth | PARTIAL | Codex top-level `login/logout` descriptor；无稳定 status 时返回 `unknown` |
| AgentTeams | EXPERIMENTAL | durable plugin API 已审计；DSHelm 不伪造 programmatic run backend |
| DeepSeek credentialed live acceptance | SKIPPED | 当前不在 `Asia/Shanghai 02:00–08:00` gate，未发送请求 |

English evidence table 见 [verified-stack.md](verified-stack.md)。

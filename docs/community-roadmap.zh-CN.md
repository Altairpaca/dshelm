# DSHelm 社区版本路线图

更新日期：2026-09-10

这份路线图只记录能够被用户验证的结果。代码合并、测试数量、README 文案和架构完成度都是工程证据，但不自动等于社区版本可用或已经产生真实采用。

## 当前定位

DSHelm 不再把“支持多个模型”本身当作主要差异化能力。DeepSeek Harness 生态已经能够通过 Agent/Subagent 配置、provider 插件和调用点 `agentOptions` 实现多种模型分配方式；真正仍然稀缺的是对运行时事实和兼容性事实的可见性。

DSHelm 接下来的产品主线是：

> **Effective Route Truth + Compatibility + Explainability**

也就是回答两个用户真正会遇到的问题：

1. **这次任务实际上跑到了哪个 provider / model / reasoning effort？**
2. **我当前的 DSH 与插件组合，究竟经过了哪一层验证？**

对第一类问题，DSHelm 应明确区分：

`requested → resolved → effective`

其中 `effective` 必须来自真实请求/会话运行记录，而不是从 Root Agent UI、配置继承或策略对象推断。

对第二类问题，DSHelm 应明确区分：

`source/API → package graph → packed install → clean profile → session lifecycle → web client → runtime journey`

任何一层 PASS 都不能冒充完整兼容。

## 为什么现在向这个方向收敛

当前 DSH 社区已经独立出现了与 DSHelm 主张高度一致的信号：

- SubAgent 实际路由可能与 Root/显示路由不同，并产生不可预期的成本升档：<https://github.com/deepseek-ai/deepseek-harness/discussions/5973>
- DSHelm 与其他第三方插件作者独立采用真实 `request/header` / session request record 来验证 effective route：<https://github.com/deepseek-ai/deepseek-harness/discussions/2053>
- 插件迁移社区反复发现 typecheck/tests 全绿并不代表新 DSH cohort 能真实启动，验证必须覆盖 package、Cordis、Host/Client、Slot、runtime 和分发物：<https://github.com/deepseek-ai/deepseek-harness/discussions/5120>

因此 DSHelm 不应与社区竞争“插件数量”或重复造一套迁移机器人，而应把已有的 routing trace 与 compatibility evidence 做成稳定、可复用的基础设施。

## 当前工程状态

截至 2026-09-10：

- verified DSH baseline 仍为 `0.1.0-rc.7`；
- forward candidate 为 `0.1.5-rc.1`；
- Session、Agent/Subagent、Web panel 等 source-level 兼容桥已完成主要迁移；
- DeepSeek V4/V4.1 与 pi-ai 0.85.1 provenance 已完成当前一轮刷新；
- #45 已建立独立 candidate-source CI，正常 verified-baseline CI 与 candidate qualification 分离；
- candidate lane 尚未通过，因此不得宣称 `0.1.5-rc.1` 已验证支持。

详细资格证据见 #34/#45。

## P0-A：先把当前 DSH candidate 真正验证清楚

目标：让兼容性从“我们认为能编译”变成机器可追踪的分层证据。

- [x] 建立 `compatibility-candidates.json` / `compatibility-evidence.json` promotion contract；
- [x] 完成 0.1.5 关键 source/API seam 的静态迁移；
- [x] 建立独立 candidate-source lane，不先污染 verified manifest；
- [ ] 修复并通过 #45 的 candidate package/source graph；
- [ ] 记录完整、无混合 prerelease 的 0.1.5 package cohort；
- [ ] 对 candidate graph 运行 workspace typecheck/build/tests；
- [ ] fresh pack/install 所有 DSHelm release artifacts；
- [ ] isolated HOME/DSH_HOME 下完成 init → boot → doctor → explain → first-run → uninstall；
- [ ] 验证 Session V3 lifecycle/persistence；
- [ ] 验证当前 Web client 能发现并 materialize `@dshelm/dsh/client`；
- [ ] 所有 required checks 通过后，才允许移动 `compatibility.json.tested`。

Owner：#34、#45。

## P0-B：把 Effective Route Inspector 做成第一个强产品证据

目标：用户不需要相信配置或 UI，而能看到本次请求真正执行了什么。

#46 负责实现：

- [ ] 定义稳定的 effective-route observation contract；
- [ ] 保存 provider / model / reasoning effort、role/child identity、evidence source；
- [ ] Resolution Trace 同时展示 requested / resolved / effective；
- [ ] 区分 same route、explicit override、fallback、provider change、model change、reasoning change、unknown；
- [ ] 当 child route 明显升到更高的已知成本/模型 tier 时给出 warning；
- [ ] 没有价格/tier evidence 时显示 unknown，不制造成本数字；
- [ ] reconnect/replay 后仍保留历史 effective observation，而不是重新推断；
- [ ] 把 Flash → Pro 类型的 divergence fixture 做成 30 秒 demo。

第一阶段以“看清楚和告警”为主，不默认自动阻断所有 escalation。

## P0-C：把 Compatibility Radar 做成第二个强产品证据

目标：让 DSHelm 当前严格的兼容性维护方法从内部 CI 约定，变成用户和生态都能读取的公共接口。

#47 负责统一 projection，#41 的 `doctor` 作为消费端。

- [ ] 从现有 compatibility candidate/evidence contract 输出稳定 JSON；
- [ ] 支持 verified / candidate / blocked / newer-unknown / mixed-cohort；
- [ ] 分别显示 source/API、package graph、packed install、clean profile、Session、Web、runtime 状态；
- [ ] 证据随 candidate 变化后能显式 stale/reset，不能沿用旧版本 PASS；
- [ ] `doctor` 使用同一个 projection，不再维护第二套兼容状态机；
- [ ] README / Release 可渲染紧凑 Compatibility Card；
- [ ] 为插件目录/marketplace 预留机器可读消费方式。

目标形态示例：

```text
DSH 0.1.0-rc.7   VERIFIED
DSH 0.1.5-rc.1   CANDIDATE

source/API        PASS
package graph     FAIL|PASS|PENDING
packed install    PASS|PENDING
clean profile     PASS|PENDING
session lifecycle PASS|PENDING
web client        PASS|PENDING
runtime journey   PASS|PENDING
```

## P1：发布一个用户真正能复现的 Alpha

Broad launch 前至少满足：

- [ ] #7 发布公开 npm alpha；
- [ ] clean HOME 下安装和卸载可复现；
- [ ] 至少一份 #8 的真实支持环境安装记录；
- [ ] #46 有可重复的 requested → resolved → effective demo；
- [ ] #47 能准确展示 verified baseline 与 current candidate；
- [ ] credential-free resolver 与 real DSH execution fixtures 保持绿色；
- [ ] `doctor` / first-run 能给出明确下一步命令；
- [ ] release notes 写出 exact DSH version 和限制，不使用模糊的“0.1.x compatible”。

第一位不了解 DSHelm 源码、但已经安装 DSH 的用户应该能够完成：

1. 安装；
2. `doctor`；
3. 跑 first-run；
4. 看 requested/resolved/effective route；
5. 看 compatibility card；
6. 安全卸载。

## P1.5：通过真实问题进入社区，而不是先做泛宣传

第一轮公共内容只做两篇强技术材料。

### A. Why green TypeScript tests are not enough for a DSH plugin upgrade

用 DSHelm `rc.7 → 0.1.5` 的真实迁移作为 case study，只写能够复现/引用的问题：

- package cohort；
- Session/Agent/Subagent API drift；
- Cordis inject/service drift；
- Web slot/client materialization；
- browser/host 类型隐藏耦合；
- packed install；
- clean-profile/runtime acceptance。

文章结尾提供一份小型 validation matrix，而不是“欢迎给 DSHelm Star”。

优先回到 DSH Discussion #5120 贡献迁移证据。

### B. Your root model is not necessarily your subagent model

在 #46 有可复现 demo 后发布：

- requested / resolved / effective 的区别；
- 为什么 root UI 和 inheritance 不能作为实际调用的充分证据；
- session/request record 如何提供 durable evidence；
- fallback、explicit override 与 silent escalation 如何区分。

优先回到 DSH Discussions #5973 / #2053 贡献证据。

## 社区分发顺序

不要同时向所有渠道铺开。

1. **相关 DSH Discussion**：只在确实解决讨论问题时回复，带 fixture、commit 或验证结果；
2. **GitHub prerelease + DSHelm Discussion**：放 canonical install、demo、compatibility card、limitations；
3. **DSH plugin index / awesome list / marketplace**：等公开包和安装路径真实存在后再更新；
4. **LinuxDO / X / LinkedIn / 其他技术社区**：复用上面两篇技术内容，不发纯项目广告；
5. **Provider / partner cross-promotion**：只有独立技术验证完成后才做，并与 capability evidence/routing score 分开。

## P2：再做更强的 evidence-conditioned routing policy

只有在 #46 已经能验证“实际执行是否符合策略意图”后，才扩大自动决策。

#31 负责：

- task context；
- budget / latency / risk constraints；
- user/project/request override precedence；
- stale/unknown evidence；
- fallback/escalation policy；
- policy intent 与 effective runtime observation 对账。

原则：如果自动 escalation 被允许，这个允许必须在 policy 中显式存在；不能因为 heuristic score 更高就偷偷切到更贵模型。

## P3：生态健康与集成

- 将 compatibility/freshness metadata 暴露给目录和 marketplace；
- provider integration 保持 optional、provider-neutral、evidence-backed；
- 对 DSHelm 自己的权限/能力尽可能提供 declarative metadata；
- 优先使用当前 DSH-native slots/services，而不是长期维护 legacy shim；
- 商业/推荐关系不得改变 capability evidence、routing score 或默认模型选择，除非存在独立技术证据。

## 下一阶段的采用指标

短期不以 50/100 stars 作为主要成功标准。

下一阶段更重要的里程碑是：

- [ ] **3 个**非维护者、可复现的 install reports；
- [ ] **2 个**真实外部 routing/use cases 或 route traces；
- [ ] **1 个**外部 contributor PR；
- [ ] **1 个**其他 DSH project/index/integration 引用或消费 DSHelm 的 route/compatibility contract。

Stars、forks、watchers 用作 awareness 二级指标。GitHub clone 数可能包含 CI 和索引器，不作为独立采用证据。

## Alpha 后每周观察什么

- 外部安装报告与平台覆盖；
- `doctor` / first-run 的失败类型；
- reproducible bug 从报告到修复的时间；
- route divergence 是否能被 DSHelm 正确解释；
- 外部 issue / PR / use case；
- 是否有其他 DSH 项目引用 Compatibility Radar 或 Effective Route contract；
- npm downloads 只与 first-run/use-case evidence 一起解释。

## 不做什么

- 不以“支持最多模型/插件”为竞争方向；
- 不重复做一个通用 DSH migration bot；
- 不把 typecheck 绿色等同于 runtime compatibility；
- 不把 Root Agent 显示模型等同于 effective child route；
- 不把 benchmark/release note 直接转换成 routing score；
- 不在公开 npm alpha 尚未验证前大规模引流；
- 不描述 DSHelm 为 DeepSeek 官方项目；
- 不使用 “Chinese-first” 等地域/语言优先定位；
- 不做没有问题复现或证据支撑的“请 Star”式推广。

## 相关工作

- 总路线：#32
- 当前 DSH qualification：#34、#45
- Effective Route Inspector：#46
- Compatibility Radar：#47
- Doctor version-skew diagnostics：#41
- 高阶 routing policy：#31
- npm alpha：#7
- platform evidence：#8
- contributor entry：#10
- community launch：#23

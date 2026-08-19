# DSHelm 社区版本路线图

更新日期：2026-08-19

这份路线图只记录能够被用户验证的结果。代码合并、测试数量和架构完成度是工程证据，但不自动等于社区版本可用。

## 发布目标

DSHelm 的第一个公开社区版本需要让一位已安装 DSH、但不了解 DSHelm 源码的用户完成以下旅程：

1. 用一条公开安装命令安装 `dshelm` profile；
2. 运行 `doctor`，得到可以执行的环境诊断；
3. 运行一个 planner → workers → reviewer 示例；
4. 在 Web 控制面板看到每个角色选择的模型及原因；
5. 卸载 DSHelm，且不删除其他 profile 或产品凭据。

## GitHub 社区版本门槛

### P0：可以安装和验证

- [ ] 发布 `dshelm`、`@dshelm/dsh` 及内部依赖的 npm alpha 包；
- [ ] `npx dshelm init --yes` 在干净环境中通过；
- [x] 源码预览提供单独的 `pnpm preview:init` 入口；
- [ ] macOS、Linux、Windows 11 + WSL2 各有一份真实安装记录；
- [ ] 发布 GitHub prerelease，包含变更、限制、升级和卸载说明；
- [ ] 插件目录不再报告 `no-verified-package` 或 `hidden`。

### P1：第一次运行产生价值

- [ ] 提供一个默认的 planner / worker / reviewer 示例策略；
- [ ] 提供一个不依赖私有凭据的演示或 fixture；
- [ ] CLI 给出明确的下一步命令，而不只输出内部状态；
- [ ] 控制面板支持中英文界面和空状态引导；
- [ ] 用一个真实任务记录结果、耗时、模型选择与失败边界。

### P2：社区可以参与

- [x] 中文主 README、英文入口和真实界面截图；
- [x] 安装反馈、场景征集和缺陷模板；
- [ ] 开启仓库 Discussions，并设置“使用案例”“模型路由”“帮助”分类；
- [ ] 招募 5–10 位非熟人种子用户；
- [ ] 至少收集 3 个外部 issue、2 个可引用案例；
- [ ] 将公共接口问题同步到对应的 DSH 官方 Discussion。

## 桌面化原则

DSHelm 不维护第二套 Electron/Tauri 运行时。桌面体验来自 DSH 桌面宿主加载同一个 `dshelm` profile 和 `@dshelm/dsh` bundle。验收内容包括：

- 桌面宿主能从用户目录发现并加载 DSHelm profile；
- profile 与插件可更新，不被只读应用包锁死；
- 产品自有凭据不被 DSHelm 复制进桌面应用；
- Web 和桌面展示相同的 Resolution Trace；
- 卸载 DSHelm 不破坏宿主和其他插件。

详细协作边界见 [`desktop.zh-CN.md`](desktop.zh-CN.md)。

## 中国用户验收矩阵

| 场景 | 需要记录的证据 |
| --- | --- |
| Windows 11 + WSL2 | Node/pnpm/DSH 版本、安装命令、启动截图、路径问题 |
| macOS Apple Silicon | 安装时间、Gatekeeper/权限影响、Web 或桌面截图 |
| Linux x64 | 发行版、Node 来源、profile 路径、启动结果 |
| DeepSeek API | 认证状态、路由结果、峰谷费用说明，不提交 key |
| Qwen / 本地模型 | provider 与模型标识、能力探测、失败原因 |
| Codex / Claude | 只记录产品拥有的登录状态，不导出或复制凭据 |

任何凭据、token、cookie、用户目录或私人仓库名都应在截图和日志中打码。

## 衡量社区关注的指标

社区版本不以熟人 star 为成功标准。发布后按周记录：

- README 独立访客 → 安装开始 → `doctor` 通过 → 首个任务成功的漏斗；
- 非维护者 issue、Discussion、PR 和可引用案例数量；
- npm 独立下载与 7 日后仍使用的种子用户数；
- 安装失败类型和从报告到解决的时间；
- 来自 DSH 官方 Discussion、插件目录和中文内容平台的有效访问。

原始 GitHub clone 数可能包含 CI 和索引器，不单独作为用户增长证据。

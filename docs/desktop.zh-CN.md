# DSHelm 桌面化策略

## 结论

DSHelm 应当具备开箱即用的桌面体验，但不应创建自己的桌面运行时。它的责任是成为一个能够被 DSH Web、官方未来桌面端或社区桌面宿主一致加载的 profile/plugin distribution。

这与 DSH 的“Everything is a Plugin”方向保持一致，也避免用户面对两套会话、插件、凭据和升级机制。

## 用户期望的桌面旅程

```text
下载并打开 DSH 桌面宿主
  → 在插件/Profile 界面安装 DSHelm
  → 选择或确认已有模型账号
  → 运行示例任务
  → 查看规划、执行、审核所用模型及 Resolution Trace
```

最终体验不应要求用户理解 pnpm workspace、Cordis patch 或 bundle manifest。

## DSHelm 自己负责

- 发布可安装、可升级、可卸载的 npm 包；
- 提供名为 `dshelm` 的标准 DSH profile；
- 通过官方 client runtime 展示控制面板；
- 保持 Web 与桌面使用同一套 host projection 和 Resolution Trace；
- 提供无交互的安装、诊断和卸载命令；
- 声明兼容的 DSH 版本与平台验证结果。

## 依赖桌面宿主提供

- Electron/Tauri 生命周期、窗口、更新、签名和公证；
- profile 和外部插件的可写安装目录；
- DSH client bundle 的发现与加载；
- 原生文件选择、通知、凭据存储等宿主能力；
- 崩溃恢复和桌面级日志入口。

## 与 DSH 社区的协作点

[DSH 官方 Discussion #3118](https://github.com/deepseek-ai/deepseek-harness/discussions/3118) 已展示 Electron `file:// + IPC` 宿主，并暴露了打包版安装外部插件的真实问题。DSHelm 可以贡献一个小而明确的验收 fixture：

1. 将本地或已发布的 `@dshelm/dsh` 安装到用户级 `dshelm` profile；
2. 由桌面宿主加载 profile，而不是把插件固化在只读应用包中；
3. 创建一条控制面板 projection；
4. 断言桌面客户端能看到 planner / worker / reviewer 和 trace；
5. 升级或卸载 bundle 后，其他 profile 保持不变。

这个 fixture 对所有外部插件都有价值，不应成为 DSHelm 专有接口。

## 暂不做的事情

- 不 fork DSH 创建“DSHelm Desktop”；
- 不把第三方产品凭据复制到 DSHelm 自己的数据库；
- 不在应用安装目录中维护不可升级的插件副本；
- 不为了桌面端创建第二套 UI 状态或路由解释模型；
- 不在没有 Windows/macOS 真实验证前宣称全平台支持。

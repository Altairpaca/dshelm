# 参与 DSHelm / Contributing

DSHelm 目前处于 alpha 阶段。中英文 Issue 和 PR 都欢迎；现阶段最有价值的贡献通常是真实安装记录、路由场景、DSH 集成验证和小型端到端改进，而不是扩大未经验证的功能范围。

## 开始之前

以下改动请先开 Issue：新的 Core 抽象、配置 schema、运行时依赖、兼容层或较大的界面流程。文档修正、测试、错别字和范围明确的小改动可以直接提交 PR。

你也可以直接使用：

- [安装反馈](https://github.com/Altairpaca/dshelm/issues/new?template=install_report.yml)
- [路由场景](https://github.com/Altairpaca/dshelm/issues/new?template=routing_scenario.yml)
- [缺陷报告](https://github.com/Altairpaca/dshelm/issues/new?template=bug_report.yml)

涉及 DSH 公共接口或运行时行为时，请先检索 [DSH 官方 Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)，并在 Issue 中附上相关讨论链接。

## 设计原则

- 优先组合 DSH 公共扩展接口和成熟插件，不重复实现运行时；
- Core 只拥有策略、配置、路由和 Resolution Trace，不依赖 DSH package；
- 路由必须确定、可序列化、可解释；
- 用户、项目和请求级显式配置优先于默认建议；
- 有损迁移、未知状态和未验证能力必须明确显示；
- 不复制缺少许可证的第三方代码或素材；
- 不在 Issue、测试、截图或日志中提交凭据和私人数据。

完整边界见 [`AGENTS.md`](AGENTS.md) 和 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 开发流程

工具链为 Node.js `>=22.19.0`、pnpm `11.7.0`、TypeScript 和 ESM。

```bash
pnpm install --frozen-lockfile
pnpm docs:check
pnpm typecheck
pnpm test
pnpm build
pnpm run qa:web-renderer -- --profile dshelm-community --url http://127.0.0.1:19876
```

`qa:web-renderer` 是独立浏览器渲染验证；真实 DSH profile 和 bundle 安装由 clean-install CI lane 验证。修改用户界面时请同时检查桌面和窄屏，并附上截图。

实现改动时：

1. 保持范围清晰，遵守 Core / DSH 边界；
2. 修改 resolver 或 adapter 行为前先添加失败测试；
3. 对照仓库固定版本验证 DSH API，不凭记忆推断；
4. 更新用户可见文档和兼容状态；
5. 记录安装、执行或浏览器表面的真实证据；
6. 使用简短的 Conventional Commit 信息。

PR 应说明改了什么、为什么属于 DSHelm、如何验证，以及是否改变路由或兼容语义。

## License

除非明确另行声明，提交贡献即表示同意依 Apache License 2.0 授权，与许可证第 5 节一致。

---

English contributors may use the same templates and workflow. Please describe the user problem, keep changes scoped, validate against the pinned DSH version, and attach reproducible evidence for user-facing behavior.

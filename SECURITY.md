# 安全策略 / Security Policy

## 支持范围

DSHelm 仍处于 alpha 阶段，目前只对最新的 `main` 和最新 GitHub prerelease 接受安全报告。Alpha API 可能发生不兼容变化，但凭据泄露、越权执行、路径穿越、命令注入和依赖供应链问题始终按安全问题处理。

## 私下报告

请通过 GitHub 仓库的 **Security → Report a vulnerability** 私下报告。不要在公开 Issue 或 DSH Discussion 中提交漏洞细节、凭据、token、cookie、私人路径或未脱敏日志。

报告建议包含：

- 受影响的 commit 或版本；
- 最小复现和影响范围；
- 是否接触凭据、文件系统或外部命令；
- 已删除敏感数据的日志；
- 如有可能，提供缓解建议。

维护者确认并完成修复后，会与报告者协调披露时间和致谢方式。

---

Please use GitHub private vulnerability reporting. Do not disclose exploit details or secrets in public Issues or upstream DSH Discussions.

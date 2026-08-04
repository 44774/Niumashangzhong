# 如何放入开发仓库

推荐把整个资料包复制为：

```text
your-repository/docs/product-kit/
```

然后将本包根目录的 `AGENTS.md` 内容合并到仓库根 `AGENTS.md`，或在根文件中明确指向 `docs/product-kit/AGENTS.md`。

建议首次给 Codex 的指令：

> 阅读仓库根 AGENTS.md 和 docs/product-kit/00_start/CODEX_MASTER_PROMPT.md，检查当前仓库状态，然后只执行 docs/product-kit/07_codex_prompts/PHASE_1_FOUNDATION.md。先给出计划和文件清单，再编码；完成后运行所有质量命令并报告结果。

不要一次性要求 Codex 实现全部系统。分阶段提交更容易发现架构、权限和时间计算问题。

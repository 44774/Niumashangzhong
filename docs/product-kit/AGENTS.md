# AGENTS.md — 工作日历开发约束

本目录是产品规范包，不是可忽略的参考附件。Codex 或其他编码代理在修改项目之前，必须先读取：

1. `00_start/CODEX_MASTER_PROMPT.md`
2. `01_product/BUSINESS_RULES.md`
3. `02_ui/UI_DESIGN_SYSTEM.md`
4. `03_architecture/ARCHITECTURE.md`
5. `04_data_api/openapi.yaml`
6. `05_quality/ACCEPTANCE_CRITERIA.md`

## 强制规则

- 不得用静态截图代替真实页面。
- 不得把临时改班实现为直接修改循环规则。
- 不得忽略跨午夜、时区、版本冲突与通知去重。
- 不得仅在客户端做组织权限判断。
- 不得把真实密钥、访问令牌、手机号、精确坐标写入日志或仓库。
- 不得让天气、推送、海报等外部服务故障阻塞排班核心流程。
- 所有管理员写操作必须审计。
- 所有 UI 色值、间距、圆角优先来自 `02_ui/design-tokens.json`。
- 所有 API 变更必须同步 OpenAPI、客户端类型和测试。

## 阶段化开发

严格按 `07_codex_prompts/PHASE_1` 至 `PHASE_5` 推进。一个阶段完成前不要跨阶段大规模实现，避免产生不可验证的半成品。

## 每次任务结束

输出修改文件、关键决策、运行过的命令、测试结果、已知限制。执行 `07_codex_prompts/REVIEW_CHECKLIST.md`。

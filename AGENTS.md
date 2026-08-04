# AGENTS.md — 工作日历仓库约束

产品规范包位于 `docs/product-kit/`。开发前必须完整阅读：

1. `docs/product-kit/00_start/CODEX_MASTER_PROMPT.md`
2. `docs/product-kit/01_product/BUSINESS_RULES.md`
3. `docs/product-kit/02_ui/UI_DESIGN_SYSTEM.md`
4. `docs/product-kit/03_architecture/ARCHITECTURE.md`
5. `docs/product-kit/04_data_api/openapi.yaml`
6. `docs/product-kit/05_quality/ACCEPTANCE_CRITERIA.md`

## 强制规则

- 不得用静态截图代替真实页面。
- 不得把临时改班实现为直接修改循环规则；默认只改指定日期。
- 不得忽略跨午夜、时区、版本冲突与通知去重。
- 不得仅在客户端做组织权限判断；组织资源必须由服务端校验工作空间成员关系。
- 不得把真实密钥、访问令牌、手机号、精确坐标写入日志或仓库。
- 不得让天气、推送、海报等外部服务故障阻塞排班核心流程。
- 所有管理员/敏感写操作必须写审计日志。
- 所有 UI 色值、间距、圆角优先来自 `docs/product-kit/02_ui/design-tokens.json`。
- 所有 API 变更必须同步 `docs/product-kit/04_data_api/openapi.yaml`、共享类型与测试。

## 本轮实现状态（第一轮）

- 小程序：原生 TypeScript，根目录为 `apps/miniprogram`，AppID 占位 `touristappid`。
- 后端：Fastify + PostgreSQL；不引入 Redis；天气仅 mock Provider；海报由客户端 Canvas 生成。
- 只实现个人模式 P0 页面；组织模式、管理后台、APP、分享链接属于后续轮次。

## 任务结束要求

输出修改文件、关键决策、运行过的命令与测试结果，并对照
`docs/product-kit/07_codex_prompts/REVIEW_CHECKLIST.md` 自查。

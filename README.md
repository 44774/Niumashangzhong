# 工作日历 · 微信小程序版

“工作日历”是一个面向倒班、轮班用户的日历式排班工具。本仓库是第一轮实现：
**原生微信小程序（TypeScript）+ 最小后端（Fastify + PostgreSQL）**，覆盖个人模式核心链路：
开发/微信登录 → 班次模板 → 月历/周视图/排班详情 → 临时改班 → 提醒设置 → 分享海报。

产品与 UI 规范位于 `docs/product-kit/`，实现约束见根目录 `AGENTS.md`。

## 快速开始

```bash
pnpm install
pnpm gen:tokens          # 由设计令牌生成小程序 WXSS
pnpm sync:types          # 共享类型同步到小程序 typings
docker compose up -d          # 启动 PostgreSQL（含 workcal / workcal_test 两个库）
pnpm db:migrate               # 执行数据库迁移
pnpm db:seed                  # 写入演示账号与班次模板
pnpm dev:api                  # 启动 API：http://127.0.0.1:3000
```

API 文档（Swagger）：http://127.0.0.1:3000/docs

## 打开小程序

1. 用微信开发者工具导入 `apps/miniprogram`。
2. AppID 使用 `touristappid`（测试号）或替换为自己的 AppID。
3. 本地调试需在“详情 → 本地设置”勾选“不校验合法域名”。
4. 登录页选择“开发账号登录”即可使用；填入 `WECHAT_APPID` / `WECHAT_SECRET` 后，微信登录会自动走真实 code2session。

后端 API 需要本地 PostgreSQL；`apps/api` 的 dev 脚本会自动先构建共享包。

## 质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test              # 单元测试
pnpm test:integration  # API 集成测试（需本地 PostgreSQL）
pnpm build
pnpm gen:tokens        # 由设计令牌生成小程序 WXSS
pnpm sync:types        # 共享类型同步到小程序 typings
```

## 仓库结构

```text
apps/api/            Fastify 后端（auth/workspace/shift/schedule/change/weather/notification/sharing）
apps/miniprogram/    原生微信小程序（TypeScript）
packages/shared-types      领域类型（单一来源）
packages/schedule-engine   时间/循环/冲突纯函数
packages/design-tokens     设计令牌（JSON → WXSS）
database/migrations        PostgreSQL 迁移
database/seeds             演示数据
docs/product-kit/          产品资料包
```

## 本轮范围与默认

- 仅个人模式；组织、审批模式、APP、管理后台、分享链接留到后续轮次。
- 未配置微信凭证时，登录与订阅消息走开发模式；天气使用 mock Provider。
- 海报由小程序端 Canvas 绘制，服务端只保存不可变快照。
- 暂不引入 Redis；通知任务与天气缓存放 PostgreSQL，由 API 进程内调度。

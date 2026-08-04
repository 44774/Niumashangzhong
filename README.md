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

## 小程序自动化冒烟（连接微信开发者工具）

仓库内置 `miniprogram-automator` 冒烟脚本，可连接正在运行的微信开发者工具，
在模拟器里完成“登录 → 日历 → 详情 → 改班 → 分享”的流程检查并截图：

```bash
pnpm smoke:mp:all   # 自动启动后端 + 连接开发者工具 + 跑冒烟 + 关闭后端
```

前置条件：

- 微信开发者工具已安装（脚本默认使用 `D:\ProgramFiles\WeChatDeveloperTools\cli.bat`，路径不同请修改 `scripts/miniprogram-smoke.mjs` 顶部的 `cliPath`）。
- 自动化端口已开启：脚本会自动执行 `cli.bat auto --project apps/miniprogram --auto-port 9420`；也可以在开发者工具「设置 → 安全设置 → 服务端口」手动打开。
- 截图输出到 `artifacts/miniprogram-smoke/`（已 gitignore）。

## 微信云开发（CloudBase）

小程序后端默认使用微信云开发，无需本地 API 和 PostgreSQL：

- 环境 ID：`cloud1-d7gn5yyw2a7816ffd`（见 `apps/miniprogram/config.ts` 的 `CLOUD_ENV_ID`）。
- 云函数位于 `apps/miniprogram/cloudfunctions/`：`api`（业务路由）+ `dispatcher`（通知定时器）。
- 云函数源码为 TypeScript，通过 `pnpm build:cloud` 用 esbuild 打包成 `index.js`。
- 登录是微信云开发的天然能力：云函数里通过 `cloud.getWXContext().OPENID` 识别用户，小程序不再需要登录页和 token。

部署步骤（需要先执行一次 `tcb login` 扫码登录）：

```bash
pnpm build:cloud           # 打包云函数
pnpm init:cloud            # 创建 12 个云数据库集合（幂等，可重复执行）
tcb fn deploy api          # 部署业务云函数
tcb fn deploy dispatcher   # 部署通知定时器
```

也可以在微信开发者工具中：云函数目录右键 →「上传并部署：云端安装依赖」。
云开发模式切换回本地 Fastify：把 `apps/miniprogram/config.ts` 的 `USE_CLOUDBASE` 改为 `false`。

自动化冒烟同时支持两种模式：云模式会走自动登录，并通过 `system.seed` 写入演示排班后验证
“日历 → 详情 → 改班 → 分享”全流程；本地模式则需要先启动 Fastify API。

## 本地登录（数据仅保存在本机）

登录页提供两种方式：

- 微信云登录：数据保存在云端（CloudBase），可多设备同步。
- 本地登录：班表数据仅保存在当前设备（`wx` 本地存储），不会上传云端；点击「本地登录」会先弹出
  确认提醒，只有用户确认后才能登录。清除小程序数据或更换设备后将无法找回本地班表。

本地模式不调用云函数，班次模板、排班、改班记录、通知偏好与分享快照全部由
`apps/miniprogram/services/api-local.ts` 读写本地存储；`pnpm smoke:mp` 会验证云登录流程，
`node scripts/local-login-check.mjs` 可验证本地登录弹窗与“未确认不登录”行为。

## 体验升级（第二轮）

- 循环排班：日历页「排班表」入口，支持班次序列（1-14 项）、起始日期、长期循环或指定结束日期；规则设置后，客户端从云端获取排班表（规则），未来排班在本地按序列计算补全，服务端读接口不再逐日写库，因此翻看远期排班无延迟；手动/临时排班始终优先，不被规则覆盖。
- 云端只保存排班规则与手动/临时改班记录，不生成也不计算排班实例；循环生成的班次全部由用户手机本地计算。改班记录支持删除（仅移除记录，不影响已生效排班）。
- 日历一次预载“上月 + 当月 + 下月”并缓存，切月秒开；顶部有醒目的「回到今天」。
- 页面缓存：排班规则/班次模板缓存 5 分钟、天气按位置+日期缓存 6 小时、日历窗口缓存 10 分钟；切换页面先显示旧数据再后台刷新，不再白屏。
- 排班表支持编辑（名称/起始/结束/序列），当前排班表持久化（云端与本地双份），重启后仍是上次选择的排班表。
- 改班记录：日历按可见月份拉取并给有记录的日期加“改”标记；记录页按月分页、删除按钮改为醒目的整行按钮；删除后日历标记同步消失。
- 分享预览完全本地计算（班次/节假日/天气缓存），仅生成海报时调用服务端保存快照；预览超过 2 天只显示日历网格，不再显示下方列表。

逐页人工走查脚本（非断言，仅导航并输出页面状态与截图）：
`node scripts/walkthrough.mjs`、`node scripts/walkthrough-change.mjs`、`node scripts/walkthrough-extra.mjs`，
截图输出到 `artifacts/walkthrough/`。
- 天气：云函数与本地模式均使用 Open-Meteo（免费、无需 key），位置支持地图选点与自动定位（我的 → 位置设置），默认位置会持久化。
- 登录恢复：启动时静默恢复已保存会话，云模式自动刷新用户信息，失败时保留本地缓存，不重复弹登录页。
- 节假日加班：节假日数据来自 timor.tech 年度接口（2019 年起），云端与本地都会缓存；法定节假日上班自动标注「加班」，日历/周视图/详情/海报均展示，上班提醒可附带加班标注（通知设置可关闭）。
- 海报：今日保持列表卡样式；本周/本月/自定义多日改为日历网格样式；自定义起止日期不限长度，跨度超过 92 天会弹窗确认。
- 多排班表：可创建多个命名排班表（循环规则），在「我的 → 排班表管理」或日历页「排班表」中新增、切换、删除；切换后日历只显示当前排班表生成的班次与手动排班。临时改班保存后详情页会自动刷新，不再需要手动返回重进。

真实发布时，本地模式需要把 `api.open-meteo.com`、`archive-api.open-meteo.com`、`timor.tech` 加入小程序 request 合法域名；云模式无需配置。

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

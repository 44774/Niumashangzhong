# 工作日历 · Codex 开发资料包

这是“工作日历”小程序、移动 APP 与管理后台的统一开发蓝图。资料包以效果图为视觉基准，以可被 Codex 直接读取的 Markdown、JSON、YAML、SQL、CSV、PNG 和 SVG 文件组织。

## 产品目标

帮助倒班、轮班、弹性班次和固定班次用户快速回答四个问题：

1. 我哪天上班、上什么班？
2. 今天几点上班、几点下班、在哪里上班？
3. 上班当天的天气如何，需要提前准备什么？
4. 临时变更班次后，怎样留痕、提醒并分享给他人？

系统同时支持个人自主管理和组织统一排班两种模式。

## 推荐默认技术方案

- **小程序与 APP：** Vue 3 + TypeScript + uni-app，共享业务逻辑、设计令牌与大部分页面组件。
- **管理后台：** Vue 3 + TypeScript + Vite，使用成熟后台组件库，但通过主题令牌还原效果图视觉。
- **服务端：** Node.js + TypeScript，模块化 REST API；框架可选 NestJS 或 Fastify 体系。
- **数据层：** PostgreSQL；Redis 用于缓存、分布式锁、验证码、任务去重与通知队列。
- **文件资源：** S3 兼容对象存储，用于头像、分享海报、导入导出文件。
- **任务系统：** 队列处理天气同步、班次提醒、分享海报生成、批量导入与报表导出。
- **仓库形式：** pnpm workspace monorepo，统一 lint、类型、API SDK、设计令牌和测试。

资料中不锁死具体框架版本。初始化项目时选择稳定版本，并把版本写入锁文件。

## 先从这里开始

1. 阅读 `00_start/START_HERE.md`。
2. 将 `00_start/CODEX_MASTER_PROMPT.md` 作为 Codex 的总任务说明。
3. 让 Codex 按 `07_codex_prompts/` 中的阶段提示词逐步实现。
4. 视觉实现必须同时参考 `02_ui/` 和 `06_assets/mockups/`。
5. 数据与接口实现以 `04_data_api/schema.sql`、`04_data_api/openapi.yaml` 为基础。
6. 每个阶段结束后执行 `05_quality/ACCEPTANCE_CRITERIA.md` 和 `07_codex_prompts/REVIEW_CHECKLIST.md`。

## 目录说明

| 目录 | 内容 |
|---|---|
| `00_start` | 启动说明、总提示词、默认决策 |
| `01_product` | PRD、功能矩阵、用户故事、页面与流程、业务规则 |
| `02_ui` | UI 设计规范、组件规范、各端页面规格、设计令牌 |
| `03_architecture` | 技术架构、单仓目录、安全、部署与环境 |
| `04_data_api` | 数据模型、SQL、OpenAPI、接口约定 |
| `05_quality` | 测试计划、验收标准、种子数据 |
| `06_assets` | Logo、多尺寸图标、三套效果图 |
| `07_codex_prompts` | 分阶段开发提示词与代码审查清单 |
| `08_operations` | 权限、通知、天气、分享、埋点、运营规则 |
| `09_reference` | 文件清单、版本、校验信息 |

## 效果图

- `06_assets/mockups/work-calendar-mini-program.png`
- `06_assets/mockups/work-calendar-mobile-app.png`
- `06_assets/mockups/work-calendar-admin-dashboard.png`

效果图中的文字和布局是视觉与信息架构参考，不应机械地把图片当作固定像素稿。实际页面需适配安全区、不同屏幕宽度、系统字体缩放和数据长度。

## Logo

`06_assets/logo/` 已提供：

- 渐变应用图标 SVG、PNG、多种平台尺寸；
- 单色 SVG；
- 横向品牌组合 PNG、SVG；
- favicon 与移动端图标别名。

Logo 图形含义：日历代表排班，勾选代表计划确认，蓝绿渐变代表可靠、清晰与天气联动。

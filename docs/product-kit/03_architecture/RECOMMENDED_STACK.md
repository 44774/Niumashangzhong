# 推荐技术栈

## 默认方案

### Monorepo

- pnpm workspace；
- 任务编排可使用 Turborepo 或 Nx；
- TypeScript；
- ESLint、Prettier、commit hooks；
- OpenAPI 生成 SDK。

### 用户端

- uni-app + Vue 3 + TypeScript；
- Pinia 或等价轻量状态管理；
- 请求缓存层区分服务端状态与本地 UI 状态；
- 原生能力通过适配器封装：推送、系统分享、相册、日历、定位。

### 管理后台

- Vue 3 + TypeScript + Vite；
- 路由权限与按钮权限双层控制；
- 后台组件库仅作为基础，主题必须使用本资料设计令牌；
- 图表库应支持响应式、无障碍描述和数据导出。

### 后端

- Node.js + TypeScript；
- NestJS 或 Fastify 模块体系；
- PostgreSQL；
- Redis；
- 数据访问可用 Prisma、Drizzle 或成熟 ORM，但复杂时间冲突查询允许使用显式 SQL；
- OpenAPI 文档自动生成并在 CI 校验；
- 队列可使用基于 Redis 或消息中间件的可靠实现。

### 测试

- 单元测试：时间、循环规则、权限、DTO；
- API 集成测试：数据库事务与权限；
- Web 端到端测试：登录、排班、审批；
- 小程序与 APP：核心逻辑单测 + 关键真机/模拟器冒烟测试；
- 视觉回归用于关键页面，但不能替代功能测试。

## 备选方案

若更重视原生体验，可将 APP 改为 Flutter 或 React Native，小程序独立使用 Taro/uni-app。此时仍共享 API、类型、设计令牌和领域规则，不应复制后端逻辑到客户端。

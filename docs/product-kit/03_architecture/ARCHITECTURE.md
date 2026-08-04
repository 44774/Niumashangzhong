# 系统架构

## 1. 总览

建议采用模块化单体开始，在领域边界清晰的前提下保留未来拆分能力。首版无需过早拆成大量微服务。

### 客户端

- `apps/consumer`：uni-app，编译为微信小程序与移动 APP；
- `apps/admin`：Web 管理后台；
- `packages/design-tokens`：设计令牌；
- `packages/shared-types`：领域枚举、DTO、验证规则；
- `packages/api-client`：由 OpenAPI 生成或封装的客户端；
- `packages/schedule-engine`：纯函数时间与循环计算。

### 服务端模块

- Auth：身份、会话、设备；
- User/Workspace：用户、个人空间、组织与成员；
- Shift：班次模板；
- Schedule：规则、实例、冲突、版本；
- ChangeRequest：临时改班与审批；
- Weather：地点与天气 Provider；
- Notification：偏好、计划、发送、回执；
- Sharing：快照、海报、链接；
- Reporting：统计、导入导出；
- RBAC/Audit：权限与审计；
- File：对象存储与临时下载。

## 2. 请求链路

客户端 → API 网关/服务 → 身份验证 → 当前工作空间解析 → 权限校验 → 应用服务 → 领域逻辑 → PostgreSQL → 事件/队列 → 天气、通知、海报或导出 Worker。

## 3. 领域事件

建议事件：

- `schedule.instance.created`；
- `schedule.instance.changed`；
- `schedule.instance.cancelled`；
- `schedule.rule.changed`；
- `change_request.submitted`；
- `change_request.approved`；
- `change_request.rejected`；
- `weather.forecast.updated`；
- `share.snapshot.created`；
- `notification.delivery.completed`。

事件写入事务内 outbox，Worker 异步消费，避免数据库已成功但通知任务丢失。

## 4. 一致性策略

- 排班写入使用数据库事务；
- 实例使用 `version` 乐观锁；
- 批量排班先生成计划和冲突报告，再提交；
- 通知和天气采用最终一致性；
- 分享快照创建时固化数据；
- 统计可使用物化视图或异步聚合，但页面标注更新时间。

## 5. 缓存

适合缓存：用户偏好、组织设置、班次模板、天气预报、只读月历查询。排班变更后通过版本键或标签失效。不要用缓存作为排班写入真相源。

## 6. 任务与队列

任务类型：循环规则补齐、天气刷新、通知调度、海报渲染、导入解析、导出生成、过期文件清理。

每个任务包含：任务类型、幂等键、输入版本、重试次数、下次执行时间、状态和错误摘要。

## 7. 可观测性

- 每个请求有 request ID；
- 日志结构化并脱敏；
- 指标：API 延迟、错误率、DB 连接、队列积压、天气失败、通知送达、海报耗时；
- 追踪关键跨模块链路；
- 管理后台提供任务失败查询入口，但不暴露敏感堆栈给普通管理员。

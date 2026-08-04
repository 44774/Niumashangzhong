# 阶段 1：工程基础与领域核心

请先阅读整个 `docs/product-kit`。本阶段只完成工程基础，不实现完整 UI。

## 目标

- 初始化 monorepo；
- 创建 consumer、admin、api、worker 与共享 packages；
- 建立 PostgreSQL、Redis、本地对象存储或替代 mock；
- 实现身份、工作空间、成员、班次模板；
- 实现 schedule-engine 的纯函数：跨午夜、时长、循环序列、冲突；
- 建立数据库迁移和种子数据；
- 建立 OpenAPI、错误格式、request ID、日志脱敏；
- 导入设计令牌和 Logo；
- 配置 lint、类型检查、测试、构建和本地 compose。

## 必须测试

- 普通/跨午夜时长；
- 循环规则边界；
- 重叠冲突；
- 工作空间权限隔离；
- 班次模板历史快照策略。

## 完成标准

本地一条命令可启动依赖和服务；种子数据可登录或使用开发身份；API 文档可访问；所有测试通过。

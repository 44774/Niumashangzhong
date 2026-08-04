# 推荐仓库目录

```text
work-calendar/
├─ apps/
│  ├─ consumer/              # uni-app：微信小程序 + APP
│  ├─ admin/                 # Web 管理后台
│  ├─ api/                   # HTTP API
│  └─ worker/                # 队列、通知、天气、海报、导入导出
├─ packages/
│  ├─ api-client/            # OpenAPI 生成客户端
│  ├─ shared-types/          # DTO、枚举、错误码
│  ├─ design-tokens/         # JSON/CSS/主题映射
│  ├─ schedule-engine/       # 时间、循环、冲突纯函数
│  ├─ validation/            # 共享校验规则
│  ├─ observability/         # 日志与追踪
│  └─ test-fixtures/         # 固定测试数据
├─ database/
│  ├─ migrations/
│  ├─ seeds/
│  └─ scripts/
├─ infra/
│  ├─ docker/
│  ├─ reverse-proxy/
│  ├─ monitoring/
│  └─ deployment/
├─ docs/
│  └─ product-kit/           # 本资料包
├─ .env.example
├─ compose.yaml
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

## 模块边界

API 内按业务模块组织，不按 controller/service/repository 全局分层。示例：

```text
modules/schedule/
├─ domain/
├─ application/
├─ infrastructure/
├─ http/
└─ tests/
```

时间计算必须集中在 `schedule-engine` 或服务端领域层，不允许多个客户端各自实现不同版本。

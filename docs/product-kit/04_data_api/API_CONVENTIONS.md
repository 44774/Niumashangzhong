# API 约定

## 基础

- 路径版本：`/api/v1`；
- JSON；
- 时间戳使用 ISO 8601 UTC；
- 业务日期使用 `YYYY-MM-DD`；
- 请求头携带当前工作空间，例如 `X-Workspace-Id`，服务端再校验成员关系；
- 写操作可携带 `Idempotency-Key`；
- 更新资源携带 `version` 或 `If-Match` 防止并发覆盖。

## 成功响应

单资源直接返回对象；列表返回：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

## 错误格式

```json
{
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "该时段与现有班次冲突",
    "requestId": "req_xxx",
    "details": {
      "conflicts": []
    }
  }
}
```

错误码必须稳定，客户端不依赖中文 message 做逻辑判断。

## 分页

后台普通列表使用页码分页；审计日志、消息等大数据列表可使用游标。最大 `pageSize` 由服务端限制。

## 权限

接口文档标注所需权限，例如 `schedule:write`、`change_request:approve`。服务端根据当前工作空间、成员、角色和资源范围判断。

## 批量操作

批量排班先创建“预览计划”，返回冲突与影响摘要；确认后提交计划。大量任务返回 job ID，客户端轮询或订阅状态。

## 文件

上传采用预签名或受控 multipart。下载返回短期签名链接。CSV 导入必须提供行级错误报告。

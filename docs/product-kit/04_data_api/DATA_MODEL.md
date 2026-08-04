# 数据模型说明

## 核心实体

### users

全局用户账户。身份信息与业务成员关系分离。

### workspaces / organizations / memberships

个人空间与组织空间使用统一工作空间抽象。组织包含部门、策略和成员。成员记录角色、状态、部门和加入时间。

### shift_templates

班次模板。包含名称、简称、颜色、时间、跨日、休息分钟和类型。排班实例保存模板快照。

### locations

地点名称、城市、时区、经纬度和地址。精确坐标按权限控制。

### schedule_rules

循环排班规则。包含起始/结束、班次序列、生成窗口、状态与版本。

### schedule_instances

真实生效的某日排班。包含业务日期、开始/结束时刻、时区、模板快照、来源、状态、版本和所有者。

### schedule_change_requests

临时改班申请，保存原值和请求的新值。审批后生成实例新版本和审计记录。

### weather_forecasts

供应商中立的天气缓存。按位置网格、日期和时区存储规范化字段与原始摘要。

### notification_preferences / notification_jobs / deliveries

用户偏好、计划任务和渠道送达记录分离。

### share_snapshots / share_links

分享快照不可变；链接保存 token 哈希、过期时间和撤销状态。

### audit_logs

管理员和敏感操作的不可变日志。

## 关键索引

- `schedule_instances(owner_user_id, business_date)`；
- `schedule_instances(workspace_id, business_date)`；
- 时间范围冲突可使用 PostgreSQL range 类型和 GiST 索引，或在事务中显式查询；
- `notification_jobs(status, trigger_at)`；
- `weather_forecasts(location_key, forecast_date, provider)`；
- `share_links(token_hash)` 唯一；
- `audit_logs(workspace_id, created_at)`。

## 删除策略

模板与成员优先停用。排班实例通常不物理删除，而标记取消或软删除。分享链接可撤销，快照和文件到期后清理。用户注销按个人与组织法定保留需求匿名化。

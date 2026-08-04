# 角色与权限

## 默认角色

### 成员 member

查看自己的排班、天气、消息；提交改班；管理个人提醒；分享自己的班表。

### 部门主管 manager

成员权限 + 查看授权部门排班 + 审批部门成员改班 + 部门统计。

### 排班员 scheduler

创建、批量修改和导入排班；管理班次模板；查看必要员工信息；不能管理安全设置。

### 组织管理员 admin

管理组织、部门、员工、排班、审批、分享模板、通知策略和统计。

### 所有者 owner

管理员权限 + 账务/组织删除/转移所有权/安全策略。

### 审计员 auditor

只读审计日志、统计和配置，不可修改排班。

## 权限代码示例

- `schedule:read:self`
- `schedule:read:department`
- `schedule:read:workspace`
- `schedule:write:self`
- `schedule:write:department`
- `schedule:batch`
- `change_request:create`
- `change_request:approve`
- `shift_template:manage`
- `member:manage`
- `report:export`
- `sharing:template_manage`
- `settings:manage`
- `audit:read`

## 范围

权限不仅是动作，还包括 `self`、`department`、`workspace`。服务端必须组合判断，不能用单一布尔值替代。

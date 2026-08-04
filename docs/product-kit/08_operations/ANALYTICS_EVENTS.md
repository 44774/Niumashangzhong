# 产品埋点事件

遵循最小必要原则，不记录排班备注、精确地址、手机号或分享内容。

| 事件 | 触发 | 关键属性 |
|---|---|---|
| `onboarding_started` | 进入首次使用 | source |
| `shift_template_created` | 创建班次模板 | kind, cross_midnight |
| `schedule_created` | 创建单日排班 | source, kind |
| `schedule_rule_created` | 创建循环规则 | sequence_length, horizon |
| `calendar_date_opened` | 打开某日详情 | has_schedule, days_from_today |
| `temporary_change_submitted` | 提交临时改班 | approval_required |
| `temporary_change_decided` | 审批完成 | result, decision_latency_bucket |
| `weather_card_viewed` | 显示天气 | cache_state, has_warning |
| `reminder_preference_updated` | 修改提醒 | reminder_count, weather_enabled |
| `share_preview_opened` | 打开分享预览 | range_type |
| `share_generated` | 生成海报/链接 | type, result |
| `batch_schedule_previewed` | 后台预览 | member_count, conflict_count |
| `batch_schedule_submitted` | 后台提交 | conflict_policy, item_count |
| `export_completed` | 导出完成 | format, row_count_bucket |

所有用户标识应使用内部匿名 ID。提供埋点开关和隐私说明。

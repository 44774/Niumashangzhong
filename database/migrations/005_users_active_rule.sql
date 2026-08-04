-- 多排班表：用户当前激活的循环排班表
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_rule_id uuid;

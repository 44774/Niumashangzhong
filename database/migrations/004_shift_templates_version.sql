-- 班次模板乐观锁版本号（与 OpenAPI ShiftTemplate.version 对齐）
ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

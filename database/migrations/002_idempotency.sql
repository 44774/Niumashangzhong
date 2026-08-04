-- 写接口通用幂等表：按 Idempotency-Key 返回首次响应
CREATE TABLE IF NOT EXISTS idempotency_entries (
  idempotency_key varchar(128) PRIMARY KEY,
  scope varchar(64) NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idempotency_scope_idx ON idempotency_entries(scope);

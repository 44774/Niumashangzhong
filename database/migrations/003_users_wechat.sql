-- 微信登录身份绑定（个人模式首版）
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid varchar(128);
CREATE UNIQUE INDEX IF NOT EXISTS users_wechat_openid_uq ON users(wechat_openid) WHERE wechat_openid IS NOT NULL AND deleted_at IS NULL;

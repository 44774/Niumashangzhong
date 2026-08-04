-- 工作日历核心数据库草案（PostgreSQL）
-- 生产实现应通过迁移工具管理，并按所选 ORM 调整类型映射。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE workspace_type AS ENUM ('personal', 'organization');
CREATE TYPE member_status AS ENUM ('invited', 'active', 'suspended', 'left');
CREATE TYPE shift_kind AS ENUM ('work', 'rest', 'leave', 'training', 'travel', 'custom');
CREATE TYPE schedule_status AS ENUM ('scheduled', 'pending_approval', 'cancelled', 'completed');
CREATE TYPE schedule_source AS ENUM ('manual', 'rule', 'template_copy', 'import', 'admin_batch', 'temporary_change');
CREATE TYPE change_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn', 'expired');
CREATE TYPE notification_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(32),
  email varchar(320),
  display_name varchar(80) NOT NULL,
  avatar_url text,
  locale varchar(16) NOT NULL DEFAULT 'zh-CN',
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  week_starts_on smallint NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
  default_city varchar(120),
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX users_phone_uq ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_uq ON users(lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type workspace_type NOT NULL,
  name varchar(120) NOT NULL,
  owner_user_id uuid REFERENCES users(id),
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  default_city varchar(120),
  logo_url text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  parent_id uuid REFERENCES departments(id),
  name varchar(120) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX departments_workspace_idx ON departments(workspace_id);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  department_id uuid REFERENCES departments(id),
  role_code varchar(64) NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'active',
  employee_no varchar(64),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
CREATE INDEX memberships_workspace_status_idx ON memberships(workspace_id, status);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  owner_user_id uuid REFERENCES users(id),
  name varchar(120) NOT NULL,
  city varchar(120),
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (workspace_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE TABLE shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name varchar(80) NOT NULL,
  short_name varchar(12) NOT NULL,
  kind shift_kind NOT NULL DEFAULT 'work',
  color varchar(16) NOT NULL,
  icon varchar(64),
  start_time time,
  end_time time,
  ends_next_day boolean NOT NULL DEFAULT false,
  unpaid_break_minutes integer NOT NULL DEFAULT 0 CHECK (unpaid_break_minutes >= 0),
  default_location_id uuid REFERENCES locations(id),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK ((kind = 'rest') OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);
CREATE INDEX shift_templates_workspace_idx ON shift_templates(workspace_id, is_active);

CREATE TABLE schedule_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  name varchar(120),
  start_date date NOT NULL,
  end_date date,
  sequence jsonb NOT NULL,
  timezone varchar(64) NOT NULL,
  generation_horizon_days integer NOT NULL DEFAULT 90 CHECK (generation_horizon_days BETWEEN 7 AND 366),
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (jsonb_typeof(sequence) = 'array' AND jsonb_array_length(sequence) > 0)
);
CREATE INDEX schedule_rules_owner_idx ON schedule_rules(owner_user_id, is_active);

CREATE TABLE schedule_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  business_date date NOT NULL,
  timezone varchar(64) NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  kind shift_kind NOT NULL,
  shift_template_id uuid REFERENCES shift_templates(id),
  shift_snapshot jsonb NOT NULL,
  location_id uuid REFERENCES locations(id),
  location_snapshot jsonb,
  note text,
  status schedule_status NOT NULL DEFAULT 'scheduled',
  source schedule_source NOT NULL,
  source_rule_id uuid REFERENCES schedule_rules(id),
  version integer NOT NULL DEFAULT 1,
  locked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK ((kind = 'rest') OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at))
);
CREATE INDEX schedule_instances_owner_date_idx ON schedule_instances(owner_user_id, business_date) WHERE deleted_at IS NULL;
CREATE INDEX schedule_instances_workspace_date_idx ON schedule_instances(workspace_id, business_date) WHERE deleted_at IS NULL;
CREATE INDEX schedule_instances_rule_idx ON schedule_instances(source_rule_id) WHERE source_rule_id IS NOT NULL;

CREATE TABLE schedule_instance_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_instance_id uuid NOT NULL REFERENCES schedule_instances(id),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_reason text,
  changed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_instance_id, version)
);

CREATE TABLE schedule_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  schedule_instance_id uuid NOT NULL REFERENCES schedule_instances(id),
  requester_user_id uuid NOT NULL REFERENCES users(id),
  original_snapshot jsonb NOT NULL,
  requested_snapshot jsonb NOT NULL,
  reason text,
  status change_status NOT NULL DEFAULT 'pending',
  approver_user_id uuid REFERENCES users(id),
  approval_note text,
  decided_at timestamptz,
  idempotency_key varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX change_request_open_uq ON schedule_change_requests(schedule_instance_id) WHERE status = 'pending';
CREATE UNIQUE INDEX change_request_idempotency_uq ON schedule_change_requests(workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE weather_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(64) NOT NULL,
  location_key varchar(160) NOT NULL,
  forecast_date date NOT NULL,
  timezone varchar(64) NOT NULL,
  condition_code varchar(64),
  condition_text varchar(80),
  temperature_min numeric(5,2),
  temperature_max numeric(5,2),
  humidity_percent smallint,
  precipitation_probability smallint,
  wind_direction varchar(40),
  wind_level varchar(40),
  air_quality varchar(40),
  warning_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_payload jsonb,
  generated_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, location_key, forecast_date, timezone)
);
CREATE INDEX weather_expiry_idx ON weather_forecasts(expires_at);

CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  shift_reminders jsonb NOT NULL DEFAULT '[15]'::jsonb,
  weather_enabled boolean NOT NULL DEFAULT true,
  schedule_changes_enabled boolean NOT NULL DEFAULT true,
  approval_enabled boolean NOT NULL DEFAULT true,
  quiet_hours jsonb,
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  schedule_instance_id uuid REFERENCES schedule_instances(id),
  type varchar(64) NOT NULL,
  channel varchar(32) NOT NULL,
  trigger_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key varchar(200) NOT NULL UNIQUE,
  status notification_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_jobs_due_idx ON notification_jobs(status, trigger_at);

CREATE TABLE share_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  creator_user_id uuid NOT NULL REFERENCES users(id),
  range_start date NOT NULL,
  range_end date NOT NULL,
  privacy_options jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  template_code varchar(64) NOT NULL DEFAULT 'default',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CHECK (range_end >= range_start)
);

CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES share_snapshots(id),
  token_hash varchar(128) NOT NULL UNIQUE,
  mode varchar(16) NOT NULL DEFAULT 'snapshot',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id),
  actor_user_id uuid REFERENCES users(id),
  action varchar(120) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id varchar(80),
  request_id varchar(100),
  ip_hash varchar(128),
  user_agent_summary varchar(240),
  before_summary jsonb,
  after_summary jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_workspace_created_idx ON audit_logs(workspace_id, created_at DESC);

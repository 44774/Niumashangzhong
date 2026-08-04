import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { unique } from "drizzle-orm/pg-core";
import type {
  LocationSnapshot,
  ShiftSnapshot,
} from "@workcal/shared-types";

export const workspaceTypeEnum = pgEnum("workspace_type", ["personal", "organization"]);
export const memberStatusEnum = pgEnum("member_status", ["invited", "active", "suspended", "left"]);
export const shiftKindEnum = pgEnum("shift_kind", [
  "work",
  "rest",
  "leave",
  "training",
  "travel",
  "custom",
]);
export const scheduleStatusEnum = pgEnum("schedule_status", [
  "scheduled",
  "pending_approval",
  "cancelled",
  "completed",
]);
export const scheduleSourceEnum = pgEnum("schedule_source", [
  "manual",
  "rule",
  "template_copy",
  "import",
  "admin_batch",
  "temporary_change",
]);
export const changeStatusEnum = pgEnum("change_status", [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
  "expired",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    wechatOpenid: varchar("wechat_openid", { length: 128 }),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    avatarUrl: text("avatar_url"),
    locale: varchar("locale", { length: 16 }).notNull().default("zh-CN"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Shanghai"),
    weekStartsOn: smallint("week_starts_on").notNull().default(1),
    defaultCity: varchar("default_city", { length: 120 }),
    activeRuleId: uuid("active_rule_id"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("users_phone_uq").on(t.phone).where(sql`${t.phone} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    uniqueIndex("users_wechat_openid_uq")
      .on(t.wechatOpenid)
      .where(sql`${t.wechatOpenid} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: workspaceTypeEnum("type").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Shanghai"),
    defaultCity: varchar("default_city", { length: 120 }),
    logoUrl: text("logo_url"),
    settings: jsonb("settings").notNull().$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 120 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("departments_workspace_idx").on(t.workspaceId)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    departmentId: uuid("department_id").references(() => departments.id),
    roleCode: varchar("role_code", { length: 64 }).notNull().default("member"),
    status: memberStatusEnum("status").notNull().default("active"),
    employeeNo: varchar("employee_no", { length: 64 }),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("memberships_workspace_user_uq").on(t.workspaceId, t.userId),
    index("memberships_workspace_status_idx").on(t.workspaceId, t.status),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    name: varchar("name", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }),
    address: text("address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Shanghai"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [check("locations_scope_check", sql`${t.workspaceId} IS NOT NULL OR ${t.ownerUserId} IS NOT NULL`)],
);

export const shiftTemplates = pgTable(
  "shift_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: varchar("name", { length: 80 }).notNull(),
    shortName: varchar("short_name", { length: 12 }).notNull(),
    kind: shiftKindEnum("kind").notNull().default("work"),
    color: varchar("color", { length: 16 }).notNull(),
    icon: varchar("icon", { length: 64 }),
    startTime: time("start_time", { withTimezone: false }),
    endTime: time("end_time", { withTimezone: false }),
    endsNextDay: boolean("ends_next_day").notNull().default(false),
    unpaidBreakMinutes: integer("unpaid_break_minutes").notNull().default(0),
    defaultLocationId: uuid("default_location_id").references(() => locations.id),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("shift_templates_workspace_idx").on(t.workspaceId, t.isActive),
    check(
      "shift_templates_time_check",
      sql`(${t.kind} = 'rest') OR (${t.startTime} IS NOT NULL AND ${t.endTime} IS NOT NULL)`,
    ),
  ],
);

export const scheduleRules = pgTable(
  "schedule_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 120 }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    sequence: jsonb("sequence").notNull().$type<Array<{ shiftTemplateId: string }>>(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    generationHorizonDays: integer("generation_horizon_days").notNull().default(90),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("schedule_rules_owner_idx").on(t.ownerUserId, t.isActive)],
);

export const scheduleInstances = pgTable(
  "schedule_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    kind: shiftKindEnum("kind").notNull(),
    shiftTemplateId: uuid("shift_template_id").references(() => shiftTemplates.id),
    shiftSnapshot: jsonb("shift_snapshot").notNull().$type<ShiftSnapshot>(),
    locationId: uuid("location_id").references(() => locations.id),
    locationSnapshot: jsonb("location_snapshot").$type<LocationSnapshot | null>(),
    note: text("note"),
    status: scheduleStatusEnum("status").notNull().default("scheduled"),
    source: scheduleSourceEnum("source").notNull(),
    sourceRuleId: uuid("source_rule_id").references(() => scheduleRules.id),
    version: integer("version").notNull().default(1),
    locked: boolean("locked").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("schedule_instances_owner_date_idx")
      .on(t.ownerUserId, t.businessDate)
      .where(sql`${t.deletedAt} IS NULL`),
    index("schedule_instances_workspace_date_idx")
      .on(t.workspaceId, t.businessDate)
      .where(sql`${t.deletedAt} IS NULL`),
    index("schedule_instances_rule_idx")
      .on(t.sourceRuleId)
      .where(sql`${t.sourceRuleId} IS NOT NULL`),
    check(
      "schedule_instances_time_check",
      sql`(${t.kind} = 'rest') OR (${t.startsAt} IS NOT NULL AND ${t.endsAt} IS NOT NULL AND ${t.endsAt} > ${t.startsAt})`,
    ),
  ],
);

export const scheduleInstanceVersions = pgTable(
  "schedule_instance_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleInstanceId: uuid("schedule_instance_id")
      .notNull()
      .references(() => scheduleInstances.id),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull().$type<ShiftSnapshot>(),
    changeReason: text("change_reason"),
    changedBy: uuid("changed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique("schedule_instance_versions_uq").on(t.scheduleInstanceId, t.version)],
);

export const scheduleChangeRequests = pgTable(
  "schedule_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    scheduleInstanceId: uuid("schedule_instance_id")
      .notNull()
      .references(() => scheduleInstances.id),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id),
    businessDate: date("business_date", { mode: "string" }),
    originalSnapshot: jsonb("original_snapshot").notNull().$type<ShiftSnapshot>(),
    requestedSnapshot: jsonb("requested_snapshot").notNull().$type<ShiftSnapshot>(),
    reason: text("reason"),
    status: changeStatusEnum("status").notNull().default("pending"),
    approverUserId: uuid("approver_user_id").references(() => users.id),
    approvalNote: text("approval_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("change_request_open_uq")
      .on(t.scheduleInstanceId)
      .where(sql`${t.status} = 'pending'`),
    uniqueIndex("change_request_idempotency_uq")
      .on(t.workspaceId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  ],
);

export const weatherForecasts = pgTable(
  "weather_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 64 }).notNull(),
    locationKey: varchar("location_key", { length: 160 }).notNull(),
    forecastDate: date("forecast_date", { mode: "string" }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    conditionCode: varchar("condition_code", { length: 64 }),
    conditionText: varchar("condition_text", { length: 80 }),
    temperatureMin: numeric("temperature_min", { precision: 5, scale: 2 }),
    temperatureMax: numeric("temperature_max", { precision: 5, scale: 2 }),
    humidityPercent: smallint("humidity_percent"),
    precipitationProbability: smallint("precipitation_probability"),
    windDirection: varchar("wind_direction", { length: 40 }),
    windLevel: varchar("wind_level", { length: 40 }),
    airQuality: varchar("air_quality", { length: 40 }),
    warningCodes: jsonb("warning_codes").notNull().$type<string[]>().default([]),
    rawPayload: jsonb("raw_payload"),
    generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("weather_forecasts_uq").on(t.provider, t.locationKey, t.forecastDate, t.timezone),
    index("weather_expiry_idx").on(t.expiresAt),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    shiftReminders: jsonb("shift_reminders").notNull().$type<number[]>().default([15]),
    weatherEnabled: boolean("weather_enabled").notNull().default(true),
    scheduleChangesEnabled: boolean("schedule_changes_enabled").notNull().default(true),
    approvalEnabled: boolean("approval_enabled").notNull().default(true),
    quietHours: jsonb("quiet_hours").$type<{ start: string; end: string } | null>(),
    channels: jsonb("channels").notNull().$type<Record<string, boolean>>().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique("notification_preferences_uq").on(t.userId, t.workspaceId)],
);

export const notificationJobs = pgTable(
  "notification_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    scheduleInstanceId: uuid("schedule_instance_id").references(() => scheduleInstances.id),
    type: varchar("type", { length: 64 }).notNull(),
    channel: varchar("channel", { length: 32 }).notNull(),
    triggerAt: timestamp("trigger_at", { withTimezone: true, mode: "date" }).notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("notification_jobs_idempotency_uq").on(t.idempotencyKey),
    index("notification_jobs_due_idx").on(t.status, t.triggerAt),
  ],
);

export const shareSnapshots = pgTable(
  "share_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    creatorUserId: uuid("creator_user_id")
      .notNull()
      .references(() => users.id),
    rangeStart: date("range_start", { mode: "string" }).notNull(),
    rangeEnd: date("range_end", { mode: "string" }).notNull(),
    privacyOptions: jsonb("privacy_options").notNull().$type<Record<string, boolean>>(),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
    templateCode: varchar("template_code", { length: 64 }).notNull().default("default"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [check("share_snapshots_range_check", sql`${t.rangeEnd} >= ${t.rangeStart}`)],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => shareSnapshots.id),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    mode: varchar("mode", { length: 16 }).notNull().default("snapshot"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("share_links_token_hash_uq").on(t.tokenHash)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: varchar("resource_id", { length: 80 }),
    requestId: varchar("request_id", { length: 100 }),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgentSummary: varchar("user_agent_summary", { length: 240 }),
    beforeSummary: jsonb("before_summary"),
    afterSummary: jsonb("after_summary"),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

export const idempotencyEntries = pgTable(
  "idempotency_entries",
  {
    idempotencyKey: varchar("idempotency_key", { length: 128 }).primaryKey(),
    scope: varchar("scope", { length: 64 }).notNull(),
    response: jsonb("response").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("idempotency_scope_idx").on(t.scope)],
);

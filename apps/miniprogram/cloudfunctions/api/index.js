"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// apps/miniprogram/cloudfunctions/api/src/index.ts
var import_wx_server_sdk2 = __toESM(require("wx-server-sdk"));

// apps/miniprogram/cloudfunctions/api/src/db.ts
var import_wx_server_sdk = __toESM(require("wx-server-sdk"));

// packages/schedule-engine/dist/time.js
var DAY_MINUTES = 24 * 60;
function toMinutes(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new Error(`\u975E\u6CD5\u65F6\u95F4\u683C\u5F0F: ${time}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
function addDays(date, days) {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}
function parseDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`\u975E\u6CD5\u65E5\u671F: ${date}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
function toDateString(d) {
  return d.toISOString().slice(0, 10);
}
function todayInTimezone(timezone) {
  const now = /* @__PURE__ */ new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get3 = (type) => {
    var _a;
    return ((_a = parts.find((p) => p.type === type)) == null ? void 0 : _a.value) ?? "";
  };
  return `${get3("year")}-${get3("month")}-${get3("day")}`;
}
function zonedTimeToIso(businessDate, time, timezone) {
  const offsetMinutes = timezoneOffsetMinutes(businessDate, timezone);
  const date = parseDate(businessDate);
  const minutes = toMinutes(time);
  const utc = new Date(date.getTime() + (minutes - offsetMinutes) * 6e4);
  return utc.toISOString();
}
function timezoneOffsetMinutes(date, timezone) {
  try {
    const probe = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(probe);
    const get3 = (type) => {
      var _a;
      return Number(((_a = parts.find((p) => p.type === type)) == null ? void 0 : _a.value) ?? 0);
    };
    const local = new Date(Date.UTC(get3("year"), get3("month") - 1, get3("day"), get3("hour") % 24, get3("minute"), get3("second")));
    return (local.getTime() - probe.getTime()) / 6e4;
  } catch {
    return 480;
  }
}

// packages/schedule-engine/dist/conflict.js
function intervalsOverlap(a, b) {
  if (!a.startsAt || !a.endsAt || !b.startsAt || !b.endsAt)
    return false;
  if (a.kind === "rest" || b.kind === "rest")
    return false;
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}
function findOverlapConflicts(candidate, existing) {
  const result = [];
  for (const item of existing) {
    if (item.id !== candidate.id && intervalsOverlap(candidate, item)) {
      result.push({
        existingId: item.id,
        message: `\u8BE5\u65F6\u6BB5\u4E0E ${item.id} \u91CD\u53E0`
      });
    }
  }
  return result;
}

// apps/miniprogram/cloudfunctions/api/src/util.ts
var CloudError = class extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
};
function ok(data) {
  return { ok: true, data };
}
function fail(err) {
  if (err instanceof CloudError) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  const message = err instanceof Error ? err.message : "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF";
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}
function assert(cond, code, message, statusCode = 400) {
  if (!cond) {
    throw new CloudError(code, message, statusCode);
  }
}
function assertDate(date) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "VALIDATION_ERROR", "\u65E5\u671F\u683C\u5F0F\u5FC5\u987B\u4E3A YYYY-MM-DD");
}
function assertTime(time) {
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(time), "VALIDATION_ERROR", "\u65F6\u95F4\u683C\u5F0F\u5FC5\u987B\u4E3A HH:mm");
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function docId(parts) {
  return parts.join("_");
}

// apps/miniprogram/cloudfunctions/api/src/db.ts
import_wx_server_sdk.default.init({ env: import_wx_server_sdk.default.DYNAMIC_CURRENT_ENV });
var db = import_wx_server_sdk.default.database();
var _ = db.command;
var DEFAULT_TEMPLATES = [
  {
    name: "\u65E9\u73ED",
    shortName: "\u65E9\u73ED",
    kind: "work",
    color: "#10B981",
    startTime: "09:00",
    endTime: "17:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 1
  },
  {
    name: "\u665A\u73ED",
    shortName: "\u665A\u73ED",
    kind: "work",
    color: "#2F80ED",
    startTime: "13:00",
    endTime: "21:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 2
  },
  {
    name: "\u591C\u73ED",
    shortName: "\u591C\u73ED",
    kind: "work",
    color: "#7C3AED",
    startTime: "21:00",
    endTime: "07:00",
    endsNextDay: true,
    unpaidBreakMinutes: 0,
    sortOrder: 3
  },
  {
    name: "\u4F11\u606F",
    shortName: "\u4F11",
    kind: "rest",
    color: "#94A3B8",
    startTime: null,
    endTime: null,
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    sortOrder: 4
  }
];
async function ensureUserAndWorkspace(openid, displayName, avatarUrl) {
  let user = null;
  try {
    const res = await db.collection("users").doc(openid).get();
    user = res.data;
  } catch {
    user = null;
  }
  const now = nowIso();
  if (!user) {
    user = {
      _id: openid,
      openid,
      displayName: (displayName == null ? void 0 : displayName.trim()) || "\u5FAE\u4FE1\u7528\u6237",
      avatarUrl: avatarUrl ?? null,
      activeRuleId: null,
      defaultCity: "\u6DF1\u5733",
      timezone: "Asia/Shanghai",
      createdAt: now,
      updatedAt: now
    };
    const userData = { ...user };
    delete userData._id;
    await db.collection("users").doc(openid).set({ data: userData });
  } else {
    const patch = {};
    if (displayName == null ? void 0 : displayName.trim()) patch.displayName = displayName.trim();
    if (avatarUrl !== void 0 && avatarUrl !== null) patch.avatarUrl = avatarUrl;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now;
      await db.collection("users").doc(openid).update({ data: patch });
      user = { ...user, ...patch };
    }
  }
  const workspaceRes = await db.collection("workspaces").where({ ownerOpenid: openid, type: "personal" }).limit(1).get();
  let workspace = workspaceRes.data[0];
  if (!workspace) {
    const added = await db.collection("workspaces").add({
      data: {
        type: "personal",
        name: `${user.displayName}\u7684\u4E2A\u4EBA\u7A7A\u95F4`,
        ownerOpenid: openid,
        timezone: user.timezone,
        defaultCity: user.defaultCity,
        createdAt: now
      }
    });
    workspace = {
      _id: added._id,
      type: "personal",
      name: `${user.displayName}\u7684\u4E2A\u4EBA\u7A7A\u95F4`,
      ownerOpenid: openid,
      timezone: user.timezone,
      defaultCity: user.defaultCity,
      createdAt: now
    };
    await db.collection("memberships").doc(docId([workspace._id, openid])).set({
      data: {
        workspaceId: workspace._id,
        openid,
        roleCode: "owner",
        status: "active",
        joinedAt: now
      }
    });
    for (const tpl of DEFAULT_TEMPLATES) {
      await db.collection("shiftTemplates").add({
        data: {
          workspaceId: workspace._id,
          name: tpl.name,
          shortName: tpl.shortName,
          kind: tpl.kind,
          color: tpl.color,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          endsNextDay: tpl.endsNextDay,
          unpaidBreakMinutes: tpl.unpaidBreakMinutes,
          sortOrder: tpl.sortOrder,
          isActive: true,
          version: 1,
          createdAt: now,
          updatedAt: now
        }
      });
    }
    const defaultRuleId = await ensureDefaultRule(openid, workspace);
    if (defaultRuleId) {
      user = { ...user, activeRuleId: defaultRuleId };
    }
  }
  return { user, workspace };
}
async function ensureDefaultRule(openid, workspace) {
  const rulesRes = await db.collection("scheduleRules").where({ workspaceId: workspace._id, ownerOpenid: openid, isActive: true }).limit(1).get();
  if (rulesRes.data.length > 0) return null;
  const instancesRes = await db.collection("scheduleInstances").where({ workspaceId: workspace._id, ownerOpenid: openid }).limit(1).get();
  if (instancesRes.data.length > 0) return null;
  const templatesRes = await db.collection("shiftTemplates").where({ workspaceId: workspace._id, isActive: true }).orderBy("sortOrder", "asc").limit(20).get();
  if (templatesRes.data.length === 0) return null;
  const now = nowIso();
  const added = await db.collection("scheduleRules").add({
    data: {
      workspaceId: workspace._id,
      ownerOpenid: openid,
      name: "\u521D\u59CB\u6392\u73ED\u8868",
      startDate: todayInTimezone(workspace.timezone),
      endDate: null,
      sequence: templatesRes.data.map((t) => ({ shiftTemplateId: t._id })),
      timezone: workspace.timezone,
      generationHorizonDays: 90,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    }
  });
  const ruleId = added._id;
  await db.collection("users").doc(openid).update({
    data: { activeRuleId: ruleId, updatedAt: now }
  });
  return ruleId;
}
async function requireWorkspace(openid, workspaceId) {
  if (!workspaceId) {
    throw new CloudError("FORBIDDEN", "\u7F3A\u5C11\u5DE5\u4F5C\u7A7A\u95F4 ID", 403);
  }
  try {
    const res = await db.collection("memberships").doc(docId([workspaceId, openid])).get();
    if (!res.data) {
      throw new Error("not found");
    }
  } catch {
    throw new CloudError("FORBIDDEN", "\u65E0\u6743\u8BBF\u95EE\u8BE5\u5DE5\u4F5C\u7A7A\u95F4", 403);
  }
}
async function getWorkspace(workspaceId) {
  const res = await db.collection("workspaces").doc(workspaceId).get();
  if (!res.data) {
    throw new CloudError("NOT_FOUND", "\u5DE5\u4F5C\u7A7A\u95F4\u4E0D\u5B58\u5728", 404);
  }
  return res.data;
}
async function writeAudit(openid, workspaceId, action, resourceType, resourceId, afterSummary) {
  await db.collection("auditLogs").add({
    data: {
      workspaceId,
      actorOpenid: openid,
      action,
      resourceType,
      resourceId,
      afterSummary,
      createdAt: nowIso()
    }
  });
}

// apps/miniprogram/cloudfunctions/api/src/map.ts
function toUser(doc) {
  return {
    id: doc.openid ?? doc._id,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl ?? null,
    timezone: doc.timezone,
    locale: "zh-CN",
    defaultCity: doc.defaultCity ?? null,
    defaultLocation: doc.defaultLocation ?? null
  };
}
function toWorkspace(doc) {
  return {
    id: doc._id,
    type: doc.type,
    name: doc.name,
    timezone: doc.timezone,
    roleCode: "owner"
  };
}
function toShiftTemplate(doc) {
  return {
    id: doc._id,
    name: doc.name,
    shortName: doc.shortName,
    kind: doc.kind,
    color: doc.color,
    startTime: doc.startTime ? String(doc.startTime).slice(0, 5) : null,
    endTime: doc.endTime ? String(doc.endTime).slice(0, 5) : null,
    endsNextDay: Boolean(doc.endsNextDay),
    unpaidBreakMinutes: doc.unpaidBreakMinutes ?? 0,
    defaultLocationId: doc.defaultLocationId ?? null,
    version: doc.version ?? 1,
    isActive: doc.isActive !== false,
    sortOrder: doc.sortOrder ?? 0
  };
}
function toScheduleInstance(doc) {
  return {
    id: doc._id,
    ownerUserId: doc.ownerOpenid,
    businessDate: doc.businessDate,
    timezone: doc.timezone,
    startsAt: doc.startsAt ?? null,
    endsAt: doc.endsAt ?? null,
    kind: doc.kind,
    status: doc.status,
    source: doc.source,
    shiftSnapshot: doc.shiftSnapshot,
    locationSnapshot: doc.locationSnapshot ?? null,
    note: doc.note ?? null,
    version: doc.version ?? 1
  };
}
function toChangeRequest(doc) {
  return {
    id: doc._id,
    scheduleInstanceId: doc.scheduleInstanceId,
    businessDate: doc.businessDate ?? (doc.createdAt ? doc.createdAt.slice(0, 10) : void 0),
    status: doc.status,
    originalSnapshot: doc.originalSnapshot,
    requestedSnapshot: doc.requestedSnapshot,
    reason: doc.reason ?? null,
    approvalNote: doc.approvalNote ?? null,
    createdAt: doc.createdAt,
    decidedAt: doc.decidedAt ?? null
  };
}
function toShareSnapshot(doc) {
  var _a, _b;
  return {
    id: doc._id,
    ownerDisplayName: ((_a = doc.snapshot) == null ? void 0 : _a.ownerDisplayName) ?? null,
    rangeStart: doc.rangeStart,
    rangeEnd: doc.rangeEnd,
    templateCode: doc.templateCode,
    privacyOptions: doc.privacyOptions,
    entries: ((_b = doc.snapshot) == null ? void 0 : _b.entries) ?? [],
    createdAt: doc.createdAt
  };
}

// apps/miniprogram/cloudfunctions/api/src/shift.ts
function validate(input) {
  var _a, _b;
  assert((_a = input.name) == null ? void 0 : _a.trim(), "VALIDATION_ERROR", "\u73ED\u6B21\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  assert((_b = input.shortName) == null ? void 0 : _b.trim(), "VALIDATION_ERROR", "\u73ED\u6B21\u7B80\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  if (input.kind === "work") {
    assert(input.startTime && input.endTime, "VALIDATION_ERROR", "\u5DE5\u4F5C\u7C7B\u73ED\u6B21\u5FC5\u987B\u586B\u5199\u5F00\u59CB\u548C\u7ED3\u675F\u65F6\u95F4");
  }
}
async function list(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  const where = { workspaceId: payload.workspaceId };
  if (payload.active === true) {
    where.isActive = true;
  }
  const res = await db.collection("shiftTemplates").where(where).orderBy("sortOrder", "asc").limit(100).get();
  return res.data.map(toShiftTemplate);
}
async function create(openid, input) {
  await requireWorkspace(openid, input.workspaceId);
  validate(input);
  const now = nowIso();
  const added = await db.collection("shiftTemplates").add({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      shortName: input.shortName.trim().slice(0, 12),
      kind: input.kind,
      color: input.color,
      startTime: input.startTime,
      endTime: input.endTime,
      endsNextDay: Boolean(input.endsNextDay),
      unpaidBreakMinutes: input.unpaidBreakMinutes ?? 0,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    }
  });
  const res = await db.collection("shiftTemplates").doc(added._id).get();
  await writeAudit(openid, input.workspaceId, "shift.create", "shiftTemplate", added._id, {
    name: input.name
  });
  return toShiftTemplate(res.data);
}
async function update(openid, input) {
  await requireWorkspace(openid, input.workspaceId);
  validate(input);
  const data = {
    name: input.name.trim(),
    shortName: input.shortName.trim().slice(0, 12),
    kind: input.kind,
    color: input.color,
    startTime: input.startTime,
    endTime: input.endTime,
    endsNextDay: Boolean(input.endsNextDay),
    unpaidBreakMinutes: input.unpaidBreakMinutes ?? 0,
    sortOrder: input.sortOrder ?? 0,
    version: _.inc(1),
    updatedAt: nowIso()
  };
  if (typeof input.isActive === "boolean") {
    data.isActive = input.isActive;
  }
  const res = await db.collection("shiftTemplates").where({ _id: input.id, workspaceId: input.workspaceId, version: input.version }).update({ data });
  if (res.stats.updated === 0) {
    throw new CloudError("VERSION_CONFLICT", "\u6570\u636E\u5DF2\u88AB\u4FEE\u6539\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5", 409);
  }
  const doc = await db.collection("shiftTemplates").doc(input.id).get();
  await writeAudit(openid, input.workspaceId, "shift.update", "shiftTemplate", input.id, {
    name: input.name
  });
  return toShiftTemplate(doc.data);
}

// apps/miniprogram/cloudfunctions/api/src/weather.ts
var WMO_MAP = {
  0: { text: "\u6674", code: "sunny", warnings: [] },
  1: { text: "\u6674\u95F4\u591A\u4E91", code: "partly_cloudy", warnings: [] },
  2: { text: "\u591A\u4E91", code: "cloudy", warnings: [] },
  3: { text: "\u9634", code: "overcast", warnings: [] },
  45: { text: "\u96FE", code: "fog", warnings: [] },
  48: { text: "\u96FE\u51C7", code: "fog", warnings: [] },
  51: { text: "\u6BDB\u6BDB\u96E8", code: "drizzle", warnings: [] },
  53: { text: "\u6BDB\u6BDB\u96E8", code: "drizzle", warnings: [] },
  55: { text: "\u6BDB\u6BDB\u96E8", code: "drizzle", warnings: [] },
  56: { text: "\u51BB\u6BDB\u6BDB\u96E8", code: "freezing_drizzle", warnings: ["ice"] },
  57: { text: "\u51BB\u6BDB\u6BDB\u96E8", code: "freezing_drizzle", warnings: ["ice"] },
  61: { text: "\u5C0F\u96E8", code: "rain", warnings: [] },
  63: { text: "\u4E2D\u96E8", code: "rain", warnings: [] },
  65: { text: "\u5927\u96E8", code: "rain", warnings: [] },
  66: { text: "\u51BB\u96E8", code: "freezing_rain", warnings: ["ice"] },
  67: { text: "\u51BB\u96E8", code: "freezing_rain", warnings: ["ice"] },
  71: { text: "\u5C0F\u96EA", code: "snow", warnings: [] },
  73: { text: "\u4E2D\u96EA", code: "snow", warnings: [] },
  75: { text: "\u5927\u96EA", code: "snow", warnings: [] },
  77: { text: "\u96EA\u7C92", code: "snow", warnings: [] },
  80: { text: "\u9635\u96E8", code: "shower", warnings: [] },
  81: { text: "\u9635\u96E8", code: "shower", warnings: [] },
  82: { text: "\u5F3A\u9635\u96E8", code: "shower", warnings: [] },
  85: { text: "\u9635\u96EA", code: "snow", warnings: [] },
  86: { text: "\u9635\u96EA", code: "snow", warnings: [] },
  95: { text: "\u96F7\u9635\u96E8", code: "thunderstorm", warnings: ["storm"] },
  96: { text: "\u96F7\u9635\u96E8\u4F34\u51B0\u96F9", code: "thunderstorm", warnings: ["storm", "hail"] },
  99: { text: "\u96F7\u9635\u96E8\u4F34\u51B0\u96F9", code: "thunderstorm", warnings: ["storm", "hail"] }
};
function mapWeatherCode(code) {
  return WMO_MAP[code] ?? { text: "\u672A\u77E5\u5929\u6C14", code: "unknown", warnings: [] };
}
function locationKey(location) {
  return `loc:${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}
async function openMeteo(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo \u8FD4\u56DE ${res.status}`);
  }
  return res.json();
}
function toForecast(location, date, daily, index) {
  var _a, _b, _c, _d, _e;
  const code = ((_a = daily.weather_code) == null ? void 0 : _a[index]) ?? 0;
  const mapped = mapWeatherCode(Number(code));
  const max = (_b = daily.temperature_2m_max) == null ? void 0 : _b[index];
  const min = (_c = daily.temperature_2m_min) == null ? void 0 : _c[index];
  const warnings = [...mapped.warnings];
  if (max != null && Number(max) >= 35) warnings.push("heat");
  if (min != null && Number(min) <= 0) warnings.push("cold");
  return {
    date,
    conditionCode: mapped.code,
    conditionText: mapped.text,
    temperatureMin: min != null ? Number(min) : 0,
    temperatureMax: max != null ? Number(max) : 0,
    humidityPercent: null,
    precipitationProbability: ((_d = daily.precipitation_probability_max) == null ? void 0 : _d[index]) ?? null,
    windDirection: null,
    windLevel: ((_e = daily.wind_speed_10m_max) == null ? void 0 : _e[index]) != null ? `${daily.wind_speed_10m_max[index]}km/h` : null,
    airQuality: null,
    warningCodes: warnings,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function minDate(a, b) {
  return a <= b ? a : b;
}
function maxDate(a, b) {
  return a >= b ? a : b;
}
async function forecastRange(location, from, to) {
  const today = todayInTimezone("Asia/Shanghai");
  const pastLimit = addDays(today, -92);
  const futureLimit = addDays(today, 16);
  const archiveStart = from < pastLimit ? from : null;
  const archiveEnd = archiveStart ? minDate(to, addDays(pastLimit, -1)) : null;
  const forecastStart = maxDate(from, pastLimit);
  const forecastEnd = minDate(to, futureLimit);
  const baseParams = "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FShanghai";
  const jobs = [];
  if (archiveStart && archiveEnd && archiveStart <= archiveEnd) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${archiveStart}&end_date=${archiveEnd}&${baseParams}`;
    jobs.push(
      openMeteo(url).then((data) => {
        const daily = data.daily ?? {};
        return (daily.time ?? []).map((date, i) => ({
          date,
          item: toForecast(location, date, daily, i)
        }));
      })
    );
  }
  if (forecastStart <= forecastEnd) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${forecastStart}&end_date=${forecastEnd}&${baseParams}`;
    jobs.push(
      openMeteo(url).then((data) => {
        const daily = data.daily ?? {};
        return (daily.time ?? []).map((date, i) => ({
          date,
          item: toForecast(location, date, daily, i)
        }));
      })
    );
  }
  const settled = await Promise.allSettled(jobs);
  const rows = [];
  for (const s of settled) {
    if (s.status === "fulfilled") rows.push(...s.value);
  }
  const byDate = new Map(rows.map((r) => [r.date, r.item]));
  const key = locationKey(location);
  const result = [];
  let cursor = from;
  while (cursor <= to) {
    const item = byDate.get(cursor);
    if (item) {
      await db.collection("weatherCache").doc(`${key}_${cursor}`).set({
        data: {
          locationKey: key,
          date: cursor,
          timezone: "Asia/Shanghai",
          ...item,
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1e3).toISOString()
        }
      });
      result.push(item);
    }
    cursor = addDays(cursor, 1);
  }
  return result;
}
async function resolveLocation(openid, location) {
  var _a;
  if (location && typeof location.latitude === "number" && typeof location.longitude === "number") {
    return location;
  }
  try {
    const userRes = await db.collection("users").doc(openid).get();
    const def = (_a = userRes.data) == null ? void 0 : _a.defaultLocation;
    if (def && typeof def.latitude === "number" && typeof def.longitude === "number") {
      return def;
    }
  } catch {
  }
  return { name: "\u6DF1\u5733", latitude: 22.5431, longitude: 114.0579 };
}
async function get(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  assertDate(payload.from);
  assertDate(payload.to);
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from \u4E0D\u80FD\u665A\u4E8E to");
  }
  const location = await resolveLocation(openid, payload.location);
  try {
    return await forecastRange(location, payload.from, payload.to);
  } catch (err) {
    console.warn("[weather] Open-Meteo \u83B7\u53D6\u5931\u8D25\uFF0C\u56DE\u9000\u7F13\u5B58", err.message);
    const key = locationKey(location);
    const cached = await db.collection("weatherCache").where({ locationKey: key, date: _.gte(payload.from).and(_.lte(payload.to)) }).limit(100).get();
    return cached.data.filter((row) => new Date(row.expiresAt).getTime() > Date.now()).map((row) => {
      const copy = { ...row };
      delete copy.locationKey;
      delete copy.expiresAt;
      return copy;
    });
  }
}
async function getForDate(openid, date) {
  const location = await resolveLocation(openid);
  const list4 = await forecastRange(location, date, date);
  return list4[0] ?? null;
}

// apps/miniprogram/cloudfunctions/api/src/holiday.ts
var HOLIDAY_MIN_YEAR = 2019;
var API_BASE = "https://timor.tech/api/holiday/year/";
async function syncYear(year) {
  const res = await fetch(`${API_BASE}${year}`);
  if (!res.ok) {
    throw new CloudError("HOLIDAY_FETCH_FAILED", `\u8282\u5047\u65E5\u63A5\u53E3\u8FD4\u56DE ${res.status}`, 502);
  }
  const data = await res.json();
  const days = {};
  const map = (data == null ? void 0 : data.holiday) ?? {};
  for (const key of Object.keys(map)) {
    const item = map[key];
    if (!item || typeof item.holiday !== "boolean") continue;
    const date = item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : `${year}-${key}`;
    days[date] = item.holiday ? "holiday" : "workday";
  }
  await db.collection("holidays").doc(`year:${year}`).set({
    data: {
      year,
      days,
      source: "timor.tech",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return { year, count: Object.keys(days).length };
}
async function syncRange(fromYear, toYear) {
  const results = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    try {
      results.push(await syncYear(year));
    } catch (err) {
      console.warn(`[holiday] ${year} \u540C\u6B65\u5931\u8D25:`, err.message);
    }
  }
  return results;
}
async function readHolidayRange(from, to) {
  var _a;
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const out = {};
  for (let year = fromYear; year <= toYear; year += 1) {
    try {
      const doc = await db.collection("holidays").doc(`year:${year}`).get();
      const days = (_a = doc.data) == null ? void 0 : _a.days;
      if (days) {
        for (const [date, type] of Object.entries(days)) {
          if (date >= from && date <= to) {
            out[date] = type;
          }
        }
      }
    } catch {
    }
  }
  return out;
}
async function ensureYears(fromYear, toYear) {
  for (let year = fromYear; year <= toYear; year += 1) {
    try {
      await db.collection("holidays").doc(`year:${year}`).get();
    } catch {
      try {
        await syncYear(year);
      } catch (err) {
        console.warn(`[holiday] ${year} \u61D2\u52A0\u8F7D\u5931\u8D25:`, err.message);
      }
    }
  }
}
async function getRange(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.from) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.to)) {
    throw new CloudError("VALIDATION_ERROR", "\u65E5\u671F\u683C\u5F0F\u5FC5\u987B\u4E3A YYYY-MM-DD");
  }
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from \u4E0D\u80FD\u665A\u4E8E to");
  }
  const fromYear = Math.max(HOLIDAY_MIN_YEAR, Number(payload.from.slice(0, 4)));
  const toYear = Number(payload.to.slice(0, 4));
  await ensureYears(fromYear, toYear);
  return readHolidayRange(payload.from, payload.to);
}
async function sync(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const fromYear = Math.max(HOLIDAY_MIN_YEAR, currentYear - 1);
  const synced = await syncRange(fromYear, currentYear + 1);
  return { synced };
}

// apps/miniprogram/cloudfunctions/api/src/notify.ts
var DEFAULTS = {
  shiftReminders: [15],
  weatherEnabled: true,
  scheduleChangesEnabled: true,
  approvalEnabled: true,
  holidayOvertimeEnabled: true,
  quietHours: null,
  channels: { wechat: true }
};
async function get2(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  try {
    const res = await db.collection("notificationPrefs").doc(docId([openid, payload.workspaceId])).get();
    if (res.data) {
      return {
        shiftReminders: res.data.shiftReminders ?? DEFAULTS.shiftReminders,
        weatherEnabled: res.data.weatherEnabled ?? DEFAULTS.weatherEnabled,
        scheduleChangesEnabled: res.data.scheduleChangesEnabled ?? DEFAULTS.scheduleChangesEnabled,
        approvalEnabled: res.data.approvalEnabled ?? DEFAULTS.approvalEnabled,
        holidayOvertimeEnabled: res.data.holidayOvertimeEnabled ?? DEFAULTS.holidayOvertimeEnabled,
        quietHours: res.data.quietHours ?? DEFAULTS.quietHours,
        channels: res.data.channels ?? DEFAULTS.channels
      };
    }
  } catch {
  }
  return { ...DEFAULTS };
}
async function save(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  const prefs = payload.prefs ?? {};
  const shiftReminders = Array.isArray(prefs.shiftReminders) ? prefs.shiftReminders.filter((m) => Number.isInteger(m) && m >= 0 && m <= 10080).slice(0, 5) : [15];
  const saved = {
    shiftReminders,
    weatherEnabled: Boolean(prefs.weatherEnabled ?? true),
    scheduleChangesEnabled: Boolean(prefs.scheduleChangesEnabled ?? true),
    approvalEnabled: Boolean(prefs.approvalEnabled ?? true),
    holidayOvertimeEnabled: Boolean(prefs.holidayOvertimeEnabled ?? true),
    quietHours: prefs.quietHours ?? null,
    channels: prefs.channels ?? { wechat: true }
  };
  await db.collection("notificationPrefs").doc(docId([openid, payload.workspaceId])).set({
    data: {
      openid,
      workspaceId: payload.workspaceId,
      ...saved,
      updatedAt: nowIso()
    }
  });
  return saved;
}
async function rebuildJobs(openid, workspaceId, instance, prefs) {
  var _a, _b, _c, _d;
  await db.collection("notificationJobs").where({ instanceId: instance._id, status: "pending" }).remove();
  if (!instance.startsAt) return;
  const holidayMap = await readHolidayRange(instance.businessDate, instance.businessDate);
  const overtime = prefs.holidayOvertimeEnabled !== false && instance.kind !== "rest" && holidayMap[instance.businessDate] === "holiday";
  const start = new Date(instance.startsAt);
  for (const minutes of prefs.shiftReminders ?? []) {
    const triggerAt = new Date(start.getTime() - minutes * 6e4);
    if (triggerAt.getTime() <= Date.now()) continue;
    await db.collection("notificationJobs").add({
      data: {
        openid,
        workspaceId,
        instanceId: instance._id,
        type: "shift_reminder",
        channel: "wechat_subscribe",
        triggerAt: triggerAt.toISOString(),
        payload: {
          businessDate: instance.businessDate,
          shiftName: (_a = instance.shiftSnapshot) == null ? void 0 : _a.name,
          startTime: (_b = instance.shiftSnapshot) == null ? void 0 : _b.startTime,
          endTime: (_c = instance.shiftSnapshot) == null ? void 0 : _c.endTime,
          reminderMinutes: minutes,
          version: instance.version,
          overtime
        },
        status: "pending",
        createdAt: nowIso()
      }
    });
  }
  if (prefs.weatherEnabled) {
    await db.collection("notificationJobs").add({
      data: {
        openid,
        workspaceId,
        instanceId: instance._id,
        type: "weather_reminder",
        channel: "wechat_subscribe",
        triggerAt: instance.startsAt,
        payload: {
          businessDate: instance.businessDate,
          shiftName: (_d = instance.shiftSnapshot) == null ? void 0 : _d.name,
          version: instance.version,
          overtime
        },
        status: "pending",
        createdAt: nowIso()
      }
    });
  }
}

// apps/miniprogram/cloudfunctions/api/src/schedule.ts
function snapshotFromTemplate(tpl) {
  return {
    name: tpl.name,
    shortName: tpl.shortName,
    kind: tpl.kind,
    color: tpl.color,
    startTime: tpl.startTime ? String(tpl.startTime).slice(0, 5) : null,
    endTime: tpl.endTime ? String(tpl.endTime).slice(0, 5) : null,
    endsNextDay: Boolean(tpl.endsNextDay),
    unpaidBreakMinutes: tpl.unpaidBreakMinutes ?? 0
  };
}
function normalizeSnapshot(input) {
  var _a, _b;
  const kind = input.kind ?? "custom";
  const startTime = input.startTime ?? null;
  const endTime = input.endTime ?? null;
  if (kind === "work" && (!startTime || !endTime)) {
    throw new CloudError("VALIDATION_ERROR", "\u5DE5\u4F5C\u7C7B\u73ED\u6B21\u5FC5\u987B\u586B\u5199\u5F00\u59CB\u548C\u7ED3\u675F\u65F6\u95F4");
  }
  if (startTime) assertTime(startTime);
  if (endTime) assertTime(endTime);
  const endsNextDay = Boolean(input.endsNextDay) || !!startTime && !!endTime && endTime <= startTime;
  const name = ((_a = input.name) == null ? void 0 : _a.trim()) || "\u81EA\u5B9A\u4E49\u73ED\u6B21";
  return {
    name,
    shortName: ((_b = input.shortName) == null ? void 0 : _b.trim()) || name.slice(0, 4) || "\u81EA\u5B9A\u4E49",
    kind,
    color: input.color || "#1F6FEB",
    startTime,
    endTime,
    endsNextDay,
    unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes ?? 0)
  };
}
function instanceTimes(date, snap, timezone) {
  if (snap.kind === "rest" || !snap.startTime || !snap.endTime) {
    return { startsAt: null, endsAt: null };
  }
  const startsAt = zonedTimeToIso(date, snap.startTime, timezone);
  const endDate = snap.endsNextDay ? addDays(date, 1) : date;
  const endsAt = zonedTimeToIso(endDate, snap.endTime, timezone);
  return { startsAt, endsAt };
}
async function resolveSnapshot(workspaceId, shiftTemplateId, customShift) {
  if (shiftTemplateId) {
    const res = await db.collection("shiftTemplates").doc(shiftTemplateId).get();
    if (!res.data || res.data.workspaceId !== workspaceId) {
      throw new CloudError("NOT_FOUND", "\u73ED\u6B21\u6A21\u677F\u4E0D\u5B58\u5728", 404);
    }
    return snapshotFromTemplate(res.data);
  }
  if (customShift) {
    return normalizeSnapshot(customShift);
  }
  throw new CloudError("VALIDATION_ERROR", "\u5FC5\u987B\u63D0\u4F9B shiftTemplateId \u6216 customShift");
}
async function assertNoOverlap(workspaceId, ownerOpenid, businessDate, times, excludeId) {
  if (!times.startsAt || !times.endsAt) return;
  const from = addDays(businessDate, -1);
  const to = addDays(businessDate, 1);
  const res = await db.collection("scheduleInstances").where({
    workspaceId,
    ownerOpenid,
    businessDate: _.gte(from).and(_.lte(to))
  }).limit(1e3).get();
  const conflicts = findOverlapConflicts(
    { id: "candidate", startsAt: times.startsAt, endsAt: times.endsAt, kind: "work" },
    res.data.filter((r) => r._id !== excludeId).map((r) => ({
      id: r._id,
      startsAt: r.startsAt ?? null,
      endsAt: r.endsAt ?? null,
      kind: r.kind
    }))
  );
  if (conflicts.length > 0) {
    throw new CloudError("SCHEDULE_CONFLICT", "\u8BE5\u65F6\u6BB5\u4E0E\u73B0\u6709\u73ED\u6B21\u51B2\u7A81", 409);
  }
}
async function list2(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  assertDate(payload.from);
  assertDate(payload.to);
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from \u4E0D\u80FD\u665A\u4E8E to");
  }
  const res = await db.collection("scheduleInstances").where({
    workspaceId: payload.workspaceId,
    ownerOpenid: openid,
    businessDate: _.gte(payload.from).and(_.lte(payload.to)),
    source: _.neq("rule")
  }).orderBy("businessDate", "asc").limit(1e3).get();
  return res.data.map(toScheduleInstance);
}
async function create2(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.businessDate, "VALIDATION_ERROR", "businessDate \u4E3A\u5FC5\u586B");
  assertDate(payload.businessDate);
  const snap = await resolveSnapshot(payload.workspaceId, payload.shiftTemplateId, payload.customShift);
  const workspace = await getWorkspace(payload.workspaceId);
  const times = instanceTimes(payload.businessDate, snap, workspace.timezone);
  await assertNoOverlap(payload.workspaceId, openid, payload.businessDate, times, null);
  const now = nowIso();
  const added = await db.collection("scheduleInstances").add({
    data: {
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      businessDate: payload.businessDate,
      timezone: workspace.timezone,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      kind: snap.kind,
      shiftSnapshot: snap,
      locationSnapshot: null,
      note: payload.note ?? null,
      status: "scheduled",
      source: "manual",
      version: 1,
      history: [],
      createdAt: now,
      updatedAt: now
    }
  });
  const doc = await db.collection("scheduleInstances").doc(added._id).get();
  const prefs = await get2(openid, { workspaceId: payload.workspaceId });
  await rebuildJobs(openid, payload.workspaceId, doc.data, prefs);
  await writeAudit(openid, payload.workspaceId, "schedule.create", "scheduleInstance", added._id, {
    businessDate: payload.businessDate,
    shiftName: snap.name
  });
  return toScheduleInstance(doc.data);
}
async function detail(openid, payload) {
  const doc = await db.collection("scheduleInstances").doc(payload.id).get();
  const data = doc.data;
  if (!data) {
    throw new CloudError("NOT_FOUND", "\u6392\u73ED\u4E0D\u5B58\u5728", 404);
  }
  await requireWorkspace(openid, data.workspaceId);
  const weather = await getForDate(openid, data.businessDate);
  const holidayMap = await readHolidayRange(data.businessDate, data.businessDate);
  const overtime = data.kind !== "rest" && holidayMap[data.businessDate] === "holiday";
  return {
    ...toScheduleInstance(data),
    weather,
    pendingChange: null,
    overtime,
    history: (data.history ?? []).map((h) => ({
      version: h.version,
      snapshot: h.snapshot,
      changeReason: h.changeReason,
      changedBy: null,
      createdAt: h.createdAt
    }))
  };
}
async function update2(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.id && payload.version != null, "VALIDATION_ERROR", "id \u4E0E version \u4E3A\u5FC5\u586B");
  if (payload.changeScope !== "only_this_day") {
    throw new CloudError("FORBIDDEN", "\u4E2A\u4EBA\u6A21\u5F0F\u4EC5\u652F\u6301\u4FEE\u6539\u5F53\u5929\uFF0C\u4E0D\u5F71\u54CD\u5176\u4ED6\u65E5\u671F", 403);
  }
  const snap = await resolveSnapshot(payload.workspaceId, payload.shiftTemplateId, payload.customShift);
  const before = await db.collection("scheduleInstances").doc(payload.id).get();
  const current = before.data;
  if (!current || current.workspaceId !== payload.workspaceId || current.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "\u6392\u73ED\u4E0D\u5B58\u5728", 404);
  }
  if (current.version !== payload.version) {
    throw new CloudError("VERSION_CONFLICT", "\u6570\u636E\u5DF2\u88AB\u4ED6\u4EBA\u4FEE\u6539\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5", 409);
  }
  const times = instanceTimes(current.businessDate, snap, current.timezone);
  await assertNoOverlap(current.workspaceId, openid, current.businessDate, times, payload.id);
  const updated = await db.runTransaction(async (transaction) => {
    const txDoc = await transaction.collection("scheduleInstances").doc(payload.id).get();
    const txCurrent = txDoc.data;
    if (!txCurrent || txCurrent.version !== payload.version) {
      throw new CloudError("VERSION_CONFLICT", "\u6570\u636E\u5DF2\u88AB\u4ED6\u4EBA\u4FEE\u6539\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5", 409);
    }
    const newVersion = txCurrent.version + 1;
    await transaction.collection("scheduleInstances").doc(payload.id).update({
      data: {
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        kind: snap.kind,
        shiftSnapshot: snap,
        note: payload.note ?? txCurrent.note,
        version: newVersion,
        history: [
          ...Array.isArray(txCurrent.history) ? txCurrent.history : [],
          {
            version: newVersion,
            snapshot: txCurrent.shiftSnapshot,
            changeReason: payload.reason || null,
            createdAt: nowIso()
          }
        ],
        updatedAt: nowIso()
      }
    });
    const after = await transaction.collection("scheduleInstances").doc(payload.id).get();
    return after.data;
  });
  const prefs = await get2(openid, { workspaceId: payload.workspaceId });
  await rebuildJobs(openid, payload.workspaceId, updated, prefs);
  await writeAudit(openid, payload.workspaceId, "schedule.update", "scheduleInstance", payload.id, {
    shiftName: snap.name,
    reason: payload.reason || null
  });
  return toScheduleInstance(updated);
}
async function createRule(openid, payload) {
  var _a;
  await requireWorkspace(openid, payload.workspaceId);
  assert(
    payload.startDate && Array.isArray(payload.sequence) && payload.sequence.length > 0,
    "VALIDATION_ERROR",
    "startDate \u4E0E sequence \u4E3A\u5FC5\u586B"
  );
  assertDate(payload.startDate);
  if (payload.endDate) assertDate(payload.endDate);
  const ids = payload.sequence.map((s) => s.shiftTemplateId);
  const tplRes = await db.collection("shiftTemplates").where({ workspaceId: payload.workspaceId, _id: _.in(ids) }).limit(100).get();
  const tplMap = new Map(tplRes.data.map((t) => [t._id, t]));
  for (const id of ids) {
    assert(tplMap.has(id), "NOT_FOUND", `\u73ED\u6B21\u6A21\u677F ${id} \u4E0D\u5B58\u5728`, 404);
  }
  const horizon = Math.min(366, Math.max(7, payload.generationHorizonDays ?? 90));
  const workspace = await getWorkspace(payload.workspaceId);
  const timezone = payload.timezone ?? workspace.timezone;
  const now = nowIso();
  const ruleName = ((_a = payload.name) == null ? void 0 : _a.trim()) || "\u6392\u73ED\u8868";
  const added = await db.collection("scheduleRules").add({
    data: {
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      name: ruleName,
      startDate: payload.startDate,
      endDate: payload.endDate ?? null,
      sequence: payload.sequence,
      timezone,
      generationHorizonDays: horizon,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    }
  });
  const ruleId = added._id;
  await db.collection("users").doc(openid).update({
    data: { activeRuleId: ruleId, updatedAt: now }
  });
  await writeAudit(openid, payload.workspaceId, "schedule_rule.create", "scheduleRule", ruleId, {
    startDate: payload.startDate,
    generatedCount: 0
  });
  return {
    rule: {
      id: ruleId,
      ownerUserId: openid,
      name: ruleName,
      startDate: payload.startDate,
      endDate: payload.endDate ?? null,
      timezone,
      sequence: payload.sequence,
      generationHorizonDays: horizon,
      version: 1,
      isActive: true
    },
    generatedCount: 0,
    conflicts: []
  };
}
async function listRules(openid, workspaceId) {
  var _a;
  await requireWorkspace(openid, workspaceId);
  const rulesRes = await db.collection("scheduleRules").where({ workspaceId, ownerOpenid: openid, isActive: true }).orderBy("createdAt", "asc").limit(100).get();
  const userRes = await db.collection("users").doc(openid).get();
  const active = (_a = userRes.data) == null ? void 0 : _a.activeRuleId;
  return rulesRes.data.map((r) => ({
    id: r._id,
    name: r.name ?? "\u672A\u547D\u540D\u6392\u73ED\u8868",
    startDate: r.startDate,
    endDate: r.endDate ?? null,
    timezone: r.timezone,
    sequence: r.sequence,
    generationHorizonDays: r.generationHorizonDays,
    version: r.version,
    isActive: r.isActive,
    isCurrent: r._id === active
  }));
}
async function updateRule(openid, workspaceId, payload) {
  var _a;
  await requireWorkspace(openid, workspaceId);
  assert(payload && payload.id && payload.version != null, "VALIDATION_ERROR", "id \u4E0E version \u4E3A\u5FC5\u586B");
  const ruleRes = await db.collection("scheduleRules").doc(payload.id).get();
  const rule = ruleRes.data;
  if (!rule || rule.workspaceId !== workspaceId || rule.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "\u6392\u73ED\u8868\u4E0D\u5B58\u5728", 404);
  }
  if (rule.version !== payload.version) {
    throw new CloudError("VERSION_CONFLICT", "\u6570\u636E\u5DF2\u88AB\u4FEE\u6539\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5", 409);
  }
  const data = { updatedAt: nowIso(), version: rule.version + 1 };
  if (typeof payload.name === "string") data.name = payload.name.trim() || "\u6392\u73ED\u8868";
  if (typeof payload.startDate === "string") {
    assertDate(payload.startDate);
    data.startDate = payload.startDate;
  }
  if (payload.endDate !== void 0) {
    if (payload.endDate) assertDate(payload.endDate);
    data.endDate = payload.endDate ?? null;
  }
  if (Array.isArray(payload.sequence)) {
    assert(payload.sequence.length > 0, "VALIDATION_ERROR", "\u73ED\u6B21\u5E8F\u5217\u4E0D\u80FD\u4E3A\u7A7A");
    const ids = payload.sequence.map((s) => s.shiftTemplateId);
    const tplRes = await db.collection("shiftTemplates").where({ workspaceId, _id: _.in(ids) }).limit(100).get();
    const found = new Set(tplRes.data.map((t) => t._id));
    for (const id of ids) {
      assert(found.has(id), "NOT_FOUND", `\u73ED\u6B21\u6A21\u677F ${id} \u4E0D\u5B58\u5728`, 404);
    }
    data.sequence = payload.sequence;
  }
  await db.collection("scheduleRules").doc(payload.id).update({ data });
  const updated = await db.collection("scheduleRules").doc(payload.id).get();
  const userRes = await db.collection("users").doc(openid).get();
  const active = (_a = userRes.data) == null ? void 0 : _a.activeRuleId;
  return {
    id: updated.data._id,
    name: updated.data.name ?? "\u672A\u547D\u540D\u6392\u73ED\u8868",
    startDate: updated.data.startDate,
    endDate: updated.data.endDate ?? null,
    timezone: updated.data.timezone,
    sequence: updated.data.sequence,
    generationHorizonDays: updated.data.generationHorizonDays,
    version: updated.data.version,
    isActive: updated.data.isActive,
    isCurrent: updated.data._id === active
  };
}
async function switchRule(openid, workspaceId, ruleId) {
  await requireWorkspace(openid, workspaceId);
  const rule = await db.collection("scheduleRules").doc(ruleId).get();
  if (!rule.data || rule.data.workspaceId !== workspaceId || rule.data.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "\u6392\u73ED\u8868\u4E0D\u5B58\u5728", 404);
  }
  await db.collection("users").doc(openid).update({
    data: { activeRuleId: ruleId, updatedAt: nowIso() }
  });
  return { ruleId };
}
async function removeRule(openid, workspaceId, ruleId) {
  var _a;
  await requireWorkspace(openid, workspaceId);
  const rule = await db.collection("scheduleRules").doc(ruleId).get();
  if (!rule.data || rule.data.workspaceId !== workspaceId || rule.data.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "\u6392\u73ED\u8868\u4E0D\u5B58\u5728", 404);
  }
  await db.collection("scheduleRules").doc(ruleId).update({
    data: { isActive: false, updatedAt: nowIso() }
  });
  await db.collection("scheduleInstances").where({ sourceRuleId: ruleId }).remove();
  const userRes = await db.collection("users").doc(openid).get();
  if (((_a = userRes.data) == null ? void 0 : _a.activeRuleId) === ruleId) {
    await db.collection("users").doc(openid).update({
      data: { activeRuleId: null, updatedAt: nowIso() }
    });
  }
  return { removed: ruleId };
}

// apps/miniprogram/cloudfunctions/api/src/change.ts
async function create3(openid, payload) {
  var _a;
  await requireWorkspace(openid, payload.workspaceId);
  assert(
    payload.scheduleInstanceId && payload.requestedShift,
    "VALIDATION_ERROR",
    "scheduleInstanceId \u4E0E requestedShift \u4E3A\u5FC5\u586B"
  );
  const requested = normalizeSnapshot(payload.requestedShift);
  const before = await db.collection("scheduleInstances").doc(payload.scheduleInstanceId).get();
  const current = before.data;
  if (!current || current.workspaceId !== payload.workspaceId || current.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "\u6392\u73ED\u4E0D\u5B58\u5728", 404);
  }
  const times = instanceTimes(current.businessDate, requested, current.timezone);
  await assertNoOverlap(current.workspaceId, openid, current.businessDate, times, payload.scheduleInstanceId);
  const result = await db.runTransaction(async (transaction) => {
    const txDoc = await transaction.collection("scheduleInstances").doc(payload.scheduleInstanceId).get();
    const txCurrent = txDoc.data;
    if (!txCurrent) {
      throw new CloudError("NOT_FOUND", "\u6392\u73ED\u4E0D\u5B58\u5728", 404);
    }
    const newVersion = txCurrent.version + 1;
    await transaction.collection("scheduleInstances").doc(payload.scheduleInstanceId).update({
      data: {
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        kind: requested.kind,
        shiftSnapshot: requested,
        version: newVersion,
        history: [
          ...Array.isArray(txCurrent.history) ? txCurrent.history : [],
          {
            version: newVersion,
            snapshot: txCurrent.shiftSnapshot,
            changeReason: payload.reason ?? "\u4E34\u65F6\u6539\u73ED",
            createdAt: nowIso()
          }
        ],
        updatedAt: nowIso()
      }
    });
    const cr = {
      workspaceId: payload.workspaceId,
      scheduleInstanceId: payload.scheduleInstanceId,
      businessDate: current.businessDate,
      requesterOpenid: openid,
      originalSnapshot: txCurrent.shiftSnapshot,
      requestedSnapshot: requested,
      reason: payload.reason ?? null,
      status: "approved",
      approvalNote: "\u4E2A\u4EBA\u6A21\u5F0F\u76F4\u63A5\u751F\u6548",
      createdAt: nowIso(),
      decidedAt: nowIso()
    };
    const added = await transaction.collection("changeRequests").add({ data: cr });
    const updated = await transaction.collection("scheduleInstances").doc(payload.scheduleInstanceId).get();
    return { change: { ...cr, _id: added._id }, updated: updated.data };
  });
  const prefs = await get2(openid, { workspaceId: payload.workspaceId });
  await rebuildJobs(openid, payload.workspaceId, result.updated, prefs);
  await writeAudit(openid, payload.workspaceId, "change.approve_direct", "changeRequest", result.change._id, {
    from: (_a = current.shiftSnapshot) == null ? void 0 : _a.name,
    to: requested.name
  });
  return toChangeRequest(result.change);
}
async function list3(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  const where = {
    workspaceId: payload.workspaceId,
    requesterOpenid: openid
  };
  if (payload.status) {
    where.status = payload.status;
  }
  if (payload.from && payload.to) {
    where.businessDate = _.gte(payload.from).and(_.lte(payload.to));
  }
  const page = Math.max(1, payload.page ?? 1);
  const pageSize = 50;
  let query = db.collection("changeRequests").where(where).orderBy("createdAt", "desc");
  if (page > 1) query = query.skip((page - 1) * pageSize);
  const res = await query.limit(pageSize).get();
  return res.data.map(toChangeRequest);
}
async function remove(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  let doc = null;
  try {
    const res = await db.collection("changeRequests").doc(payload.id).get();
    doc = res.data;
  } catch {
    throw new CloudError("NOT_FOUND", "\u6539\u73ED\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
  }
  if (!doc || doc.workspaceId !== payload.workspaceId || doc.requesterOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "\u6539\u73ED\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
  }
  await db.collection("changeRequests").doc(payload.id).remove();
  return { removed: payload.id };
}

// apps/miniprogram/cloudfunctions/api/src/share.ts
async function create4(openid, payload) {
  var _a, _b, _c, _d, _e, _f;
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.rangeStart && payload.rangeEnd, "VALIDATION_ERROR", "rangeStart \u4E0E rangeEnd \u4E3A\u5FC5\u586B");
  assertDate(payload.rangeStart);
  assertDate(payload.rangeEnd);
  if (payload.rangeStart > payload.rangeEnd) {
    throw new CloudError("VALIDATION_ERROR", "rangeStart \u4E0D\u80FD\u665A\u4E8E rangeEnd");
  }
  const privacy = {
    showDisplayName: Boolean((_a = payload.privacyOptions) == null ? void 0 : _a.showDisplayName),
    showTime: Boolean((_b = payload.privacyOptions) == null ? void 0 : _b.showTime),
    showWeather: Boolean((_c = payload.privacyOptions) == null ? void 0 : _c.showWeather),
    showLocation: Boolean((_d = payload.privacyOptions) == null ? void 0 : _d.showLocation),
    showNote: Boolean((_e = payload.privacyOptions) == null ? void 0 : _e.showNote)
  };
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  for (const entry of entries) {
    assert(
      entry && typeof entry.date === "string" && typeof entry.shiftName === "string",
      "VALIDATION_ERROR",
      "\u5206\u4EAB\u6761\u76EE\u683C\u5F0F\u9519\u8BEF"
    );
  }
  const userRes = await db.collection("users").doc(openid).get();
  const createdAt = nowIso();
  const added = await db.collection("shareSnapshots").add({
    data: {
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      rangeStart: payload.rangeStart,
      rangeEnd: payload.rangeEnd,
      privacyOptions: privacy,
      templateCode: payload.templateCode || "default",
      snapshot: {
        ownerDisplayName: privacy.showDisplayName ? ((_f = userRes.data) == null ? void 0 : _f.displayName) ?? null : null,
        rangeStart: payload.rangeStart,
        rangeEnd: payload.rangeEnd,
        templateCode: payload.templateCode || "default",
        privacyOptions: privacy,
        entries
      },
      createdAt
    }
  });
  const doc = await db.collection("shareSnapshots").doc(added._id).get();
  await writeAudit(openid, payload.workspaceId, "share.create", "shareSnapshot", added._id, {
    rangeStart: payload.rangeStart,
    rangeEnd: payload.rangeEnd,
    entries: entries.length
  });
  return toShareSnapshot(doc.data);
}

// apps/miniprogram/cloudfunctions/api/src/seed.ts
async function seedDemo(openid) {
  const { user, workspace } = await ensureUserAndWorkspace(openid);
  await ensureDefaultRule(openid, workspace);
  return { user: toUser(user), workspace: toWorkspace(workspace), created: 0 };
}

// apps/miniprogram/cloudfunctions/api/src/user.ts
async function updateLocation(openid, payload) {
  await requireWorkspace(openid, payload.workspaceId);
  const loc = payload.location;
  assert(loc && typeof loc.name === "string", "VALIDATION_ERROR", "\u4F4D\u7F6E\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  assert(
    typeof loc.latitude === "number" && typeof loc.longitude === "number",
    "VALIDATION_ERROR",
    "\u7ECF\u7EAC\u5EA6\u683C\u5F0F\u9519\u8BEF"
  );
  await db.collection("users").doc(openid).update({
    data: { defaultLocation: loc, updatedAt: nowIso() }
  });
  const user = await db.collection("users").doc(openid).get();
  if (!user.data) throw new CloudError("NOT_FOUND", "\u7528\u6237\u4E0D\u5B58\u5728", 404);
  return toUser(user.data);
}

// apps/miniprogram/cloudfunctions/api/src/index.ts
import_wx_server_sdk2.default.init({ env: import_wx_server_sdk2.default.DYNAMIC_CURRENT_ENV });
exports.main = async (event) => {
  const { OPENID } = import_wx_server_sdk2.default.getWXContext();
  const action = event == null ? void 0 : event.action;
  const payload = (event == null ? void 0 : event.payload) ?? {};
  if (!action) {
    return fail(new CloudError("VALIDATION_ERROR", "\u7F3A\u5C11 action"));
  }
  if (!OPENID && action !== "system.ping") {
    return fail(new CloudError("UNAUTHORIZED", "\u8BF7\u5148\u767B\u5F55", 401));
  }
  const openid = OPENID ?? "";
  try {
    switch (action) {
      case "system.ping":
        return ok({ pong: true });
      case "system.seed":
        return ok(await seedDemo(openid));
      case "auth.me": {
        const ctx = await ensureUserAndWorkspace(openid, payload.displayName, payload.avatarUrl);
        return ok({ user: toUser(ctx.user), workspace: toWorkspace(ctx.workspace) });
      }
      case "workspaces.list": {
        const ctx = await ensureUserAndWorkspace(openid);
        return ok([toWorkspace(ctx.workspace)]);
      }
      case "shift.list":
        return ok(await list(openid, payload));
      case "shift.create":
        return ok(await create(openid, payload));
      case "shift.update":
        return ok(await update(openid, payload));
      case "schedule.list":
        return ok(await list2(openid, payload));
      case "schedule.create":
        return ok(await create2(openid, payload));
      case "schedule.detail":
        return ok(await detail(openid, payload));
      case "schedule.update":
        return ok(await update2(openid, payload));
      case "rule.create":
        return ok(await createRule(openid, payload));
      case "rule.update":
        return ok(await updateRule(openid, payload.workspaceId, payload));
      case "rule.list":
        return ok(await listRules(openid, payload.workspaceId));
      case "rule.switch":
        return ok(await switchRule(openid, payload.workspaceId, payload.ruleId));
      case "rule.remove":
        return ok(await removeRule(openid, payload.workspaceId, payload.ruleId));
      case "change.create":
        return ok(await create3(openid, payload));
      case "change.list":
        return ok(await list3(openid, payload));
      case "change.remove":
        return ok(await remove(openid, payload));
      case "weather.get":
        return ok(await get(openid, payload));
      case "holiday.sync":
        return ok(await sync(openid, payload));
      case "holiday.getRange":
        return ok(await getRange(openid, payload));
      case "user.updateLocation":
        return ok(await updateLocation(openid, payload));
      case "notify.get":
        return ok(await get2(openid, payload));
      case "notify.save":
        return ok(await save(openid, payload));
      case "share.create":
        return ok(await create4(openid, payload));
      default:
        return fail(new CloudError("NOT_FOUND", `\u672A\u77E5 action: ${action}`, 404));
    }
  } catch (err) {
    return fail(err);
  }
};

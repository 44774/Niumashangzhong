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
async function ensureUserAndWorkspace(openid, displayName) {
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
      defaultCity: "\u6DF1\u5733",
      timezone: "Asia/Shanghai",
      createdAt: now,
      updatedAt: now
    };
    const userData = { ...user };
    delete userData._id;
    await db.collection("users").doc(openid).set({ data: userData });
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
  }
  return { user, workspace };
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
    avatarUrl: null,
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

// packages/schedule-engine/dist/time.js
var DAY_MINUTES = 24 * 60;
function toMinutes(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new Error(`\u975E\u6CD5\u65F6\u95F4\u683C\u5F0F: ${time}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
function formatTimeRange(input) {
  if (!input.startTime || !input.endTime)
    return null;
  const endsNextDay = input.endsNextDay || toMinutes(input.endTime) <= toMinutes(input.startTime);
  return endsNextDay ? `${input.startTime}\u2013\u6B21\u65E5${input.endTime}` : `${input.startTime}\u2013${input.endTime}`;
}
function formatTimeRangeFromSnapshot(snapshot) {
  if (snapshot.kind === "rest")
    return null;
  return formatTimeRange({
    startTime: snapshot.startTime,
    endTime: snapshot.endTime,
    endsNextDay: snapshot.endsNextDay
  });
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

// packages/schedule-engine/dist/cycle.js
function generateCycleSlots(rule) {
  if (rule.sequence.length === 0) {
    throw new Error("\u73ED\u6B21\u5E8F\u5217\u4E0D\u80FD\u4E3A\u7A7A");
  }
  const horizon = Math.max(1, rule.generationHorizonDays);
  const lastDate = rule.endDate ? minDate(rule.endDate, addDays(rule.startDate, horizon - 1)) : addDays(rule.startDate, horizon - 1);
  if (lastDate < rule.startDate)
    return [];
  const slots = [];
  let cursor = rule.startDate;
  let index = 0;
  while (cursor <= lastDate) {
    const shiftTemplateId = rule.sequence[index % rule.sequence.length];
    if (!shiftTemplateId) {
      throw new Error("\u73ED\u6B21\u5E8F\u5217\u5305\u542B\u7A7A\u9879");
    }
    slots.push({ date: cursor, sequenceIndex: index, shiftTemplateId });
    index += 1;
    cursor = addDays(cursor, 1);
  }
  return slots;
}
function minDate(a, b) {
  return a <= b ? a : b;
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
function minDate2(a, b) {
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
  const archiveEnd = archiveStart ? minDate2(to, addDays(pastLimit, -1)) : null;
  const forecastStart = maxDate(from, pastLimit);
  const forecastEnd = minDate2(to, futureLimit);
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
    if (!res.data) {
      throw new CloudError("NOT_FOUND", "\u73ED\u6B21\u6A21\u677F\u4E0D\u5B58\u5728", 404);
    }
    if (res.data.workspaceId !== workspaceId) {
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
async function chunkAll(tasks, size) {
  for (let i = 0; i < tasks.length; i += size) {
    await Promise.all(tasks.slice(i, i + size));
  }
}
async function list2(openid, payload) {
  var _a;
  await requireWorkspace(openid, payload.workspaceId);
  assertDate(payload.from);
  assertDate(payload.to);
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from \u4E0D\u80FD\u665A\u4E8E to");
  }
  const res = await db.collection("scheduleInstances").where({
    workspaceId: payload.workspaceId,
    ownerOpenid: openid,
    businessDate: _.gte(payload.from).and(_.lte(payload.to))
  }).orderBy("businessDate", "asc").limit(1e3).get();
  const userRes = await db.collection("users").doc(openid).get();
  const activeRuleId = (_a = userRes.data) == null ? void 0 : _a.activeRuleId;
  const visible = activeRuleId ? res.data.filter(
    (r) => r.sourceRuleId === activeRuleId || r.source !== "rule"
  ) : res.data;
  return visible.map(toScheduleInstance);
}
function computeRuleInstanceForDate(rule, templateById, date) {
  const offset = diffDays(rule.startDate, date);
  if (offset < 0) return null;
  if (rule.endDate && date > rule.endDate) return null;
  const sequence = rule.sequence ?? [];
  if (sequence.length === 0) return null;
  const item = sequence[offset % sequence.length];
  const tpl = item ? templateById.get(item.shiftTemplateId) : void 0;
  if (!tpl) return null;
  const snap = snapshotFromTemplate(tpl);
  const times = instanceTimes(date, snap, rule.timezone ?? "Asia/Shanghai");
  return {
    _id: `rule:${rule._id}:${date}`,
    workspaceId: rule.workspaceId,
    ownerOpenid: rule.ownerOpenid,
    businessDate: date,
    timezone: rule.timezone ?? "Asia/Shanghai",
    startsAt: times.startsAt,
    endsAt: times.endsAt,
    kind: snap.kind,
    shiftSnapshot: snap,
    locationSnapshot: null,
    note: null,
    status: "scheduled",
    source: "rule",
    sourceRuleId: rule._id,
    version: 1,
    history: []
  };
}
async function mergedRuleInstances(openid, workspaceId, from, to) {
  var _a;
  const existingRes = await db.collection("scheduleInstances").where({ workspaceId, ownerOpenid: openid, businessDate: _.gte(from).and(_.lte(to)) }).limit(1e3).get();
  const existing = existingRes.data;
  const userRes = await db.collection("users").doc(openid).get();
  const activeRuleId = (_a = userRes.data) == null ? void 0 : _a.activeRuleId;
  if (!activeRuleId) return existing;
  const ruleRes = await db.collection("scheduleRules").doc(activeRuleId).get();
  const rule = ruleRes.data;
  if (!rule || rule.isActive === false) return existing;
  const ids = rule.sequence.map((s) => s.shiftTemplateId);
  const tplRes = await db.collection("shiftTemplates").where({ workspaceId, _id: _.in(ids) }).limit(100).get();
  const tplMap = new Map(tplRes.data.map((t) => [t._id, t]));
  const byDate = new Map(existing.map((r) => [r.businessDate, r]));
  const out = [...existing];
  let cursor = from;
  while (cursor <= to) {
    if (!byDate.has(cursor)) {
      const virtual = computeRuleInstanceForDate(rule, tplMap, cursor);
      if (virtual) out.push(virtual);
    }
    cursor = addDays(cursor, 1);
  }
  return out.sort((a, b) => a.businessDate < b.businessDate ? -1 : 1);
}
function diffDays(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1) - Date.UTC(fy ?? 0, (fm ?? 1) - 1, fd ?? 1)) / 864e5
  );
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
  var _a, _b, _c;
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
  const slots = generateCycleSlots({
    startDate: payload.startDate,
    endDate: payload.endDate ?? null,
    sequence: ids,
    generationHorizonDays: horizon
  });
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
  const from = ((_b = slots[0]) == null ? void 0 : _b.date) ?? payload.startDate;
  const to = ((_c = slots[slots.length - 1]) == null ? void 0 : _c.date) ?? payload.startDate;
  const existingRes = await db.collection("scheduleInstances").where({
    workspaceId: payload.workspaceId,
    ownerOpenid: openid,
    businessDate: _.gte(from).and(_.lte(to)),
    source: "manual"
  }).limit(1e3).get();
  const occupied = new Set(existingRes.data.map((r) => r.businessDate));
  let generatedCount = 0;
  const inserts = [];
  for (const slot of slots) {
    if (occupied.has(slot.date)) continue;
    const tpl = tplMap.get(slot.shiftTemplateId);
    if (!tpl) continue;
    const snap = snapshotFromTemplate(tpl);
    const times = instanceTimes(slot.date, snap, timezone);
    inserts.push(
      db.collection("scheduleInstances").add({
        data: {
          workspaceId: payload.workspaceId,
          ownerOpenid: openid,
          businessDate: slot.date,
          timezone,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          kind: snap.kind,
          shiftSnapshot: snap,
          locationSnapshot: null,
          note: null,
          status: "scheduled",
          source: "rule",
          sourceRuleId: ruleId,
          version: 1,
          history: [],
          createdAt: now,
          updatedAt: now
        }
      }).then(() => {
        generatedCount += 1;
      })
    );
  }
  await chunkAll(inserts, 10);
  const allRes = await db.collection("scheduleInstances").where({
    workspaceId: payload.workspaceId,
    ownerOpenid: openid,
    businessDate: _.gte(from).and(_.lte(to))
  }).limit(1e3).get();
  const relevant = allRes.data.filter(
    (r) => r.source !== "rule" || r.sourceRuleId === ruleId
  );
  const conflicts = [];
  for (const a of relevant) {
    for (const b of relevant) {
      if (a._id === b._id) continue;
      if (intervalsOverlap(
        { id: a._id, startsAt: a.startsAt ?? null, endsAt: a.endsAt ?? null, kind: a.kind },
        { id: b._id, startsAt: b.startsAt ?? null, endsAt: b.endsAt ?? null, kind: b.kind }
      )) {
        conflicts.push({
          type: "overlap",
          severity: "error",
          message: `${a.businessDate} \u4E0E ${b.businessDate} \u6392\u73ED\u65F6\u95F4\u91CD\u53E0`,
          existingScheduleId: b._id
        });
      }
    }
  }
  await writeAudit(openid, payload.workspaceId, "schedule_rule.create", "scheduleRule", ruleId, {
    startDate: payload.startDate,
    generatedCount
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
    generatedCount,
    conflicts
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
  const res = await db.collection("changeRequests").where(where).orderBy("createdAt", "desc").limit(100).get();
  return res.data.map(toChangeRequest);
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
  const userRes = await db.collection("users").doc(openid).get();
  const location = await resolveLocation(openid);
  const weathers = await forecastRange(location, payload.rangeStart, payload.rangeEnd);
  const weatherByDate = new Map(weathers.map((w) => [w.date, w]));
  const instances = await mergedRuleInstances(
    openid,
    payload.workspaceId,
    payload.rangeStart,
    payload.rangeEnd
  );
  const holidayMap = await readHolidayRange(payload.rangeStart, payload.rangeEnd);
  const entries = instances.map((row) => {
    var _a2, _b2, _c2, _d2, _e2;
    const forecast = weatherByDate.get(row.businessDate);
    return {
      date: row.businessDate,
      shiftName: (_a2 = row.shiftSnapshot) == null ? void 0 : _a2.name,
      shortName: (_b2 = row.shiftSnapshot) == null ? void 0 : _b2.shortName,
      kind: (_c2 = row.shiftSnapshot) == null ? void 0 : _c2.kind,
      color: (_d2 = row.shiftSnapshot) == null ? void 0 : _d2.color,
      timeText: privacy.showTime ? formatTimeRangeFromSnapshot(row.shiftSnapshot) : null,
      location: privacy.showLocation ? ((_e2 = row.locationSnapshot) == null ? void 0 : _e2.name) ?? null : null,
      note: privacy.showNote ? row.note ?? null : null,
      weather: privacy.showWeather && forecast ? {
        conditionText: forecast.conditionText,
        conditionCode: forecast.conditionCode,
        temperatureMin: forecast.temperatureMin,
        temperatureMax: forecast.temperatureMax
      } : null,
      overtime: row.kind !== "rest" && holidayMap[row.businessDate] === "holiday" ? true : void 0
    };
  });
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
  const { user, workspace } = await ensureUserAndWorkspace(openid, "\u5F20\u5C0F\u660E");
  const templatesRes = await db.collection("shiftTemplates").where({ workspaceId: workspace._id, isActive: true }).orderBy("sortOrder", "asc").limit(10).get();
  const templates = templatesRes.data;
  const today = todayInTimezone(workspace.timezone);
  const plan = [0, 1, 2, 3, 0, 1, 3];
  let created = 0;
  for (let i = 0; i < plan.length; i += 1) {
    const date = addDays(today, i);
    const exists = await db.collection("scheduleInstances").where({ workspaceId: workspace._id, ownerOpenid: openid, businessDate: date }).limit(1).get();
    if (exists.data.length > 0) continue;
    const tpl = templates[plan[i]];
    if (!tpl) continue;
    const snap = snapshotFromTemplate(tpl);
    const times = instanceTimes(date, snap, workspace.timezone);
    await db.collection("scheduleInstances").add({
      data: {
        workspaceId: workspace._id,
        ownerOpenid: openid,
        businessDate: date,
        timezone: workspace.timezone,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        kind: snap.kind,
        shiftSnapshot: snap,
        locationSnapshot: null,
        note: null,
        status: "scheduled",
        source: "manual",
        version: 1,
        history: [],
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    });
    created += 1;
  }
  return { user: toUser(user), workspace: toWorkspace(workspace), created };
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
        const ctx = await ensureUserAndWorkspace(openid, payload.displayName);
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

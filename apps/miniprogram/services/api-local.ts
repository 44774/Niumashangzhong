import { ApiError } from "./request";
import { setLocalSession, getUser } from "../stores/session";
import type {
  AuthResponse,
  ChangeRequest,
  ChangeRequestInput,
  NotificationPreferences,
  ScheduleCreateInput,
  ScheduleDetail,
  ScheduleInstance,
  ScheduleRuleCreateResult,
  ScheduleRuleInput,
  ScheduleUpdateInput,
  SharePrivacyOptions,
  ShareSnapshot,
  ShareSnapshotInput,
  ShiftSnapshot,
  ShiftTemplate,
  ShiftTemplateInput,
  User,
  WeatherForecast,
  Workspace,
} from "../typings/api";
import {
  DEFAULT_LOCAL_TEMPLATES,
  LOCAL_CHANGES_KEY,
  LOCAL_PREFS_KEY,
  LOCAL_SCHEDULES_KEY,
  LOCAL_TEMPLATES_KEY,
  genId,
  read,
  write,
} from "./local-store";
import { addDaysLocal, cycleSlots, instanceTimes, intervalsOverlap, normalizeSnapshot } from "../utils/local-schedule";
import { formatTimeRange } from "../utils/format";

const LOCAL_WORKSPACE_ID = "local-workspace";

interface LocalInstance extends ScheduleInstance {
  history: Array<{
    version: number;
    snapshot: any;
    changeReason: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

function localUser(displayName?: string): User {
  return {
    id: "local-user",
    displayName: displayName?.trim() || "本地用户",
    avatarUrl: null,
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    defaultCity: "深圳",
  };
}

function localWorkspace(name = "本地班表（仅本机）"): Workspace {
  return {
    id: LOCAL_WORKSPACE_ID,
    type: "personal",
    name,
    timezone: "Asia/Shanghai",
    roleCode: "owner",
  };
}

function ensureTemplates(): ShiftTemplate[] {
  const templates = read<ShiftTemplate[]>(LOCAL_TEMPLATES_KEY, []);
  if (templates.length === 0) {
    write(LOCAL_TEMPLATES_KEY, DEFAULT_LOCAL_TEMPLATES);
    return DEFAULT_LOCAL_TEMPLATES;
  }
  return templates;
}

function snapshotFromTemplate(tpl: ShiftTemplate) {
  return {
    name: tpl.name,
    shortName: tpl.shortName,
    kind: tpl.kind,
    color: tpl.color,
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    endsNextDay: tpl.endsNextDay,
    unpaidBreakMinutes: tpl.unpaidBreakMinutes,
  };
}

function toInstance(doc: LocalInstance): ScheduleInstance {
  return {
    id: doc.id,
    ownerUserId: doc.ownerUserId,
    businessDate: doc.businessDate,
    timezone: doc.timezone,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    kind: doc.kind,
    status: doc.status,
    source: doc.source,
    shiftSnapshot: doc.shiftSnapshot,
    locationSnapshot: doc.locationSnapshot,
    note: doc.note,
    version: doc.version,
  };
}

function mockWeather(from: string, to: string): WeatherForecast[] {
  const conditions = [
    { code: "sunny", text: "晴", rain: 0 },
    { code: "cloudy", text: "多云", rain: 10 },
    { code: "overcast", text: "阴", rain: 30 },
    { code: "rain", text: "小雨", rain: 60 },
    { code: "thunderstorm", text: "雷阵雨", rain: 90 },
    { code: "windy", text: "大风", rain: 20 },
  ];
  const result: WeatherForecast[] = [];
  let cursor = from;
  let index = 0;
  while (cursor <= to && index < 31) {
    const cond = conditions[index % conditions.length];
    if (!cond) break;
    const base = index % 5;
    result.push({
      date: cursor,
      conditionCode: cond.code,
      conditionText: cond.text,
      temperatureMin: 24 + base,
      temperatureMax: 29 + base,
      humidityPercent: 55 + ((index * 7) % 30),
      precipitationProbability: cond.rain + (index % 3) * 5,
      windDirection: ["东风", "南风", "西风", "北风"][index % 4] ?? null,
      windLevel: `${1 + (index % 4)}级`,
      airQuality: ["优", "良", "轻度污染"][index % 3] ?? null,
      warningCodes: cond.code === "thunderstorm" ? ["storm"] : [],
      updatedAt: new Date().toISOString(),
    });
    cursor = addDaysLocal(cursor, 1);
    index += 1;
  }
  return result;
}

export const api = {
  async loginDev(displayName?: string): Promise<AuthResponse> {
    const user = localUser(displayName);
    const workspace = localWorkspace();
    setLocalSession(user, workspace);
    return { accessToken: "local-token", user, workspace };
  },

  async loginWechat(_code?: string, displayName?: string): Promise<AuthResponse> {
    return this.loginDev(displayName);
  },

  async me(): Promise<User> {
    return getUser() ?? localUser();
  },

  async workspaces(): Promise<Workspace[]> {
    return [localWorkspace()];
  },

  async shiftTemplates(activeOnly = true): Promise<ShiftTemplate[]> {
    const templates = ensureTemplates();
    return activeOnly ? templates.filter((t) => t.isActive) : templates;
  },

  async createShiftTemplate(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    const templates = ensureTemplates();
    const created: ShiftTemplate = {
      ...input,
      id: genId("t"),
      version: 1,
      isActive: true,
      sortOrder: templates.length + 1,
    };
    write(LOCAL_TEMPLATES_KEY, [...templates, created]);
    return created;
  },

  async updateShiftTemplate(
    id: string,
    input: ShiftTemplateInput & { version: number; isActive?: boolean },
  ): Promise<ShiftTemplate> {
    const templates = ensureTemplates();
    const index = templates.findIndex((t) => t.id === id);
    if (index < 0) throw new ApiError(404, "NOT_FOUND", "班次模板不存在");
    const current = templates[index];
    if (!current || current.version !== input.version) {
      throw new ApiError(409, "VERSION_CONFLICT", "数据已被修改，请刷新后重试");
    }
    const updated: ShiftTemplate = {
      ...current,
      ...input,
      version: current.version + 1,
      isActive: input.isActive ?? current.isActive,
    };
    templates[index] = updated;
    write(LOCAL_TEMPLATES_KEY, templates);
    return updated;
  },

  async schedules(from: string, to: string): Promise<ScheduleInstance[]> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    return docs
      .filter((d) => d.businessDate >= from && d.businessDate <= to)
      .sort((a, b) => (a.businessDate < b.businessDate ? -1 : 1))
      .map(toInstance);
  },

  async scheduleDetail(id: string): Promise<ScheduleDetail> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const doc = docs.find((d) => d.id === id);
    if (!doc) throw new ApiError(404, "NOT_FOUND", "排班不存在");
    const weather = mockWeather(doc.businessDate, doc.businessDate)[0] ?? null;
    return {
      ...toInstance(doc),
      weather,
      pendingChange: null,
      history: (doc.history ?? []).map((h) => ({
        version: h.version,
        snapshot: h.snapshot,
        changeReason: h.changeReason,
        changedBy: null,
        createdAt: h.createdAt,
      })),
    };
  },

  async createSchedule(input: ScheduleCreateInput): Promise<ScheduleInstance> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    let snap: ShiftSnapshot;
    if (input.shiftTemplateId) {
      const tpl = ensureTemplates().find((t) => t.id === input.shiftTemplateId);
      if (!tpl) throw new ApiError(404, "NOT_FOUND", "班次模板不存在");
      snap = snapshotFromTemplate(tpl);
    } else if (input.customShift) {
      snap = normalizeSnapshot(input.customShift);
    } else {
      throw new ApiError(400, "VALIDATION_ERROR", "必须提供 shiftTemplateId 或 customShift");
    }
    const times = instanceTimes(input.businessDate, snap);
    assertNoConflict(docs, input.businessDate, times, null);
    const now = new Date().toISOString();
    const doc: LocalInstance = {
      id: genId("s"),
      ownerUserId: "local-user",
      businessDate: input.businessDate,
      timezone: "Asia/Shanghai",
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      kind: snap.kind,
      status: "scheduled",
      source: "manual",
      shiftSnapshot: snap,
      locationSnapshot: null,
      note: input.note ?? null,
      version: 1,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    write(LOCAL_SCHEDULES_KEY, [...docs, doc]);
    return toInstance(doc);
  },

  async updateSchedule(id: string, input: ScheduleUpdateInput): Promise<ScheduleInstance> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const index = docs.findIndex((d) => d.id === id);
    if (index < 0) throw new ApiError(404, "NOT_FOUND", "排班不存在");
    const doc = docs[index];
    if (!doc) throw new ApiError(404, "NOT_FOUND", "排班不存在");
    if (input.changeScope !== "only_this_day") {
      throw new ApiError(403, "FORBIDDEN", "本地模式仅支持修改当天，不影响其他日期");
    }
    if (doc.version !== input.version) {
      throw new ApiError(409, "VERSION_CONFLICT", "数据已被他人修改，请刷新后重试");
    }
    let snap: ShiftSnapshot;
    if (input.shiftTemplateId) {
      const tpl = ensureTemplates().find((t) => t.id === input.shiftTemplateId);
      if (!tpl) throw new ApiError(404, "NOT_FOUND", "班次模板不存在");
      snap = snapshotFromTemplate(tpl);
    } else if (input.customShift) {
      snap = normalizeSnapshot(input.customShift);
    } else {
      throw new ApiError(400, "VALIDATION_ERROR", "必须提供 shiftTemplateId 或 customShift");
    }
    const times = instanceTimes(doc.businessDate, snap);
    assertNoConflict(docs, doc.businessDate, times, doc.id);
    const newVersion = doc.version + 1;
    const updated: LocalInstance = {
      ...doc,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      kind: snap.kind,
      shiftSnapshot: snap,
      note: input.note ?? doc.note,
      version: newVersion,
      history: [
        ...(doc.history ?? []),
        {
          version: newVersion,
          snapshot: doc.shiftSnapshot as any,
          changeReason: input.reason || null,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    docs[index] = updated;
    write(LOCAL_SCHEDULES_KEY, docs);
    return toInstance(updated);
  },

  async createRule(input: ScheduleRuleInput): Promise<ScheduleRuleCreateResult> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const horizon = Math.min(366, Math.max(7, input.generationHorizonDays ?? 90));
    const slots = cycleSlots(input.startDate, input.sequence.map((s) => s.shiftTemplateId), horizon);
    const occupied = new Set(docs.map((d) => d.businessDate));
    const now = new Date().toISOString();
    let generatedCount = 0;
    for (const slot of slots) {
      if (occupied.has(slot.date)) continue;
      const tpl = ensureTemplates().find((t) => t.id === slot.shiftTemplateId);
      if (!tpl) continue;
      const snap = snapshotFromTemplate(tpl);
      const times = instanceTimes(slot.date, snap);
      docs.push({
        id: genId("s"),
        ownerUserId: "local-user",
        businessDate: slot.date,
        timezone: "Asia/Shanghai",
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        kind: snap.kind,
        status: "scheduled",
        source: "rule",
        shiftSnapshot: snap,
        locationSnapshot: null,
        note: null,
        version: 1,
        history: [],
        createdAt: now,
        updatedAt: now,
      });
      occupied.add(slot.date);
      generatedCount += 1;
    }
    write(LOCAL_SCHEDULES_KEY, docs);
    return {
      rule: {
        id: genId("r"),
        ownerUserId: "local-user",
        name: input.name ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        timezone: "Asia/Shanghai",
        sequence: input.sequence,
        generationHorizonDays: horizon,
        version: 1,
        isActive: true,
      },
      generatedCount,
      conflicts: [],
    };
  },

  async createChangeRequest(input: ChangeRequestInput): Promise<ChangeRequest> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const index = docs.findIndex((d) => d.id === input.scheduleInstanceId);
    if (index < 0) throw new ApiError(404, "NOT_FOUND", "排班不存在");
    const doc = docs[index];
    if (!doc) throw new ApiError(404, "NOT_FOUND", "排班不存在");
    const requested = normalizeSnapshot(input.requestedShift);
    const times = instanceTimes(doc.businessDate, requested);
    assertNoConflict(docs, doc.businessDate, times, doc.id);
    const newVersion = doc.version + 1;
    const now = new Date().toISOString();
    const updated: LocalInstance = {
      ...doc,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      kind: requested.kind,
      shiftSnapshot: requested,
      version: newVersion,
      history: [
        ...(doc.history ?? []),
        {
          version: newVersion,
          snapshot: doc.shiftSnapshot as any,
          changeReason: input.reason ?? "临时改班",
          createdAt: now,
        },
      ],
      updatedAt: now,
    };
    docs[index] = updated;
    const change: ChangeRequest = {
      id: genId("c"),
      scheduleInstanceId: doc.id,
      status: "approved",
      originalSnapshot: doc.shiftSnapshot,
      requestedSnapshot: requested,
      reason: input.reason ?? null,
      approvalNote: "本地模式直接生效",
      createdAt: now,
      decidedAt: now,
    };
    write(LOCAL_SCHEDULES_KEY, docs);
    write(LOCAL_CHANGES_KEY, [...read<ChangeRequest[]>(LOCAL_CHANGES_KEY, []), change]);
    return change;
  },

  async changeRequests(status?: string): Promise<ChangeRequest[]> {
    const list = read<ChangeRequest[]>(LOCAL_CHANGES_KEY, []);
    return status ? list.filter((c) => c.status === status) : list;
  },

  async weather(from: string, to: string, _city?: string): Promise<WeatherForecast[]> {
    return mockWeather(from, to);
  },

  async notificationPreferences(): Promise<NotificationPreferences> {
    return read<NotificationPreferences>(LOCAL_PREFS_KEY, {
      shiftReminders: [15],
      weatherEnabled: true,
      scheduleChangesEnabled: true,
      approvalEnabled: true,
      quietHours: null,
      channels: { wechat: true },
    });
  },

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    write(LOCAL_PREFS_KEY, prefs);
    return prefs;
  },

  async createShareSnapshot(input: ShareSnapshotInput): Promise<ShareSnapshot> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const instances = docs
      .filter((d) => d.businessDate >= input.rangeStart && d.businessDate <= input.rangeEnd)
      .sort((a, b) => (a.businessDate < b.businessDate ? -1 : 1))
      .map(toInstance);
    const weatherList = mockWeather(input.rangeStart, input.rangeEnd);
    const privacy = {
      showDisplayName: Boolean(input.privacyOptions?.showDisplayName),
      showTime: Boolean(input.privacyOptions?.showTime),
      showWeather: Boolean(input.privacyOptions?.showWeather),
      showLocation: Boolean(input.privacyOptions?.showLocation),
      showNote: Boolean(input.privacyOptions?.showNote),
    } as SharePrivacyOptions;
    const weatherByDate = new Map(weatherList.map((w) => [w.date, w]));
    const entries = instances.map((row) => {
      const forecast = weatherByDate.get(row.businessDate);
      return {
        date: row.businessDate,
        shiftName: row.shiftSnapshot.name,
        shortName: row.shiftSnapshot.shortName,
        kind: row.shiftSnapshot.kind,
        color: row.shiftSnapshot.color,
        timeText: privacy.showTime ? formatTimeRange(row.shiftSnapshot) : null,
        location: privacy.showLocation ? (row.locationSnapshot?.name ?? null) : null,
        note: privacy.showNote ? (row.note ?? null) : null,
        weather:
          privacy.showWeather && forecast
            ? {
                conditionText: forecast.conditionText,
                conditionCode: forecast.conditionCode,
                temperatureMin: forecast.temperatureMin,
                temperatureMax: forecast.temperatureMax,
              }
            : null,
      };
    });
    return {
      id: genId("sh"),
      ownerDisplayName: privacy.showDisplayName ? (getUser()?.displayName ?? null) : null,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      templateCode: input.templateCode || "default",
      privacyOptions: privacy,
      entries,
      createdAt: new Date().toISOString(),
    };
  },
};

function assertNoConflict(
  docs: LocalInstance[],
  businessDate: string,
  times: { startsAt: string | null; endsAt: string | null },
  excludeId: string | null,
): void {
  if (!times.startsAt || !times.endsAt) return;
  const from = addDaysLocal(businessDate, -1);
  const to = addDaysLocal(businessDate, 1);
  const conflicts = docs
    .filter((d) => d.id !== excludeId && d.businessDate >= from && d.businessDate <= to)
    .filter((d) =>
      intervalsOverlap(
        { startsAt: times.startsAt, endsAt: times.endsAt, kind: "work" },
        { startsAt: d.startsAt, endsAt: d.endsAt, kind: d.kind },
      ),
    );
  if (conflicts.length > 0) {
    throw new ApiError(409, "SCHEDULE_CONFLICT", "该时段与现有班次冲突");
  }
}

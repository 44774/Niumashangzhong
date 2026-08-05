import { ApiError } from "./request";
import { setLocalSession, getUser } from "../stores/session";
import type {
  AuthResponse,
  ChangeRequest,
  ChangeRequestInput,
  NotificationPreferences,
  NotificationSubscription,
  SubscribeTemplateInfo,
  ScheduleCreateInput,
  ScheduleDetail,
  ScheduleInstance,
  ScheduleRuleCreateResult,
  ScheduleRuleInput,
  ScheduleRuleUpdateInput,
  ScheduleRuleSummary,
  ScheduleUpdateInput,
  SharePrivacyOptions,
  ShareSnapshot,
  ShareSnapshotInput,
  ShiftSnapshot,
  ShiftTemplate,
  ShiftTemplateInput,
  User,
  WeatherLocation,
  HolidayMap,
  WeatherForecast,
  Workspace,
} from "../typings/api";
import {
  DEFAULT_LOCAL_TEMPLATES,
  LOCAL_CHANGES_KEY,
  LOCAL_PREFS_KEY,
  LOCAL_RULES_KEY,
  LOCAL_ACTIVE_RULE_KEY,
  LOCAL_SCHEDULES_KEY,
  LOCAL_TEMPLATES_KEY,
  genId,
  read,
  write,
} from "./local-store";
import { addDaysLocal, cycleSlots, instanceTimes, intervalsOverlap, normalizeSnapshot } from "../utils/local-schedule";
import { formatTimeRange } from "../utils/format";
import { fetchOpenMeteo } from "../utils/open-meteo";
import { getDefaultLocation, normalizeLocation, setDefaultLocation } from "../stores/location";
import {
  isOvertime,
  mergeHolidayMaps,
  parseHolidayYear,
  readHolidayCache,
  sliceHolidayMap,
  writeHolidayCache,
} from "../utils/holiday";

const HOLIDAY_API = "https://timor.tech/api/holiday/year/";

interface LocalRule {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  sequence: Array<{ shiftTemplateId: string }>;
  timezone: string;
  isActive: boolean;
  version: number;
}

const LOCAL_WORKSPACE_ID = "local-workspace";

interface LocalInstance extends ScheduleInstance {
  sourceRuleId?: string | null;
  history: Array<{
    version: number;
    snapshot: any;
    changeReason: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

function localUser(displayName?: string, avatarUrl?: string | null): User {
  return {
    id: "local-user",
    displayName: displayName?.trim() || "本地用户",
    avatarUrl: avatarUrl ?? null,
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

export const api = {
  async loginDev(displayName?: string, avatarUrl?: string | null): Promise<AuthResponse> {
    const user = localUser(displayName, avatarUrl);
    const workspace = localWorkspace();
    setLocalSession(user, workspace);
    return { accessToken: "local-token", user, workspace };
  },

  async loginWechat(
    _code?: string,
    displayName?: string,
    avatarUrl?: string | null,
  ): Promise<AuthResponse> {
    return this.loginDev(displayName, avatarUrl);
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
    await extendLocalRules(to);
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const activeRuleId = read<string>(LOCAL_ACTIVE_RULE_KEY, "");
    const visible = activeRuleId
      ? docs.filter((d) => d.sourceRuleId === activeRuleId || d.source !== "rule")
      : docs;
    return visible
      .filter((d) => d.businessDate >= from && d.businessDate <= to)
      .sort((a, b) => (a.businessDate < b.businessDate ? -1 : 1))
      .map(toInstance);
  },

  async scheduleDetail(id: string): Promise<ScheduleDetail> {
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    const doc = docs.find((d) => d.id === id);
    if (!doc) throw new ApiError(404, "NOT_FOUND", "排班不存在");
    const weatherList = await this.weather(doc.businessDate, doc.businessDate);
    const weather = weatherList[0] ?? null;
    const holidayMap = await ensureLocalHoliday(doc.businessDate, doc.businessDate);
    return {
      ...toInstance(doc),
      weather,
      pendingChange: null,
      overtime: isOvertime(holidayMap, doc.businessDate, doc.kind),
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
    const templates = ensureTemplates();
    for (const s of input.sequence) {
      if (!s.shiftTemplateId || !templates.some((t) => t.id === s.shiftTemplateId)) {
        throw new ApiError(400, "VALIDATION_ERROR", "班次序列包含无效班次");
      }
    }
    const horizon = Math.min(366, Math.max(7, input.generationHorizonDays ?? 90));
    const slots = cycleSlots(input.startDate, input.sequence.map((s) => s.shiftTemplateId), horizon);
    const occupied = new Set(
      docs.filter((d) => d.source === "manual").map((d) => d.businessDate),
    );
    const now = new Date().toISOString();
    const ruleId = genId("r");
    const ruleName = input.name?.trim() || "排班表";
    const rules = read<LocalRule[]>(LOCAL_RULES_KEY, []);
    rules.push({
      id: ruleId,
      name: ruleName,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      sequence: input.sequence,
      timezone: "Asia/Shanghai",
      isActive: true,
      version: 1,
    });
    write(LOCAL_RULES_KEY, rules);
    write(LOCAL_ACTIVE_RULE_KEY, ruleId);
    let generatedCount = 0;
    for (const slot of slots) {
      if (occupied.has(slot.date)) continue;
      const tpl = templates.find((t) => t.id === slot.shiftTemplateId);
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
        sourceRuleId: ruleId,
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
        id: ruleId,
        ownerUserId: "local-user",
        name: ruleName,
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

  async listRules() {
    const activeRuleId = read<string>(LOCAL_ACTIVE_RULE_KEY, "");
    return read<LocalRule[]>(LOCAL_RULES_KEY, [])
      .filter((r) => r.isActive)
      .map((r) => ({
        id: r.id,
        name: r.name ?? "未命名排班表",
        startDate: r.startDate,
        endDate: r.endDate ?? null,
        timezone: r.timezone,
        sequence: r.sequence,
        generationHorizonDays: 90,
        version: r.version,
        isActive: r.isActive,
        isCurrent: r.id === activeRuleId,
      }));
  },

  async updateRule(input: ScheduleRuleUpdateInput): Promise<ScheduleRuleSummary> {
    const rules = read<LocalRule[]>(LOCAL_RULES_KEY, []);
    const index = rules.findIndex((r) => r.id === input.id);
    if (index < 0) throw new ApiError(404, "NOT_FOUND", "排班表不存在");
    const current = rules[index];
    if (!current || current.version !== input.version) {
      throw new ApiError(409, "VERSION_CONFLICT", "数据已被修改，请刷新后重试");
    }
    const updated: LocalRule = {
      ...current,
      name: typeof input.name === "string" ? input.name.trim() || "排班表" : current.name,
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate !== undefined ? input.endDate : current.endDate,
      sequence: input.sequence ?? current.sequence,
      version: current.version + 1,
    };
    rules[index] = updated;
    write(LOCAL_RULES_KEY, rules);
    const activeRuleId = read<string>(LOCAL_ACTIVE_RULE_KEY, "");
    return {
      id: updated.id,
      name: updated.name,
      startDate: updated.startDate,
      endDate: updated.endDate,
      timezone: updated.timezone,
      sequence: updated.sequence,
      generationHorizonDays: 90,
      version: updated.version,
      isActive: updated.isActive,
      isCurrent: updated.id === activeRuleId,
    };
  },

  async switchRule(ruleId: string) {
    const rules = read<LocalRule[]>(LOCAL_RULES_KEY, []);
    if (!rules.some((r) => r.id === ruleId && r.isActive)) {
      throw new ApiError(404, "NOT_FOUND", "排班表不存在");
    }
    write(LOCAL_ACTIVE_RULE_KEY, ruleId);
    return { ruleId };
  },

  async removeRule(ruleId: string) {
    const rules = read<LocalRule[]>(LOCAL_RULES_KEY, []);
    if (!rules.some((r) => r.id === ruleId)) {
      throw new ApiError(404, "NOT_FOUND", "排班表不存在");
    }
    write(
      LOCAL_RULES_KEY,
      rules.map((r) => (r.id === ruleId ? { ...r, isActive: false } : r)),
    );
    const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
    write(
      LOCAL_SCHEDULES_KEY,
      docs.filter((d) => d.sourceRuleId !== ruleId),
    );
    if (read<string>(LOCAL_ACTIVE_RULE_KEY, "") === ruleId) {
      write(LOCAL_ACTIVE_RULE_KEY, "");
    }
    return { removed: ruleId };
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

  async changeRequestsInRange(from: string, to: string, page = 1): Promise<ChangeRequest[]> {
    const list = read<ChangeRequest[]>(LOCAL_CHANGES_KEY, [])
      .filter((c) => c.businessDate && c.businessDate >= from && c.businessDate <= to)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list.slice((page - 1) * 50, page * 50);
  },

  async removeChangeRequest(id: string): Promise<{ removed: string }> {
    const list = read<ChangeRequest[]>(LOCAL_CHANGES_KEY, []);
    const next = list.filter((c) => c.id !== id);
    if (next.length === list.length) {
      throw new ApiError(404, "NOT_FOUND", "改班记录不存在");
    }
    write(LOCAL_CHANGES_KEY, next);
    return { removed: id };
  },

  async weather(
    from: string,
    to: string,
    location?: WeatherLocation | string,
  ): Promise<WeatherForecast[]> {
    const loc =
      normalizeLocation(location) ??
      getDefaultLocation() ?? { name: "深圳", latitude: 22.5431, longitude: 114.0579 };
    return fetchOpenMeteo(loc, from, to);
  },

  async holidayRange(from: string, to: string): Promise<HolidayMap> {
    const map = await ensureLocalHoliday(from, to);
    return sliceHolidayMap(map, from, to);
  },

  async updateLocation(location: WeatherLocation): Promise<User> {
    setDefaultLocation(location);
    const user = { ...(getUser() ?? localUser()), defaultLocation: location };
    setLocalSession(user, localWorkspace());
    return user;
  },

  async notificationPreferences(): Promise<NotificationPreferences> {
    const prefs = read<NotificationPreferences>(LOCAL_PREFS_KEY, {
      shiftReminders: [15],
      weatherEnabled: true,
      scheduleChangesEnabled: true,
      approvalEnabled: true,
      quietHours: null,
      channels: { wechat: true },
    });
    return {
      ...prefs,
      subscriptions: read<NotificationSubscription[]>("wc_local_subscriptions", []),
    };
  },

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    write(LOCAL_PREFS_KEY, prefs);
    return {
      ...prefs,
      subscriptions: read<NotificationSubscription[]>("wc_local_subscriptions", []),
    };
  },

  async subscribeTemplates(): Promise<SubscribeTemplateInfo[]> {
    return [];
  },

  async saveSubscriptions(subscriptions: NotificationSubscription[]): Promise<{ saved: number }> {
    write("wc_local_subscriptions", subscriptions);
    return { saved: subscriptions.length };
  },

  async scheduleRuleJobs(): Promise<{ scheduled: number }> {
    return { scheduled: 0 };
  },

  async createShareSnapshot(input: ShareSnapshotInput): Promise<ShareSnapshot> {
    const privacy = {
      showDisplayName: Boolean(input.privacyOptions?.showDisplayName),
      showTime: Boolean(input.privacyOptions?.showTime),
      showWeather: Boolean(input.privacyOptions?.showWeather),
      showLocation: Boolean(input.privacyOptions?.showLocation),
      showNote: Boolean(input.privacyOptions?.showNote),
    } as SharePrivacyOptions;
    const entries =
      Array.isArray(input.entries) && input.entries.length > 0
        ? input.entries
        : await buildLocalEntries(input, privacy);
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

async function buildLocalEntries(
  input: ShareSnapshotInput,
  privacy: SharePrivacyOptions,
) {
  const instances = localMergedInstances(input.rangeStart, input.rangeEnd);
  const weatherList = await api.weather(input.rangeStart, input.rangeEnd);
  const holidayMap = await ensureLocalHoliday(input.rangeStart, input.rangeEnd);
  const weatherByDate = new Map(weatherList.map((w) => [w.date, w]));
  return instances.map((row) => {
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
      overtime: isOvertime(holidayMap, row.businessDate, row.kind) || undefined,
    };
  });
}

function fetchHolidayYear(year: number): Promise<HolidayMap> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${HOLIDAY_API}${year}`,
      method: "GET",
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parseHolidayYear(year, res.data));
        } else {
          reject(new Error(`节假日接口返回 ${res.statusCode}`));
        }
      },
      fail: () => reject(new Error("节假日接口连接失败")),
    });
  });
}

async function ensureLocalHoliday(from: string, to: string): Promise<HolidayMap> {
  const cache = readHolidayCache();
  const fromYear = Math.max(2019, Number(from.slice(0, 4)));
  const toYear = Number(to.slice(0, 4));
  let merged = cache;
  for (let year = fromYear; year <= toYear; year += 1) {
    const prefix = `${year}-`;
    const hasYear = Object.keys(merged).some((date) => date.startsWith(prefix));
    if (hasYear) continue;
    try {
      const map = await fetchHolidayYear(year);
      merged = mergeHolidayMaps(merged, map);
      writeHolidayCache(merged);
    } catch {
      // 单个年份失败不影响其余年份
    }
  }
  return merged;
}

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

function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1) - Date.UTC(fy ?? 0, (fm ?? 1) - 1, fd ?? 1)) /
      86_400_000,
  );
}

/** 本地循环规则按需向后滚动补齐（不覆盖手动/临时排班）。 */
async function extendLocalRules(upToDate: string): Promise<void> {
  const rules = read<LocalRule[]>(LOCAL_RULES_KEY, []);
  if (rules.length === 0) return;
  const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
  const templates = ensureTemplates();
  const now = new Date().toISOString();
  let changed = false;
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const end = rule.endDate && rule.endDate < upToDate ? rule.endDate : upToDate;
    const days = diffDays(rule.startDate, end) + 1;
    if (days <= 0) continue;
    const slots = cycleSlots(
      rule.startDate,
      rule.sequence.map((s) => s.shiftTemplateId),
      Math.min(days, 400),
    );
    const occupied = new Set(
      docs
        .filter((d) => d.source === "manual" || d.sourceRuleId === rule.id)
        .map((d) => d.businessDate),
    );
    for (const slot of slots) {
      if (occupied.has(slot.date)) continue;
      const tpl = templates.find((t) => t.id === slot.shiftTemplateId);
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
        sourceRuleId: rule.id,
        shiftSnapshot: snap,
        locationSnapshot: null,
        note: null,
        version: 1,
        history: [],
        createdAt: now,
        updatedAt: now,
      });
      occupied.add(slot.date);
      changed = true;
    }
  }
  if (changed) {
    write(LOCAL_SCHEDULES_KEY, docs);
  }
}

/** 本地：已存在实例 + 当前排班表内存计算补全（不写存储）。 */
function localMergedInstances(from: string, to: string): ScheduleInstance[] {
  const docs = read<LocalInstance[]>(LOCAL_SCHEDULES_KEY, []);
  const active = read<string>(LOCAL_ACTIVE_RULE_KEY, "");
  const existing = docs
    .filter((d) => d.businessDate >= from && d.businessDate <= to)
    .filter((d) => d.source !== "rule" || d.sourceRuleId === active)
    .sort((a, b) => (a.businessDate < b.businessDate ? -1 : 1))
    .map(toInstance);
  const rules = read<LocalRule[]>(LOCAL_RULES_KEY, []).filter((r) => r.isActive);
  const activeRule = rules.find((r) => r.id === active);
  if (!activeRule) return existing;
  const templates = ensureTemplates();
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const byDate = new Map(existing.map((i) => [i.businessDate, i]));
  const merged = [...existing];
  let cursor = from;
  while (cursor <= to) {
    if (!byDate.has(cursor)) {
      const offset = diffDays(activeRule.startDate, cursor);
      if (offset >= 0 && (!activeRule.endDate || cursor <= activeRule.endDate)) {
        const seq = activeRule.sequence ?? [];
        if (seq.length > 0) {
          const item = seq[offset % seq.length];
          const tpl = item ? templateById.get(item.shiftTemplateId) : undefined;
          if (tpl) {
            const snap = snapshotFromTemplate(tpl);
            const times = instanceTimes(cursor, snap);
            merged.push({
              id: `rule:${activeRule.id}:${cursor}`,
              ownerUserId: "local-user",
              businessDate: cursor,
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
            });
          }
        }
      }
    }
    cursor = addDaysLocal(cursor, 1);
  }
  return merged.sort((a, b) => (a.businessDate < b.businessDate ? -1 : 1));
}

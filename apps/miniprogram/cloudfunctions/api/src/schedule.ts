import {
  addDays,
  findOverlapConflicts,
  zonedTimeToIso,
} from "@workcal/schedule-engine";
import { db, _, getWorkspace, requireWorkspace, writeAudit } from "./db";
import { toScheduleInstance } from "./map";
import { assert, assertDate, assertTime, CloudError, nowIso } from "./util";
import { getForDate } from "./weather";
import { get as getPrefs, rebuildJobs } from "./notify";
import { readHolidayRange } from "./holiday";

export function snapshotFromTemplate(tpl: any) {
  return {
    name: tpl.name,
    shortName: tpl.shortName,
    kind: tpl.kind,
    color: tpl.color,
    startTime: tpl.startTime ? String(tpl.startTime).slice(0, 5) : null,
    endTime: tpl.endTime ? String(tpl.endTime).slice(0, 5) : null,
    endsNextDay: Boolean(tpl.endsNextDay),
    unpaidBreakMinutes: tpl.unpaidBreakMinutes ?? 0,
  };
}

export function normalizeSnapshot(input: any) {
  const kind = input.kind ?? "custom";
  const startTime = input.startTime ?? null;
  const endTime = input.endTime ?? null;
  if (kind === "work" && (!startTime || !endTime)) {
    throw new CloudError("VALIDATION_ERROR", "工作类班次必须填写开始和结束时间");
  }
  if (startTime) assertTime(startTime);
  if (endTime) assertTime(endTime);
  const endsNextDay =
    Boolean(input.endsNextDay) || (!!startTime && !!endTime && endTime <= startTime);
  const name = input.name?.trim() || "自定义班次";
  return {
    name,
    shortName: input.shortName?.trim() || name.slice(0, 4) || "自定义",
    kind,
    color: input.color || "#1F6FEB",
    startTime,
    endTime,
    endsNextDay,
    unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes ?? 0),
  };
}

export function instanceTimes(date: string, snap: any, timezone: string) {
  if (snap.kind === "rest" || !snap.startTime || !snap.endTime) {
    return { startsAt: null, endsAt: null };
  }
  const startsAt = zonedTimeToIso(date, snap.startTime, timezone);
  const endDate = snap.endsNextDay ? addDays(date, 1) : date;
  const endsAt = zonedTimeToIso(endDate, snap.endTime, timezone);
  return { startsAt, endsAt };
}

async function resolveSnapshot(
  workspaceId: string,
  shiftTemplateId?: string | null,
  customShift?: any,
) {
  if (shiftTemplateId) {
    const res = await db.collection("shiftTemplates").doc(shiftTemplateId).get();
    if (!res.data || res.data.workspaceId !== workspaceId) {
      throw new CloudError("NOT_FOUND", "班次模板不存在", 404);
    }
    return snapshotFromTemplate(res.data);
  }
  if (customShift) {
    return normalizeSnapshot(customShift);
  }
  throw new CloudError("VALIDATION_ERROR", "必须提供 shiftTemplateId 或 customShift");
}

export async function assertNoOverlap(
  workspaceId: string,
  ownerOpenid: string,
  businessDate: string,
  times: { startsAt: string | null; endsAt: string | null },
  excludeId: string | null,
) {
  if (!times.startsAt || !times.endsAt) return;
  const from = addDays(businessDate, -1);
  const to = addDays(businessDate, 1);
  const res = await db
    .collection("scheduleInstances")
    .where({
      workspaceId,
      ownerOpenid,
      businessDate: _.gte(from).and(_.lte(to)),
    })
    .limit(1000)
    .get();
  const conflicts = findOverlapConflicts(
    { id: "candidate", startsAt: times.startsAt, endsAt: times.endsAt, kind: "work" },
    res.data
      .filter((r: any) => r._id !== excludeId)
      .map((r: any) => ({
        id: r._id,
        startsAt: r.startsAt ?? null,
        endsAt: r.endsAt ?? null,
        kind: r.kind,
      })),
  );
  if (conflicts.length > 0) {
    throw new CloudError("SCHEDULE_CONFLICT", "该时段与现有班次冲突", 409);
  }
}

/**
 * 云端只返回手动/临时改班等真实写入的实例；
 * 循环规则生成的日期由小程序端按规则本地计算，云端不再生成排班实例。
 */
export async function list(
  openid: string,
  payload: { workspaceId: string; from: string; to: string },
) {
  await requireWorkspace(openid, payload.workspaceId);
  assertDate(payload.from);
  assertDate(payload.to);
  if (payload.from > payload.to) {
    throw new CloudError("VALIDATION_ERROR", "from 不能晚于 to");
  }
  const res = await db
    .collection("scheduleInstances")
    .where({
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      businessDate: _.gte(payload.from).and(_.lte(payload.to)),
      source: _.neq("rule"),
    })
    .orderBy("businessDate", "asc")
    .limit(1000)
    .get();
  return res.data.map(toScheduleInstance);
}

export async function create(openid: string, payload: any) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.businessDate, "VALIDATION_ERROR", "businessDate 为必填");
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
      updatedAt: now,
    },
  });
  const doc = await db.collection("scheduleInstances").doc(added._id as string).get();
  const prefs = await getPrefs(openid, { workspaceId: payload.workspaceId });
  await rebuildJobs(openid, payload.workspaceId, doc.data, prefs);
  await writeAudit(openid, payload.workspaceId, "schedule.create", "scheduleInstance", added._id as string, {
    businessDate: payload.businessDate,
    shiftName: snap.name,
  });
  return toScheduleInstance(doc.data);
}

export async function detail(openid: string, payload: { id: string }) {
  const doc = await db.collection("scheduleInstances").doc(payload.id).get();
  const data = doc.data;
  if (!data) {
    throw new CloudError("NOT_FOUND", "排班不存在", 404);
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
    history: (data.history ?? []).map((h: any) => ({
      version: h.version,
      snapshot: h.snapshot,
      changeReason: h.changeReason,
      changedBy: null,
      createdAt: h.createdAt,
    })),
  };
}

export async function update(openid: string, payload: any) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.id && payload.version != null, "VALIDATION_ERROR", "id 与 version 为必填");
  if (payload.changeScope !== "only_this_day") {
    throw new CloudError("FORBIDDEN", "个人模式仅支持修改当天，不影响其他日期", 403);
  }
  const snap = await resolveSnapshot(payload.workspaceId, payload.shiftTemplateId, payload.customShift);
  const before = await db.collection("scheduleInstances").doc(payload.id).get();
  const current = before.data;
  if (!current || current.workspaceId !== payload.workspaceId || current.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "排班不存在", 404);
  }
  if (current.version !== payload.version) {
    throw new CloudError("VERSION_CONFLICT", "数据已被他人修改，请刷新后重试", 409);
  }
  const times = instanceTimes(current.businessDate, snap, current.timezone);
  await assertNoOverlap(current.workspaceId, openid, current.businessDate, times, payload.id);

  const updated = await db.runTransaction(async (transaction: any) => {
    const txDoc = await transaction.collection("scheduleInstances").doc(payload.id).get();
    const txCurrent = txDoc.data;
    if (!txCurrent || txCurrent.version !== payload.version) {
      throw new CloudError("VERSION_CONFLICT", "数据已被他人修改，请刷新后重试", 409);
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
          ...(Array.isArray(txCurrent.history) ? txCurrent.history : []),
          {
            version: newVersion,
            snapshot: txCurrent.shiftSnapshot,
            changeReason: payload.reason || null,
            createdAt: nowIso(),
          },
        ],
        updatedAt: nowIso(),
      },
    });
    const after = await transaction.collection("scheduleInstances").doc(payload.id).get();
    return after.data;
  });

  const prefs = await getPrefs(openid, { workspaceId: payload.workspaceId });
  await rebuildJobs(openid, payload.workspaceId, updated, prefs);
  await writeAudit(openid, payload.workspaceId, "schedule.update", "scheduleInstance", payload.id, {
    shiftName: snap.name,
    reason: payload.reason || null,
  });
  return toScheduleInstance(updated);
}

/** 只保存循环规则，不生成任何排班实例；未来排班由小程序端本地计算。 */
export async function createRule(openid: string, payload: any) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(
    payload.startDate && Array.isArray(payload.sequence) && payload.sequence.length > 0,
    "VALIDATION_ERROR",
    "startDate 与 sequence 为必填",
  );
  assertDate(payload.startDate);
  if (payload.endDate) assertDate(payload.endDate);

  const ids = payload.sequence.map((s: any) => s.shiftTemplateId);
  const tplRes = await db
    .collection("shiftTemplates")
    .where({ workspaceId: payload.workspaceId, _id: _.in(ids) })
    .limit(100)
    .get();
  const tplMap: Map<string, any> = new Map(tplRes.data.map((t: any) => [t._id, t]));
  for (const id of ids) {
    assert(tplMap.has(id), "NOT_FOUND", `班次模板 ${id} 不存在`, 404);
  }

  const horizon = Math.min(366, Math.max(7, payload.generationHorizonDays ?? 90));
  const workspace = await getWorkspace(payload.workspaceId);
  const timezone = payload.timezone ?? workspace.timezone;
  const now = nowIso();
  const ruleName = payload.name?.trim() || "排班表";
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
      updatedAt: now,
    },
  });
  const ruleId = added._id as string;
  await db.collection("users").doc(openid).update({
    data: { activeRuleId: ruleId, updatedAt: now },
  });
  await writeAudit(openid, payload.workspaceId, "schedule_rule.create", "scheduleRule", ruleId, {
    startDate: payload.startDate,
    generatedCount: 0,
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
      isActive: true,
    },
    generatedCount: 0,
    conflicts: [],
  };
}

export async function listRules(openid: string, workspaceId: string) {
  await requireWorkspace(openid, workspaceId);
  const rulesRes = await db
    .collection("scheduleRules")
    .where({ workspaceId, ownerOpenid: openid, isActive: true })
    .orderBy("createdAt", "asc")
    .limit(100)
    .get();
  const userRes = await db.collection("users").doc(openid).get();
  const active = userRes.data?.activeRuleId;
  return rulesRes.data.map((r: any) => ({
    id: r._id,
    name: r.name ?? "未命名排班表",
    startDate: r.startDate,
    endDate: r.endDate ?? null,
    timezone: r.timezone,
    sequence: r.sequence,
    generationHorizonDays: r.generationHorizonDays,
    version: r.version,
    isActive: r.isActive,
    isCurrent: r._id === active,
  }));
}

export async function updateRule(openid: string, workspaceId: string, payload: any) {
  await requireWorkspace(openid, workspaceId);
  assert(payload && payload.id && payload.version != null, "VALIDATION_ERROR", "id 与 version 为必填");
  const ruleRes = await db.collection("scheduleRules").doc(payload.id).get();
  const rule = ruleRes.data;
  if (!rule || rule.workspaceId !== workspaceId || rule.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "排班表不存在", 404);
  }
  if (rule.version !== payload.version) {
    throw new CloudError("VERSION_CONFLICT", "数据已被修改，请刷新后重试", 409);
  }
  const data: Record<string, unknown> = { updatedAt: nowIso(), version: rule.version + 1 };
  if (typeof payload.name === "string") data.name = payload.name.trim() || "排班表";
  if (typeof payload.startDate === "string") {
    assertDate(payload.startDate);
    data.startDate = payload.startDate;
  }
  if (payload.endDate !== undefined) {
    if (payload.endDate) assertDate(payload.endDate);
    data.endDate = payload.endDate ?? null;
  }
  if (Array.isArray(payload.sequence)) {
    assert(payload.sequence.length > 0, "VALIDATION_ERROR", "班次序列不能为空");
    const ids = payload.sequence.map((s: any) => s.shiftTemplateId);
    const tplRes = await db
      .collection("shiftTemplates")
      .where({ workspaceId, _id: _.in(ids) })
      .limit(100)
      .get();
    const found = new Set(tplRes.data.map((t: any) => t._id));
    for (const id of ids) {
      assert(found.has(id), "NOT_FOUND", `班次模板 ${id} 不存在`, 404);
    }
    data.sequence = payload.sequence;
  }
  await db.collection("scheduleRules").doc(payload.id).update({ data });
  const updated = await db.collection("scheduleRules").doc(payload.id).get();
  const userRes = await db.collection("users").doc(openid).get();
  const active = userRes.data?.activeRuleId;
  return {
    id: updated.data._id,
    name: updated.data.name ?? "未命名排班表",
    startDate: updated.data.startDate,
    endDate: updated.data.endDate ?? null,
    timezone: updated.data.timezone,
    sequence: updated.data.sequence,
    generationHorizonDays: updated.data.generationHorizonDays,
    version: updated.data.version,
    isActive: updated.data.isActive,
    isCurrent: updated.data._id === active,
  };
}

export async function switchRule(openid: string, workspaceId: string, ruleId: string) {
  await requireWorkspace(openid, workspaceId);
  const rule = await db.collection("scheduleRules").doc(ruleId).get();
  if (!rule.data || rule.data.workspaceId !== workspaceId || rule.data.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "排班表不存在", 404);
  }
  await db.collection("users").doc(openid).update({
    data: { activeRuleId: ruleId, updatedAt: nowIso() },
  });
  return { ruleId };
}

export async function removeRule(openid: string, workspaceId: string, ruleId: string) {
  await requireWorkspace(openid, workspaceId);
  const rule = await db.collection("scheduleRules").doc(ruleId).get();
  if (!rule.data || rule.data.workspaceId !== workspaceId || rule.data.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "排班表不存在", 404);
  }
  await db.collection("scheduleRules").doc(ruleId).update({
    data: { isActive: false, updatedAt: nowIso() },
  });
  // 规则不再生成实例；历史遗留的规则实例一并移除
  await db.collection("scheduleInstances").where({ sourceRuleId: ruleId }).remove();
  await db.collection("notificationJobs").where({ ruleId, status: "pending" }).remove();
  const userRes = await db.collection("users").doc(openid).get();
  if (userRes.data?.activeRuleId === ruleId) {
    await db.collection("users").doc(openid).update({
      data: { activeRuleId: null, updatedAt: nowIso() },
    });
  }
  return { removed: ruleId };
}

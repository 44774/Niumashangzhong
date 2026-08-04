import {
  addDays,
  findOverlapConflicts,
  generateCycleSlots,
  intervalsOverlap,
  zonedTimeToIso,
} from "@workcal/schedule-engine";
import { db, _, getWorkspace, requireWorkspace, writeAudit } from "./db";
import { toScheduleInstance } from "./map";
import { assert, assertDate, assertTime, CloudError, nowIso } from "./util";
import { getForDate } from "./weather";
import { get as getPrefs, rebuildJobs } from "./notify";

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
    if (!res.data) {
      throw new CloudError("NOT_FOUND", "班次模板不存在", 404);
    }
    if (res.data.workspaceId !== workspaceId) {
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

async function chunkAll<T>(tasks: Promise<T>[], size: number): Promise<void> {
  for (let i = 0; i < tasks.length; i += size) {
    await Promise.all(tasks.slice(i, i + size));
  }
}

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
  const userRes = await db.collection("users").doc(openid).get();
  const weather = await getForDate(userRes.data?.defaultCity || "深圳", data.businessDate);
  return {
    ...toScheduleInstance(data),
    weather,
    pendingChange: null,
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
  const tplMap = new Map(tplRes.data.map((t: any) => [t._id, t]));
  for (const id of ids) {
    assert(tplMap.has(id), "NOT_FOUND", `班次模板 ${id} 不存在`, 404);
  }

  const horizon = Math.min(366, Math.max(7, payload.generationHorizonDays ?? 90));
  const slots = generateCycleSlots({
    startDate: payload.startDate,
    endDate: payload.endDate ?? null,
    sequence: ids,
    generationHorizonDays: horizon,
  });
  const workspace = await getWorkspace(payload.workspaceId);
  const timezone = payload.timezone ?? workspace.timezone;
  const now = nowIso();
  const added = await db.collection("scheduleRules").add({
    data: {
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      name: payload.name ?? null,
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
  const from = slots[0]?.date ?? payload.startDate;
  const to = slots[slots.length - 1]?.date ?? payload.startDate;
  const existingRes = await db
    .collection("scheduleInstances")
    .where({
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      businessDate: _.gte(from).and(_.lte(to)),
    })
    .limit(1000)
    .get();
  const occupied = new Set(existingRes.data.map((r: any) => r.businessDate));
  let generatedCount = 0;
  const inserts: Promise<unknown>[] = [];
  for (const slot of slots) {
    if (occupied.has(slot.date)) continue;
    const tpl = tplMap.get(slot.shiftTemplateId);
    if (!tpl) continue;
    const snap = snapshotFromTemplate(tpl);
    const times = instanceTimes(slot.date, snap, timezone);
    inserts.push(
      db
        .collection("scheduleInstances")
        .add({
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
            updatedAt: now,
          },
        })
        .then(() => {
          generatedCount += 1;
        }),
    );
  }
  await chunkAll(inserts, 10);

  const allRes = await db
    .collection("scheduleInstances")
    .where({
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      businessDate: _.gte(from).and(_.lte(to)),
    })
    .limit(1000)
    .get();
  const conflicts: any[] = [];
  for (const a of allRes.data) {
    for (const b of allRes.data) {
      if (a._id === b._id) continue;
      if (
        intervalsOverlap(
          { id: a._id, startsAt: a.startsAt ?? null, endsAt: a.endsAt ?? null, kind: a.kind },
          { id: b._id, startsAt: b.startsAt ?? null, endsAt: b.endsAt ?? null, kind: b.kind },
        )
      ) {
        conflicts.push({
          type: "overlap",
          severity: "error",
          message: `${a.businessDate} 与 ${b.businessDate} 排班时间重叠`,
          existingScheduleId: b._id,
        });
      }
    }
  }
  await writeAudit(openid, payload.workspaceId, "schedule_rule.create", "scheduleRule", ruleId, {
    startDate: payload.startDate,
    generatedCount,
  });
  return {
    rule: {
      id: ruleId,
      ownerUserId: openid,
      name: payload.name ?? null,
      startDate: payload.startDate,
      endDate: payload.endDate ?? null,
      timezone,
      sequence: payload.sequence,
      generationHorizonDays: horizon,
      version: 1,
      isActive: true,
    },
    generatedCount,
    conflicts,
  };
}

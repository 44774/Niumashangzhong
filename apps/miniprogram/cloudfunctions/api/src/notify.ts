import { db, requireWorkspace } from "./db";
import { docId, nowIso } from "./util";
import { readHolidayRange } from "./holiday";
import { getSubscribeTemplates } from "./subscribe-config";
import { instanceTimes, snapshotFromTemplate } from "./schedule";
import { addDays, todayInTimezone } from "@workcal/schedule-engine";

const DEFAULTS = {
  shiftReminders: [15],
  weatherEnabled: true,
  scheduleChangesEnabled: true,
  approvalEnabled: true,
  holidayOvertimeEnabled: true,
  quietHours: null,
  channels: { wechat: true },
};

export async function get(openid: string, payload: { workspaceId: string }) {
  await requireWorkspace(openid, payload.workspaceId);
  try {
    const res = await db.collection("notificationPrefs").doc(docId([openid, payload.workspaceId])).get();
    if (res.data) {
      return {
        ...DEFAULTS,
        shiftReminders: res.data.shiftReminders ?? DEFAULTS.shiftReminders,
        weatherEnabled: res.data.weatherEnabled ?? DEFAULTS.weatherEnabled,
        scheduleChangesEnabled:
          res.data.scheduleChangesEnabled ?? DEFAULTS.scheduleChangesEnabled,
        approvalEnabled: res.data.approvalEnabled ?? DEFAULTS.approvalEnabled,
        holidayOvertimeEnabled: res.data.holidayOvertimeEnabled ?? DEFAULTS.holidayOvertimeEnabled,
        quietHours: res.data.quietHours ?? DEFAULTS.quietHours,
        channels: res.data.channels ?? DEFAULTS.channels,
        subscriptions: res.data.subscriptions ?? [],
      };
    }
  } catch {
    // 不存在则返回默认值
  }
  return { ...DEFAULTS, subscriptions: [] };
}

export async function save(openid: string, payload: { workspaceId: string; prefs: any }) {
  await requireWorkspace(openid, payload.workspaceId);
  const prefs = payload.prefs ?? {};
  const shiftReminders = Array.isArray(prefs.shiftReminders)
    ? prefs.shiftReminders.filter((m: number) => Number.isInteger(m) && m >= 0 && m <= 10080).slice(0, 5)
    : [15];
  const saved = {
    shiftReminders,
    weatherEnabled: Boolean(prefs.weatherEnabled ?? true),
    scheduleChangesEnabled: Boolean(prefs.scheduleChangesEnabled ?? true),
    approvalEnabled: Boolean(prefs.approvalEnabled ?? true),
    holidayOvertimeEnabled: Boolean(prefs.holidayOvertimeEnabled ?? true),
    quietHours: prefs.quietHours ?? null,
    channels: prefs.channels ?? { wechat: true },
    subscriptions: Array.isArray(prefs.subscriptions) ? prefs.subscriptions : [],
  };
  await db.collection("notificationPrefs").doc(docId([openid, payload.workspaceId])).set({
    data: {
      openid,
      workspaceId: payload.workspaceId,
      ...saved,
      updatedAt: nowIso(),
    },
  });
  return saved;
}

export function templates() {
  return getSubscribeTemplates().map((item) => ({
    key: item.key,
    templateId: item.templateId,
    page: item.page,
    name: item.name,
  }));
}

export async function subscribe(
  openid: string,
  payload: { workspaceId: string; subscriptions: any[] },
) {
  await requireWorkspace(openid, payload.workspaceId);
  const subscriptions = (Array.isArray(payload.subscriptions) ? payload.subscriptions : [])
    .filter((s: any) => s && typeof s.templateId === "string")
    .map((s: any) => ({
      key: s.key ?? "",
      templateId: s.templateId,
      status: ["accepted", "rejected", "banned", "unknown"].includes(s.status)
        ? s.status
        : "unknown",
      grantedAt: s.grantedAt ?? nowIso(),
    }));
  await db.collection("notificationPrefs").doc(docId([openid, payload.workspaceId])).set({
    data: {
      openid,
      workspaceId: payload.workspaceId,
      subscriptions,
      updatedAt: nowIso(),
    },
  });
  return { saved: subscriptions.length };
}

function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1) -
      Date.UTC(fy ?? 0, (fm ?? 1) - 1, fd ?? 1)) /
      86_400_000,
  );
}

/**
 * 按当前排班表预生成未来提醒任务（循环班次由手机本地计算，云端不存实例，
 * 因此在这里把提醒任务提前写入 jobs 集合，由 dispatcher 到期发送）。
 */
export async function scheduleRuleJobs(
  openid: string,
  payload: { workspaceId: string },
): Promise<{ scheduled: number }> {
  await requireWorkspace(openid, payload.workspaceId);
  const userRes = await db.collection("users").doc(openid).get();
  const ruleId: string | undefined = userRes.data?.activeRuleId;
  if (!ruleId) return { scheduled: 0 };
  const ruleRes = await db.collection("scheduleRules").doc(ruleId).get();
  const rule = ruleRes.data;
  if (
    !rule ||
    rule.isActive === false ||
    rule.ownerOpenid !== openid ||
    rule.workspaceId !== payload.workspaceId
  ) {
    return { scheduled: 0 };
  }
  const tplRes = await db
    .collection("shiftTemplates")
    .where({ workspaceId: payload.workspaceId, isActive: true })
    .limit(50)
    .get();
  const tplById: Map<string, any> = new Map(tplRes.data.map((t: any) => [t._id, t]));
  const prefs = await get(openid, payload);
  const timezone = rule.timezone || "Asia/Shanghai";
  const today = todayInTimezone(timezone);
  const horizon = Math.min(30, Math.max(7, rule.generationHorizonDays ?? 30));
  const now = nowIso();

  // 重建当前排班表的待发送任务，避免规则修改后残留旧提醒
  await db.collection("notificationJobs").where({ ruleId, status: "pending" }).remove();

  let scheduled = 0;
  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(today, i);
    if (rule.endDate && date > rule.endDate) break;
    const offset = diffDays(rule.startDate, date);
    if (offset < 0) continue;
    const sequence = rule.sequence ?? [];
    if (sequence.length === 0) break;
    const item = sequence[offset % sequence.length];
    const tpl = item ? tplById.get(item.shiftTemplateId) : undefined;
    if (!tpl) continue;
    const snap = snapshotFromTemplate(tpl);
    const times = instanceTimes(date, snap, timezone);
    if (!times.startsAt) continue; // 休息无提醒
    const holidayMap = await readHolidayRange(date, date);
    const overtime =
      prefs.holidayOvertimeEnabled !== false &&
      snap.kind !== "rest" &&
      holidayMap[date] === "holiday";
    const start = new Date(times.startsAt);
    const basePayload = {
      businessDate: date,
      shiftName: snap.name,
      startTime: snap.startTime,
      endTime: snap.endTime,
      version: rule.version,
      overtime,
      ruleId,
    };
    for (const minutes of prefs.shiftReminders ?? []) {
      const triggerAt = new Date(start.getTime() - minutes * 60_000);
      if (triggerAt.getTime() <= Date.now()) continue;
      await db.collection("notificationJobs").add({
        data: {
          ruleId,
          openid,
          workspaceId: payload.workspaceId,
          instanceId: `rule:${ruleId}:${date}`,
          type: "shift_reminder",
          channel: "wechat_subscribe",
          triggerAt: triggerAt.toISOString(),
          payload: { ...basePayload, reminderMinutes: minutes },
          status: "pending",
          createdAt: now,
        },
      });
      scheduled += 1;
    }
    if (prefs.weatherEnabled) {
      if (new Date(times.startsAt).getTime() <= Date.now()) continue;
      await db.collection("notificationJobs").add({
        data: {
          ruleId,
          openid,
          workspaceId: payload.workspaceId,
          instanceId: `rule:${ruleId}:${date}`,
          type: "weather_reminder",
          channel: "wechat_subscribe",
          triggerAt: times.startsAt as string,
          payload: { ...basePayload },
          status: "pending",
          createdAt: now,
        },
      });
      scheduled += 1;
    }
  }
  return { scheduled };
}

export async function rebuildJobs(openid: string, workspaceId: string, instance: any, prefs: any) {
  await db
    .collection("notificationJobs")
    .where({ instanceId: instance._id, status: "pending" })
    .remove();
  if (!instance.startsAt) return;
  const holidayMap = await readHolidayRange(instance.businessDate, instance.businessDate);
  const overtime =
    prefs.holidayOvertimeEnabled !== false &&
    instance.kind !== "rest" &&
    holidayMap[instance.businessDate] === "holiday";
  const start = new Date(instance.startsAt);
  for (const minutes of prefs.shiftReminders ?? []) {
    const triggerAt = new Date(start.getTime() - minutes * 60_000);
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
          shiftName: instance.shiftSnapshot?.name,
          startTime: instance.shiftSnapshot?.startTime,
          endTime: instance.shiftSnapshot?.endTime,
          reminderMinutes: minutes,
          version: instance.version,
          overtime,
        },
        status: "pending",
        createdAt: nowIso(),
      },
    });
  }
  if (prefs.weatherEnabled) {
    const triggerTime = new Date(instance.startsAt);
    if (triggerTime.getTime() <= Date.now()) return;
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
          shiftName: instance.shiftSnapshot?.name,
          version: instance.version,
          overtime,
        },
        status: "pending",
        createdAt: nowIso(),
      },
    });
  }
}

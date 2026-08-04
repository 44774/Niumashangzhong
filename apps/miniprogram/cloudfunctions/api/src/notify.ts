import { db, requireWorkspace } from "./db";
import { docId, nowIso } from "./util";
import { readHolidayRange } from "./holiday";

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
        shiftReminders: res.data.shiftReminders ?? DEFAULTS.shiftReminders,
        weatherEnabled: res.data.weatherEnabled ?? DEFAULTS.weatherEnabled,
        scheduleChangesEnabled:
          res.data.scheduleChangesEnabled ?? DEFAULTS.scheduleChangesEnabled,
        approvalEnabled: res.data.approvalEnabled ?? DEFAULTS.approvalEnabled,
        holidayOvertimeEnabled: res.data.holidayOvertimeEnabled ?? DEFAULTS.holidayOvertimeEnabled,
        quietHours: res.data.quietHours ?? DEFAULTS.quietHours,
        channels: res.data.channels ?? DEFAULTS.channels,
      };
    }
  } catch {
    // 不存在则返回默认值
  }
  return { ...DEFAULTS };
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

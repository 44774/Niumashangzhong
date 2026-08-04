import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import {
  addDays,
  generateCycleSlots,
  todayInTimezone,
  zonedTimeToIso,
} from "@workcal/schedule-engine";
import type { Db, Tx } from "../db/client.js";
import {
  notificationJobs,
  notificationPreferences,
  scheduleInstances,
  scheduleRules,
  shiftTemplates,
} from "../db/schema.js";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  snapshotFromTemplate,
  toNotificationPreferences,
} from "./mappers.js";
import type { NotificationPreferences, ScheduleInstance } from "@workcal/shared-types";

export async function getPreferences(db: Db, userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const row = rows[0];
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return toNotificationPreferences(row);
}

export async function savePreferences(
  db: Db,
  userId: string,
  workspaceId: string,
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const value = {
    userId,
    workspaceId,
    shiftReminders: prefs.shiftReminders,
    weatherEnabled: prefs.weatherEnabled,
    scheduleChangesEnabled: prefs.scheduleChangesEnabled,
    approvalEnabled: prefs.approvalEnabled,
    quietHours: prefs.quietHours,
    channels: prefs.channels,
    updatedAt: new Date(),
  };
  await db
    .insert(notificationPreferences)
    .values(value)
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.workspaceId],
      set: {
        shiftReminders: value.shiftReminders,
        weatherEnabled: value.weatherEnabled,
        scheduleChangesEnabled: value.scheduleChangesEnabled,
        approvalEnabled: value.approvalEnabled,
        quietHours: value.quietHours,
        channels: value.channels,
        updatedAt: new Date(),
      },
    });
  return prefs;
}

/** 排班变更后重建提醒任务：取消旧任务，按当前版本生成新任务。 */
export async function rebuildInstanceJobs(
  tx: Db | Tx,
  instance: ScheduleInstance,
  userId: string,
  workspaceId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  await tx
    .update(notificationJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(notificationJobs.scheduleInstanceId, instance.id),
        inArray(notificationJobs.status, ["pending", "processing"]),
      ),
    );

  const instanceId = instance.id;
  if (instance.startsAt) {
    const start = new Date(instance.startsAt);
    for (const minutes of prefs.shiftReminders) {
      const triggerAt = new Date(start.getTime() - minutes * 60_000);
      if (triggerAt.getTime() <= Date.now()) continue;
      await tx
        .insert(notificationJobs)
        .values({
          userId,
          workspaceId,
          scheduleInstanceId: instanceId,
          type: "shift_reminder",
          channel: "wechat_subscribe",
          triggerAt,
          payload: {
            instanceId,
            businessDate: instance.businessDate,
            shiftName: instance.shiftSnapshot.name,
            startTime: instance.shiftSnapshot.startTime,
            endTime: instance.shiftSnapshot.endTime,
            reminderMinutes: minutes,
            version: instance.version,
          },
          idempotencyKey: `shift_reminder:${instanceId}:${minutes}:v${instance.version}`,
        })
        .onConflictDoNothing({ target: notificationJobs.idempotencyKey });
    }
    if (prefs.weatherEnabled) {
      await tx
        .insert(notificationJobs)
        .values({
          userId,
          workspaceId,
          scheduleInstanceId: instanceId,
          type: "weather_reminder",
          channel: "wechat_subscribe",
          triggerAt: start,
          payload: {
            instanceId,
            businessDate: instance.businessDate,
            shiftName: instance.shiftSnapshot.name,
            version: instance.version,
          },
          idempotencyKey: `weather_reminder:${instanceId}:v${instance.version}`,
        })
        .onConflictDoNothing({ target: notificationJobs.idempotencyKey });
    }
  }
}

/** 开发通道投递：真实微信订阅消息在配置凭证后接入，当前仅记录日志。 */
export async function processDueJobs(db: Db): Promise<void> {
  const due = await db
    .select()
    .from(notificationJobs)
    .where(and(eq(notificationJobs.status, "pending"), lte(notificationJobs.triggerAt, new Date())))
    .limit(20);
  for (const job of due) {
    await db
      .update(notificationJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(notificationJobs.id, job.id));
    try {
      // 开发通道：脱敏输出 payload，不包含手机号/坐标
      console.log(
        `[notification:dev] ${job.type} -> user ${job.userId} (${job.channel})`,
        JSON.stringify(job.payload),
      );
      await db
        .update(notificationJobs)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(notificationJobs.id, job.id));
    } catch (err) {
      const message = (err as Error).message;
      await db
        .update(notificationJobs)
        .set({
          status: "failed",
          lastError: message.slice(0, 500),
          attempts: job.attempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(notificationJobs.id, job.id));
    }
  }
}

/** 循环规则滚动补齐：把活跃规则生成到 startDate + horizon - 1。 */
export async function extendRules(db: Db): Promise<void> {
  const activeRules = await db
    .select()
    .from(scheduleRules)
    .where(and(eq(scheduleRules.isActive, true), isNull(scheduleRules.deletedAt)));
  for (const rule of activeRules) {
    const horizonEnd = addDays(rule.startDate, rule.generationHorizonDays - 1);
    const rollEnd = addDays(todayInTimezone(rule.timezone), 90);
    const candidate = horizonEnd > rollEnd ? horizonEnd : rollEnd;
    const target = rule.endDate && rule.endDate < candidate ? rule.endDate : candidate;
    const slots = generateCycleSlots({
      startDate: rule.startDate,
      endDate: target,
      sequence: rule.sequence.map((s) => s.shiftTemplateId),
      generationHorizonDays: 400,
    });
    const existing = await db
      .select({ businessDate: scheduleInstances.businessDate })
      .from(scheduleInstances)
      .where(
        and(
          eq(scheduleInstances.sourceRuleId, rule.id),
          isNull(scheduleInstances.deletedAt),
        ),
      );
    const existingDates = new Set(existing.map((r) => r.businessDate));
    let inserted = 0;
    for (const slot of slots) {
      if (existingDates.has(slot.date)) continue;
      // 规则补齐不得覆盖手动/临时实例
      const manual = await db
        .select({ id: scheduleInstances.id })
        .from(scheduleInstances)
        .where(
          and(
            eq(scheduleInstances.workspaceId, rule.workspaceId),
            eq(scheduleInstances.ownerUserId, rule.ownerUserId),
            eq(scheduleInstances.businessDate, slot.date),
            isNull(scheduleInstances.deletedAt),
          ),
        )
        .limit(1);
      if (manual.length > 0) continue;
      const template = await db
        .select()
        .from(shiftTemplates)
        .where(
          and(
            eq(shiftTemplates.id, slot.shiftTemplateId),
            isNull(shiftTemplates.deletedAt),
          ),
        )
        .limit(1);
      if (template.length === 0) continue;
      const tpl = template[0];
      if (!tpl) continue;
      const snap = snapshotFromTemplate(tpl);
      const startsAt =
        snap.startTime && snap.endTime
          ? zonedTimeToIso(slot.date, snap.startTime, rule.timezone)
          : null;
      const endsAt =
        snap.startTime && snap.endTime
          ? zonedTimeToIso(
              addDays(slot.date, snap.endsNextDay || snap.endTime <= snap.startTime ? 1 : 0),
              snap.endTime,
              rule.timezone,
            )
          : null;
      await db.insert(scheduleInstances).values({
        workspaceId: rule.workspaceId,
        ownerUserId: rule.ownerUserId,
        businessDate: slot.date,
        timezone: rule.timezone,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        kind: snap.kind,
        shiftTemplateId: slot.shiftTemplateId,
        shiftSnapshot: snap,
        status: "scheduled",
        source: "rule",
        sourceRuleId: rule.id,
      });
      inserted += 1;
    }
    if (inserted > 0) {
      console.log(`[rules] 规则 ${rule.id} 补齐 ${inserted} 个实例`);
    }
  }
}

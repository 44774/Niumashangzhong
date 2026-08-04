import { addDays, todayInTimezone } from "@workcal/schedule-engine";
import { db, ensureUserAndWorkspace } from "./db";
import { toUser, toWorkspace } from "./map";
import { nowIso } from "./util";
import { instanceTimes, snapshotFromTemplate } from "./schedule";

/** 演示数据：按早/晚/夜/休生成今日起 7 天排班（跳过已有日期） */
export async function seedDemo(openid: string) {
  const { user, workspace } = await ensureUserAndWorkspace(openid, "张小明");
  const templatesRes = await db
    .collection("shiftTemplates")
    .where({ workspaceId: workspace._id, isActive: true })
    .orderBy("sortOrder", "asc")
    .limit(10)
    .get();
  const templates = templatesRes.data;
  const today = todayInTimezone(workspace.timezone);
  const plan = [0, 1, 2, 3, 0, 1, 3];
  let created = 0;
  for (let i = 0; i < plan.length; i += 1) {
    const date = addDays(today, i);
    const exists = await db
      .collection("scheduleInstances")
      .where({ workspaceId: workspace._id, ownerOpenid: openid, businessDate: date })
      .limit(1)
      .get();
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
        updatedAt: nowIso(),
      },
    });
    created += 1;
  }
  return { user: toUser(user), workspace: toWorkspace(workspace), created };
}

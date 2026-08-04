import { and, eq } from "drizzle-orm";
import { addDays, todayInTimezone } from "@workcal/schedule-engine";
import { loadConfig } from "../config.js";
import { createDb } from "../db/client.js";
import { scheduleInstances, shiftTemplates } from "../db/schema.js";
import { getOrCreateAuthContext } from "../modules/auth/routes.js";
import { snapshotFromTemplate } from "../lib/mappers.js";
import { instanceTimes } from "../lib/snapshot.js";

async function main() {
  const config = loadConfig();
  const db = createDb(config.databaseUrl);
  try {
    const { user, workspace } = await getOrCreateAuthContext(db, "dev:张小明", "张小明");
    console.log(`演示用户: ${user.displayName} (${user.id})`);
    console.log(`个人空间: ${workspace.name} (${workspace.id})`);

    const templates = await db
      .select()
      .from(shiftTemplates)
      .where(and(eq(shiftTemplates.workspaceId, workspace.id), eq(shiftTemplates.isActive, true)))
      .orderBy(shiftTemplates.sortOrder);
    const today = todayInTimezone(workspace.timezone);
    const plan: Array<{ offset: number; templateIndex: number }> = [
      { offset: 0, templateIndex: 0 },
      { offset: 1, templateIndex: 1 },
      { offset: 2, templateIndex: 2 },
      { offset: 3, templateIndex: 3 },
      { offset: 4, templateIndex: 0 },
      { offset: 5, templateIndex: 1 },
      { offset: 6, templateIndex: 3 },
    ];
    let inserted = 0;
    for (const item of plan) {
      const template = templates[item.templateIndex];
      if (!template) continue;
      const date = addDays(today, item.offset);
      const exists = await db
        .select({ id: scheduleInstances.id })
        .from(scheduleInstances)
        .where(
          and(
            eq(scheduleInstances.workspaceId, workspace.id),
            eq(scheduleInstances.ownerUserId, user.id),
            eq(scheduleInstances.businessDate, date),
          ),
        )
        .limit(1);
      if (exists.length > 0) continue;
      const snapshot = snapshotFromTemplate(template);
      const times = instanceTimes(date, snapshot, workspace.timezone);
      await db.insert(scheduleInstances).values({
        workspaceId: workspace.id,
        ownerUserId: user.id,
        businessDate: date,
        timezone: workspace.timezone,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        kind: snapshot.kind,
        shiftTemplateId: template.id,
        shiftSnapshot: snapshot,
        status: "scheduled",
        source: "manual",
        createdBy: user.id,
      });
      inserted += 1;
    }
    console.log(`已生成 ${inserted} 条演示排班（今日起 7 天）`);
  } finally {
    await db.$client.end?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

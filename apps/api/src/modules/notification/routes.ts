import type { FastifyInstance } from "fastify";
import type { NotificationPreferences } from "@workcal/shared-types";
import type { Db } from "../../db/client.js";
import { requireAuth, requireWorkspace } from "../../lib/auth.js";
import { getPreferences, savePreferences } from "../../lib/notifications.js";

export async function notificationRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const { db } = opts;

  app.get(
    "/notification-preferences",
    { schema: { tags: ["Notifications"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      return getPreferences(db, userId, ws.workspaceId);
    },
  );

  app.put<{ Body: NotificationPreferences }>(
    "/notification-preferences",
    { schema: { tags: ["Notifications"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const prefs = req.body;
      const shiftReminders = Array.isArray(prefs?.shiftReminders)
        ? prefs.shiftReminders
            .filter((m) => Number.isInteger(m) && m >= 0 && m <= 10080)
            .slice(0, 5)
        : [15];
      const saved = await savePreferences(db, userId, ws.workspaceId, {
        shiftReminders,
        weatherEnabled: Boolean(prefs?.weatherEnabled ?? true),
        scheduleChangesEnabled: Boolean(prefs?.scheduleChangesEnabled ?? true),
        approvalEnabled: Boolean(prefs?.approvalEnabled ?? true),
        quietHours: prefs?.quietHours ?? null,
        channels: prefs?.channels ?? { wechat: true },
      });
      return saved;
    },
  );
}

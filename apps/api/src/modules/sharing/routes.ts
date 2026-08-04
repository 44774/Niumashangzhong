import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type { ShareSnapshot, ShareSnapshotInput } from "@workcal/shared-types";
import { formatTimeRangeFromSnapshot } from "@workcal/schedule-engine";
import type { Db } from "../../db/client.js";
import { scheduleInstances, shareSnapshots, users } from "../../db/schema.js";
import { requireAuth, requireWorkspace } from "../../lib/auth.js";
import { writeAudit } from "../../lib/audit.js";
import { validationError } from "../../lib/errors.js";
import type { WeatherService } from "../../lib/weather.js";
import { validateBusinessDate } from "../../lib/snapshot.js";

export async function sharingRoutes(
  app: FastifyInstance,
  opts: { db: Db; weather: WeatherService },
): Promise<void> {
  const { db, weather } = opts;

  app.post<{ Body: ShareSnapshotInput }>(
    "/share-snapshots",
    { schema: { tags: ["Sharing"] } },
    async (req, reply) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const body = req.body;
      if (!body?.rangeStart || !body?.rangeEnd) {
        throw validationError("rangeStart 与 rangeEnd 为必填");
      }
      validateBusinessDate(body.rangeStart);
      validateBusinessDate(body.rangeEnd);
      if (body.rangeStart > body.rangeEnd) {
        throw validationError("rangeStart 不能晚于 rangeEnd");
      }
      const privacy = {
        showDisplayName: Boolean(body.privacyOptions?.showDisplayName),
        showTime: Boolean(body.privacyOptions?.showTime),
        showWeather: Boolean(body.privacyOptions?.showWeather),
        showLocation: Boolean(body.privacyOptions?.showLocation),
        showNote: Boolean(body.privacyOptions?.showNote),
      };
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userRow[0];
      const city = user?.defaultCity ?? "深圳";
      const weatherList = await weather.getRange(
        city,
        body.rangeStart,
        body.rangeEnd,
        ws.timezone,
      );
      const weatherByDate = new Map(weatherList.map((w) => [w.date, w]));
      const instances = await db
        .select()
        .from(scheduleInstances)
        .where(
          and(
            eq(scheduleInstances.workspaceId, ws.workspaceId),
            eq(scheduleInstances.ownerUserId, userId),
            gte(scheduleInstances.businessDate, body.rangeStart),
            lte(scheduleInstances.businessDate, body.rangeEnd),
            isNull(scheduleInstances.deletedAt),
          ),
        )
        .orderBy(asc(scheduleInstances.businessDate));

      const snapshotId = randomUUID();
      const snapshot: ShareSnapshot = {
        id: snapshotId,
        ownerDisplayName: privacy.showDisplayName ? user?.displayName ?? null : null,
        rangeStart: body.rangeStart,
        rangeEnd: body.rangeEnd,
        templateCode: body.templateCode || "default",
        privacyOptions: privacy,
        entries: instances.map((row) => {
          const forecast = weatherByDate.get(row.businessDate);
          return {
            date: row.businessDate,
            shiftName: row.shiftSnapshot.name,
            shortName: row.shiftSnapshot.shortName,
            kind: row.shiftSnapshot.kind,
            color: row.shiftSnapshot.color,
            timeText: privacy.showTime ? formatTimeRangeFromSnapshot(row.shiftSnapshot) : null,
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
        }),
        createdAt: new Date().toISOString(),
      };
      const inserted = await db
        .insert(shareSnapshots)
        .values({
          id: snapshotId,
          workspaceId: ws.workspaceId,
          creatorUserId: userId,
          rangeStart: body.rangeStart,
          rangeEnd: body.rangeEnd,
          privacyOptions: privacy as unknown as Record<string, boolean>,
          snapshot: snapshot as unknown as Record<string, unknown>,
          templateCode: body.templateCode || "default",
        })
        .returning();
      const row = inserted[0];
      if (!row) throw validationError("分享快照创建失败");
      await writeAudit(db, {
        workspaceId: ws.workspaceId,
        actorUserId: userId,
        action: "share_snapshot.create",
        resourceType: "share_snapshot",
        resourceId: row.id,
        requestId: req.id,
        afterSummary: { rangeStart: body.rangeStart, rangeEnd: body.rangeEnd, entries: snapshot.entries.length },
      });
      reply.code(201).send(snapshot);
    },
  );
}

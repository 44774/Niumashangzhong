import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type {
  ChangeRequest,
  ChangeRequestInput,
  ChangeStatus,
  ShiftSnapshot,
} from "@workcal/shared-types";
import type { Db } from "../../db/client.js";
import { scheduleChangeRequests, scheduleInstances } from "../../db/schema.js";
import { requireAuth, requireWorkspace } from "../../lib/auth.js";
import { writeAudit } from "../../lib/audit.js";
import { notFound, validationError } from "../../lib/errors.js";
import { withIdempotency } from "../../lib/idempotency.js";
import { toChangeRequest, toScheduleInstance } from "../../lib/mappers.js";
import { getPreferences, rebuildInstanceJobs } from "../../lib/notifications.js";
import { instanceTimes, normalizeSnapshot } from "../../lib/snapshot.js";
import { updateInstance } from "../schedule/routes.js";

export async function changeRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const { db } = opts;

  app.post<{ Body: ChangeRequestInput }>(
    "/change-requests",
    {
      schema: { tags: ["Changes"] },
    },
    async (req, reply) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const body = req.body;
      if (!body?.scheduleInstanceId || !body.requestedShift) {
        throw validationError("scheduleInstanceId 与 requestedShift 为必填");
      }
      const key = Array.isArray(req.headers["idempotency-key"])
        ? req.headers["idempotency-key"][0]
        : req.headers["idempotency-key"];
      const result = await withIdempotency<ChangeRequest>(db, "change-request", key, async (tx) => {
        const rows = await tx
          .select()
          .from(scheduleInstances)
          .where(
            and(
              eq(scheduleInstances.id, body.scheduleInstanceId),
              eq(scheduleInstances.workspaceId, ws.workspaceId),
              eq(scheduleInstances.ownerUserId, userId),
              isNull(scheduleInstances.deletedAt),
            ),
          )
          .limit(1);
        const current = rows[0];
        if (!current) throw notFound("排班不存在");
        const requested: ShiftSnapshot = normalizeSnapshot(body.requestedShift);
        const times = instanceTimes(current.businessDate, requested, ws.timezone);

        // 个人模式：直接生效并留痕
        await updateInstance(
          tx,
          current.id,
          userId,
          requested,
          times,
          current.note,
          body.reason ?? "临时改班",
          ws.workspaceId,
          req.id,
        );
        const inserted = await tx
          .insert(scheduleChangeRequests)
          .values({
            workspaceId: ws.workspaceId,
            scheduleInstanceId: current.id,
            requesterUserId: userId,
            businessDate: current.businessDate,
            originalSnapshot: current.shiftSnapshot,
            requestedSnapshot: requested,
            reason: body.reason ?? null,
            status: "approved",
            approverUserId: userId,
            approvalNote: "个人模式直接生效",
            decidedAt: new Date(),
            idempotencyKey: key ?? null,
          })
          .returning();
        const row = inserted[0];
        if (!row) throw validationError("改班申请创建失败");
        const api = toChangeRequest(row);
        const prefs = await getPreferences(tx as unknown as Db, userId, ws.workspaceId);
        await rebuildInstanceJobs(tx, toScheduleInstance(current), userId, ws.workspaceId, prefs);
        await writeAudit(tx, {
          workspaceId: ws.workspaceId,
          actorUserId: userId,
          action: "change_request.approved_direct",
          resourceType: "change_request",
          resourceId: row.id,
          requestId: req.id,
          beforeSummary: current.shiftSnapshot as unknown as Record<string, unknown>,
          afterSummary: requested as unknown as Record<string, unknown>,
        });
        return api;
      });
      reply.code(201).send(result);
    },
  );

  app.get<{ Querystring: { status?: string; from?: string; to?: string; page?: string } }>(
    "/change-requests",
    { schema: { tags: ["Changes"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const conditions = [
        eq(scheduleChangeRequests.workspaceId, ws.workspaceId),
        eq(scheduleChangeRequests.requesterUserId, userId),
      ];
      if (req.query.status) {
        conditions.push(eq(scheduleChangeRequests.status, req.query.status as ChangeStatus));
      }
      if (req.query.from && req.query.to) {
        conditions.push(
          gte(scheduleChangeRequests.businessDate, req.query.from),
          lte(scheduleChangeRequests.businessDate, req.query.to),
        );
      }
      const page = Math.max(1, Number(req.query.page) || 1);
      const rows = await db
        .select()
        .from(scheduleChangeRequests)
        .where(and(...conditions))
        .orderBy(desc(scheduleChangeRequests.createdAt))
        .limit(50)
        .offset((page - 1) * 50);
      return rows.map(toChangeRequest);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/change-requests/:id",
    { schema: { tags: ["Changes"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const rows = await db
        .select()
        .from(scheduleChangeRequests)
        .where(
          and(
            eq(scheduleChangeRequests.id, req.params.id),
            eq(scheduleChangeRequests.workspaceId, ws.workspaceId),
            eq(scheduleChangeRequests.requesterUserId, userId),
          ),
        )
        .limit(1);
      if (rows.length === 0) throw notFound("改班记录不存在");
      await db
        .delete(scheduleChangeRequests)
        .where(eq(scheduleChangeRequests.id, req.params.id));
      return { removed: req.params.id };
    },
  );
}

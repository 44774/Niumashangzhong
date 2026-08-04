import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import type { ShiftTemplateInput } from "@workcal/shared-types";
import type { Db } from "../../db/client.js";
import { shiftTemplates } from "../../db/schema.js";
import { requireAuth, requireWorkspace } from "../../lib/auth.js";
import { writeAudit } from "../../lib/audit.js";
import { notFound, validationError, versionConflict } from "../../lib/errors.js";
import { snapshotFromTemplate, toShiftTemplate } from "../../lib/mappers.js";

interface TemplateBody extends ShiftTemplateInput {
  version?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export async function shiftRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const { db } = opts;

  app.get<{ Querystring: { active?: string } }>(
    "/shift-templates",
    { schema: { tags: ["Shifts"] } },
    async (req) => {
      await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const conditions = [
        eq(shiftTemplates.workspaceId, ws.workspaceId),
        isNull(shiftTemplates.deletedAt),
      ];
      if (req.query.active === "true") {
        conditions.push(eq(shiftTemplates.isActive, true));
      }
      const rows = await db
        .select()
        .from(shiftTemplates)
        .where(and(...conditions))
        .orderBy(shiftTemplates.sortOrder);
      return rows.map(toShiftTemplate);
    },
  );

  app.post<{ Body: TemplateBody }>(
    "/shift-templates",
    { schema: { tags: ["Shifts"] } },
    async (req, reply) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const body = req.body;
      if (!body?.name?.trim() || !body?.shortName?.trim()) {
        throw validationError("班次名称与简称不能为空");
      }
      if (body.kind === "work" && (!body.startTime || !body.endTime)) {
        throw validationError("工作类班次必须填写开始和结束时间");
      }
      const inserted = await db
        .insert(shiftTemplates)
        .values({
          workspaceId: ws.workspaceId,
          name: body.name.trim(),
          shortName: body.shortName.trim().slice(0, 12),
          kind: body.kind,
          color: body.color,
          startTime: body.startTime,
          endTime: body.endTime,
          endsNextDay: Boolean(body.endsNextDay),
          unpaidBreakMinutes: body.unpaidBreakMinutes ?? 0,
          defaultLocationId: body.defaultLocationId ?? null,
          sortOrder: body.sortOrder ?? 0,
          createdBy: userId,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw validationError("班次创建失败");
      await writeAudit(db, {
        workspaceId: ws.workspaceId,
        actorUserId: userId,
        action: "shift_template.create",
        resourceType: "shift_template",
        resourceId: row.id,
        requestId: req.id,
        afterSummary: snapshotFromTemplate(row) as unknown as Record<string, unknown>,
      });
      reply.code(201).send(toShiftTemplate(row));
    },
  );

  app.patch<{ Params: { id: string }; Body: TemplateBody }>(
    "/shift-templates/:id",
    { schema: { tags: ["Shifts"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const rows = await db
        .select()
        .from(shiftTemplates)
        .where(
          and(
            eq(shiftTemplates.id, req.params.id),
            eq(shiftTemplates.workspaceId, ws.workspaceId),
            isNull(shiftTemplates.deletedAt),
          ),
        )
        .limit(1);
      const current = rows[0];
      if (!current) throw notFound("班次模板不存在");
      if (req.body.version !== undefined && req.body.version !== current.version) {
        throw versionConflict();
      }
      const body = req.body;
      if (body.kind === "work" && (!body.startTime || !body.endTime)) {
        throw validationError("工作类班次必须填写开始和结束时间");
      }
      const updated = await db
        .update(shiftTemplates)
        .set({
          name: body.name?.trim() || current.name,
          shortName: body.shortName?.trim()?.slice(0, 12) || current.shortName,
          kind: body.kind ?? current.kind,
          color: body.color ?? current.color,
          startTime: body.startTime !== undefined ? body.startTime : current.startTime,
          endTime: body.endTime !== undefined ? body.endTime : current.endTime,
          endsNextDay: body.endsNextDay ?? current.endsNextDay,
          unpaidBreakMinutes: body.unpaidBreakMinutes ?? current.unpaidBreakMinutes,
          defaultLocationId:
            body.defaultLocationId !== undefined ? body.defaultLocationId : current.defaultLocationId,
          sortOrder: body.sortOrder ?? current.sortOrder,
          isActive: body.isActive !== undefined ? body.isActive : current.isActive,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(shiftTemplates.id, current.id))
        .returning();
      const row = updated[0];
      if (!row) throw notFound("班次模板不存在");
      await writeAudit(db, {
        workspaceId: ws.workspaceId,
        actorUserId: userId,
        action: "shift_template.update",
        resourceType: "shift_template",
        resourceId: row.id,
        requestId: req.id,
        beforeSummary: snapshotFromTemplate(current) as unknown as Record<string, unknown>,
        afterSummary: snapshotFromTemplate(row) as unknown as Record<string, unknown>,
      });
      return toShiftTemplate(row);
    },
  );
}

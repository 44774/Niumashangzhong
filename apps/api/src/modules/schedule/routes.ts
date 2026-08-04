import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type {
  ScheduleCreateInput,
  ScheduleDetail,
  ScheduleRuleCreateResult,
  ScheduleUpdateInput,
  ShiftSnapshot,
} from "@workcal/shared-types";
import {
  addDays,
  findOverlapConflicts,
  generateCycleSlots,
  intervalsOverlap,
} from "@workcal/schedule-engine";
import type { Db, Tx } from "../../db/client.js";
import {
  scheduleInstanceVersions,
  scheduleInstances,
  scheduleRules,
  shiftTemplates,
  users,
} from "../../db/schema.js";
import { requireAuth, requireWorkspace } from "../../lib/auth.js";
import { writeAudit } from "../../lib/audit.js";
import {
  forbidden,
  notFound,
  scheduleConflict,
  validationError,
  versionConflict,
} from "../../lib/errors.js";
import {
  snapshotFromTemplate,
  toScheduleInstance,
} from "../../lib/mappers.js";
import { instanceTimes, normalizeSnapshot, validateBusinessDate } from "../../lib/snapshot.js";
import type { WeatherService } from "../../lib/weather.js";
import { getPreferences, rebuildInstanceJobs } from "../../lib/notifications.js";

export async function scheduleRoutes(
  app: FastifyInstance,
  opts: { db: Db; weather: WeatherService },
): Promise<void> {
  const { db, weather } = opts;

  app.get<{ Querystring: { from: string; to: string; ownerUserId?: string } }>(
    "/schedules",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const { from, to } = req.query;
      if (!from || !to) throw validationError("from 与 to 为必填日期");
      validateBusinessDate(from);
      validateBusinessDate(to);
      if (from > to) throw validationError("from 不能晚于 to");
      if (req.query.ownerUserId && req.query.ownerUserId !== userId) {
        throw forbidden("个人模式只能查看自己的排班");
      }
      const rows = await db
        .select()
        .from(scheduleInstances)
        .where(
          and(
            eq(scheduleInstances.workspaceId, ws.workspaceId),
            eq(scheduleInstances.ownerUserId, userId),
            gte(scheduleInstances.businessDate, from),
            lte(scheduleInstances.businessDate, to),
            isNull(scheduleInstances.deletedAt),
          ),
        )
        .orderBy(scheduleInstances.businessDate);
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const activeRuleId = userRow[0]?.activeRuleId ?? null;
      const visible = activeRuleId
        ? rows.filter((r) => r.sourceRuleId === activeRuleId || r.source !== "rule")
        : rows;
      return visible.map(toScheduleInstance);
    },
  );

  app.post<{ Body: ScheduleCreateInput }>(
    "/schedules",
    { schema: { tags: ["Schedules"] } },
    async (req, reply) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const body = req.body;
      if (!body?.businessDate) throw validationError("businessDate 为必填");
      validateBusinessDate(body.businessDate);
      if (body.ownerUserId && body.ownerUserId !== userId) {
        throw forbidden("个人模式只能为自己排班");
      }
      let snapshot: ShiftSnapshot;
      if (body.shiftTemplateId) {
        const template = await db
          .select()
          .from(shiftTemplates)
          .where(
            and(
              eq(shiftTemplates.id, body.shiftTemplateId),
              eq(shiftTemplates.workspaceId, ws.workspaceId),
              isNull(shiftTemplates.deletedAt),
            ),
          )
          .limit(1);
        if (template.length === 0) throw notFound("班次模板不存在");
        const tpl = template[0];
        if (!tpl) throw notFound("班次模板不存在");
        snapshot = snapshotFromTemplate(tpl);
      } else if (body.customShift) {
        snapshot = normalizeSnapshot(body.customShift);
      } else {
        throw validationError("必须提供 shiftTemplateId 或 customShift");
      }
      const times = instanceTimes(body.businessDate, snapshot, ws.timezone);
      await assertNoOverlap(db, ws.workspaceId, userId, body.businessDate, times, null);
      const inserted = await db
        .insert(scheduleInstances)
        .values({
          workspaceId: ws.workspaceId,
          ownerUserId: userId,
          businessDate: body.businessDate,
          timezone: ws.timezone,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          kind: snapshot.kind,
          shiftTemplateId: body.shiftTemplateId ?? null,
          shiftSnapshot: snapshot,
          locationId: body.locationId ?? null,
          note: body.note ?? null,
          status: "scheduled",
          source: "manual",
          createdBy: userId,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw validationError("排班创建失败");
      const api = toScheduleInstance(row);
      const prefs = await getPreferences(db, userId, ws.workspaceId);
      await rebuildInstanceJobs(db, api, userId, ws.workspaceId, prefs);
      await writeAudit(db, {
        workspaceId: ws.workspaceId,
        actorUserId: userId,
        action: "schedule.create",
        resourceType: "schedule_instance",
        resourceId: row.id,
        requestId: req.id,
        afterSummary: snapshot as unknown as Record<string, unknown>,
      });
      reply.code(201).send(api);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/schedules/:id",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const row = await loadOwnedInstance(db, ws.workspaceId, userId, req.params.id);
      const historyRows = await db
        .select()
        .from(scheduleInstanceVersions)
        .where(eq(scheduleInstanceVersions.scheduleInstanceId, row.id))
        .orderBy(asc(scheduleInstanceVersions.version));
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const city = userRow[0]?.defaultCity ?? "深圳";
      const weatherList = await weather.getRange(city, row.businessDate, row.businessDate, ws.timezone);
      const detail: ScheduleDetail = {
        ...toScheduleInstance(row),
        weather: weatherList.find((w) => w.date === row.businessDate) ?? null,
        pendingChange: null,
        history: historyRows.map((h) => ({
          version: h.version,
          snapshot: h.snapshot,
          changeReason: h.changeReason,
          changedBy: h.changedBy,
          createdAt: h.createdAt.toISOString(),
        })),
      };
      return detail;
    },
  );

  app.patch<{ Params: { id: string }; Body: ScheduleUpdateInput }>(
    "/schedules/:id",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const row = await loadOwnedInstance(db, ws.workspaceId, userId, req.params.id);
      const body = req.body;
      if (!body) throw validationError("请求体不能为空");
      if (body.changeScope !== "only_this_day") {
        throw forbidden("个人模式仅支持修改当天，不影响其他日期");
      }
      if (body.version !== row.version) {
        throw versionConflict();
      }
      let snapshot: ShiftSnapshot;
      if (body.shiftTemplateId) {
        const template = await db
          .select()
          .from(shiftTemplates)
          .where(
            and(
              eq(shiftTemplates.id, body.shiftTemplateId),
              eq(shiftTemplates.workspaceId, ws.workspaceId),
              isNull(shiftTemplates.deletedAt),
            ),
          )
          .limit(1);
        if (template.length === 0) throw notFound("班次模板不存在");
        const tpl = template[0];
        if (!tpl) throw notFound("班次模板不存在");
        snapshot = snapshotFromTemplate(tpl);
      } else if (body.customShift) {
        snapshot = normalizeSnapshot(body.customShift);
      } else {
        throw validationError("必须提供 shiftTemplateId 或 customShift");
      }
      const times = instanceTimes(row.businessDate, snapshot, ws.timezone);
      await assertNoOverlap(db, ws.workspaceId, userId, row.businessDate, times, row.id);
      const updated = await updateInstance(
        db,
        row.id,
        userId,
        snapshot,
        times,
        body.note ?? row.note,
        body.reason,
        ws.workspaceId,
        req.id,
      );
      return toScheduleInstance(updated);
    },
  );

  app.post<{ Body: import("@workcal/shared-types").ScheduleRuleInput }>(
    "/schedule-rules",
    { schema: { tags: ["Schedules"] } },
    async (req, reply) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const body = req.body;
      if (!body) throw validationError("请求体不能为空");
      if (body.ownerUserId !== userId) {
        throw forbidden("个人模式只能为自己创建循环规则");
      }
      validateBusinessDate(body.startDate);
      if (body.endDate) validateBusinessDate(body.endDate);
      if (!Array.isArray(body.sequence) || body.sequence.length === 0) {
        throw validationError("循环序列不能为空");
      }
      const templateIds = body.sequence.map((s) => s.shiftTemplateId);
      const templates = await db
        .select()
        .from(shiftTemplates)
        .where(
          and(
            inArray(shiftTemplates.id, templateIds),
            eq(shiftTemplates.workspaceId, ws.workspaceId),
            isNull(shiftTemplates.deletedAt),
          ),
        );
      const found = new Set(templates.map((t) => t.id));
      for (const id of templateIds) {
        if (!found.has(id)) throw notFound(`班次模板 ${id} 不存在`);
      }
      const horizon = Math.min(366, Math.max(7, body.generationHorizonDays ?? 90));
      const slots = generateCycleSlots({
        startDate: body.startDate,
        endDate: body.endDate ?? null,
        sequence: templateIds,
        generationHorizonDays: horizon,
      });
      const ruleName = body.name?.trim() || "排班表";
      const insertedRule = await db
        .insert(scheduleRules)
        .values({
          workspaceId: ws.workspaceId,
          ownerUserId: userId,
          name: ruleName,
          startDate: body.startDate,
          endDate: body.endDate ?? null,
          sequence: body.sequence,
          timezone: body.timezone ?? ws.timezone,
          generationHorizonDays: horizon,
          createdBy: userId,
        })
        .returning();
      const ruleRow = insertedRule[0];
      if (!ruleRow) throw validationError("循环规则创建失败");
      await db.update(users).set({ activeRuleId: ruleRow.id }).where(eq(users.id, userId));

      let generatedCount = 0;
      const conflicts: ScheduleRuleCreateResult["conflicts"] = [];
      const existingDates = await db
        .select({ businessDate: scheduleInstances.businessDate })
        .from(scheduleInstances)
        .where(
          and(
            eq(scheduleInstances.workspaceId, ws.workspaceId),
            eq(scheduleInstances.ownerUserId, userId),
            gte(scheduleInstances.businessDate, slots[0]?.date ?? body.startDate),
            lte(scheduleInstances.businessDate, slots[slots.length - 1]?.date ?? body.startDate),
            eq(scheduleInstances.source, "manual"),
            isNull(scheduleInstances.deletedAt),
          ),
        );
      const occupied = new Set(existingDates.map((r) => r.businessDate));
      for (const slot of slots) {
        if (occupied.has(slot.date)) continue;
        const template = templates.find((t) => t.id === slot.shiftTemplateId);
        if (!template) continue;
        const snapshot = snapshotFromTemplate(template);
        const times = instanceTimes(slot.date, snapshot, ws.timezone);
        const inserted = await db
          .insert(scheduleInstances)
          .values({
            workspaceId: ws.workspaceId,
            ownerUserId: userId,
            businessDate: slot.date,
            timezone: ws.timezone,
            startsAt: times.startsAt,
            endsAt: times.endsAt,
            kind: snapshot.kind,
            shiftTemplateId: template.id,
            shiftSnapshot: snapshot,
            status: "scheduled",
            source: "rule",
            sourceRuleId: ruleRow.id,
            createdBy: userId,
          })
          .returning();
        if (inserted[0]) generatedCount += 1;
      }

      // 冲突报告：范围内容纳已生成实例与既有实例
      const allInRange = await db
        .select()
        .from(scheduleInstances)
        .where(
          and(
            eq(scheduleInstances.workspaceId, ws.workspaceId),
            eq(scheduleInstances.ownerUserId, userId),
            gte(scheduleInstances.businessDate, slots[0]?.date ?? body.startDate),
            lte(scheduleInstances.businessDate, slots[slots.length - 1]?.date ?? body.startDate),
            isNull(scheduleInstances.deletedAt),
          ),
        );
      for (const a of allInRange) {
        for (const b of allInRange) {
          if (a.id === b.id) continue;
          if (
            intervalsOverlap(
              { id: a.id, startsAt: a.startsAt?.toISOString() ?? null, endsAt: a.endsAt?.toISOString() ?? null, kind: a.kind },
              { id: b.id, startsAt: b.startsAt?.toISOString() ?? null, endsAt: b.endsAt?.toISOString() ?? null, kind: b.kind },
            )
          ) {
            conflicts.push({
              type: "overlap",
              severity: "error",
              message: `${a.businessDate} 与 ${b.businessDate} 排班时间重叠`,
              existingScheduleId: b.id,
            });
          }
        }
      }
      await writeAudit(db, {
        workspaceId: ws.workspaceId,
        actorUserId: userId,
        action: "schedule_rule.create",
        resourceType: "schedule_rule",
        resourceId: ruleRow.id,
        requestId: req.id,
        afterSummary: { startDate: body.startDate, sequence: body.sequence, generatedCount },
      });
      reply.code(201).send({
        rule: {
          id: ruleRow.id,
          ownerUserId: ruleRow.ownerUserId,
          name: ruleRow.name,
          startDate: ruleRow.startDate,
          endDate: ruleRow.endDate,
          timezone: ruleRow.timezone,
          sequence: ruleRow.sequence,
          generationHorizonDays: ruleRow.generationHorizonDays,
          version: ruleRow.version,
          isActive: ruleRow.isActive,
        },
        generatedCount,
        conflicts,
      } satisfies ScheduleRuleCreateResult);
    },
  );

  app.get(
    "/schedule-rules",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const rows = await db
        .select()
        .from(scheduleRules)
        .where(
          and(
            eq(scheduleRules.workspaceId, ws.workspaceId),
            eq(scheduleRules.ownerUserId, userId),
            eq(scheduleRules.isActive, true),
            isNull(scheduleRules.deletedAt),
          ),
        )
        .orderBy(scheduleRules.createdAt);
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const active = userRow[0]?.activeRuleId ?? null;
      return rows.map((r) => ({
        id: r.id,
        name: r.name ?? "未命名排班表",
        startDate: r.startDate,
        endDate: r.endDate,
        timezone: r.timezone,
        sequence: r.sequence,
        generationHorizonDays: r.generationHorizonDays,
        version: r.version,
        isActive: r.isActive,
        isCurrent: r.id === active,
      }));
    },
  );

  app.post<{ Params: { id: string } }>(
    "/schedule-rules/:id/activate",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const rows = await db
        .select()
        .from(scheduleRules)
        .where(
          and(
            eq(scheduleRules.id, req.params.id),
            eq(scheduleRules.workspaceId, ws.workspaceId),
            eq(scheduleRules.ownerUserId, userId),
            isNull(scheduleRules.deletedAt),
          ),
        )
        .limit(1);
      if (rows.length === 0) throw notFound("排班表不存在");
      await db.update(users).set({ activeRuleId: req.params.id }).where(eq(users.id, userId));
      return { ruleId: req.params.id };
    },
  );

  app.patch<{ Params: { id: string }; Body: import("@workcal/shared-types").ScheduleRuleUpdateInput }>(
    "/schedule-rules/:id",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const rows = await db
        .select()
        .from(scheduleRules)
        .where(
          and(
            eq(scheduleRules.id, req.params.id),
            eq(scheduleRules.workspaceId, ws.workspaceId),
            eq(scheduleRules.ownerUserId, userId),
            isNull(scheduleRules.deletedAt),
          ),
        )
        .limit(1);
      const current = rows[0];
      if (!current) throw notFound("排班表不存在");
      const body = req.body;
      if (body.version !== current.version) throw versionConflict();
      const data: Partial<typeof current> = { version: current.version + 1, updatedAt: new Date() };
      if (typeof body.name === "string") data.name = body.name.trim() || "排班表";
      if (typeof body.startDate === "string") {
        validateBusinessDate(body.startDate);
        data.startDate = body.startDate;
      }
      if (body.endDate !== undefined) {
        if (body.endDate) validateBusinessDate(body.endDate);
        data.endDate = body.endDate ?? null;
      }
      if (Array.isArray(body.sequence)) {
        if (body.sequence.length === 0) throw validationError("班次序列不能为空");
        data.sequence = body.sequence;
      }
      const updated = await db
        .update(scheduleRules)
        .set(data)
        .where(eq(scheduleRules.id, req.params.id))
        .returning();
      const row = updated[0];
      if (!row) throw notFound("排班表不存在");
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return {
        id: row.id,
        name: row.name ?? "未命名排班表",
        startDate: row.startDate,
        endDate: row.endDate,
        timezone: row.timezone,
        sequence: row.sequence,
        generationHorizonDays: row.generationHorizonDays,
        version: row.version,
        isActive: row.isActive,
        isCurrent: row.id === userRow[0]?.activeRuleId,
      };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/schedule-rules/:id",
    { schema: { tags: ["Schedules"] } },
    async (req) => {
      const userId = await requireAuth(req);
      const ws = await requireWorkspace(req, db);
      const rows = await db
        .select()
        .from(scheduleRules)
        .where(
          and(
            eq(scheduleRules.id, req.params.id),
            eq(scheduleRules.workspaceId, ws.workspaceId),
            eq(scheduleRules.ownerUserId, userId),
            isNull(scheduleRules.deletedAt),
          ),
        )
        .limit(1);
      if (rows.length === 0) throw notFound("排班表不存在");
      await db
        .update(scheduleRules)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(scheduleRules.id, req.params.id));
      await db
        .update(scheduleInstances)
        .set({ deletedAt: new Date() })
        .where(eq(scheduleInstances.sourceRuleId, req.params.id));
      const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (userRow[0]?.activeRuleId === req.params.id) {
        await db.update(users).set({ activeRuleId: null }).where(eq(users.id, userId));
      }
      return { removed: req.params.id };
    },
  );
}

async function loadOwnedInstance(
  db: Db,
  workspaceId: string,
  userId: string,
  id: string,
) {
  const rows = await db
    .select()
    .from(scheduleInstances)
    .where(
      and(
        eq(scheduleInstances.id, id),
        eq(scheduleInstances.workspaceId, workspaceId),
        eq(scheduleInstances.ownerUserId, userId),
        isNull(scheduleInstances.deletedAt),
      ),
    )
    .limit(1);
  if (rows.length === 0) throw notFound("排班不存在");
  const row = rows[0];
  if (!row) throw notFound("排班不存在");
  return row;
}

async function assertNoOverlap(
  db: Db,
  workspaceId: string,
  userId: string,
  businessDate: string,
  times: { startsAt: Date | null; endsAt: Date | null },
  excludeId: string | null,
): Promise<void> {
  if (!times.startsAt || !times.endsAt) return;
  const from = addDays(businessDate, -1);
  const to = addDays(businessDate, 1);
  const rows = await db
    .select()
    .from(scheduleInstances)
    .where(
      and(
        eq(scheduleInstances.workspaceId, workspaceId),
        eq(scheduleInstances.ownerUserId, userId),
        gte(scheduleInstances.businessDate, from),
        lte(scheduleInstances.businessDate, to),
        isNull(scheduleInstances.deletedAt),
      ),
    );
  const conflicts = findOverlapConflicts(
    {
      id: "candidate",
      startsAt: times.startsAt.toISOString(),
      endsAt: times.endsAt.toISOString(),
      kind: "work",
    },
    rows
      .filter((r) => r.id !== excludeId)
      .map((r) => ({
        id: r.id,
        startsAt: r.startsAt?.toISOString() ?? null,
        endsAt: r.endsAt?.toISOString() ?? null,
        kind: r.kind,
      })),
  );
  if (conflicts.length > 0) {
    throw scheduleConflict("该时段与现有班次冲突", {
      conflicts: conflicts.map((c) => ({ existingScheduleId: c.existingId, message: c.message })),
    });
  }
}

export async function updateInstance(
  db: Db | Tx,
  instanceId: string,
  userId: string,
  snapshot: ShiftSnapshot,
  times: { startsAt: Date | null; endsAt: Date | null },
  note: string | null,
  reason: string,
  workspaceId: string,
  requestId: string,
) {
  const rows = await db
    .select()
    .from(scheduleInstances)
    .where(eq(scheduleInstances.id, instanceId))
    .limit(1);
  const current = rows[0];
  if (!current) throw notFound("排班不存在");
  await db.insert(scheduleInstanceVersions).values({
    scheduleInstanceId: instanceId,
    version: current.version + 1,
    snapshot: current.shiftSnapshot,
    changeReason: reason || null,
    changedBy: userId,
  });
  const updated = await db
    .update(scheduleInstances)
    .set({
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      kind: snapshot.kind,
      shiftSnapshot: snapshot,
      note,
      version: current.version + 1,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(scheduleInstances.id, instanceId))
    .returning();
  const row = updated[0];
  if (!row) throw notFound("排班不存在");
  await writeAudit(db, {
    workspaceId,
    actorUserId: userId,
    action: "schedule.update",
    resourceType: "schedule_instance",
    resourceId: instanceId,
    requestId,
    beforeSummary: current.shiftSnapshot as unknown as Record<string, unknown>,
    afterSummary: snapshot as unknown as Record<string, unknown>,
    metadata: { reason: reason || null },
  });
  return row;
}

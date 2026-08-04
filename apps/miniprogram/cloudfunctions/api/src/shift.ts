import { db, _, requireWorkspace, writeAudit } from "./db";
import { assert, CloudError, nowIso } from "./util";
import { toShiftTemplate } from "./map";

interface ShiftInput {
  workspaceId: string;
  name: string;
  shortName: string;
  kind: string;
  color: string;
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
  unpaidBreakMinutes: number;
  sortOrder?: number;
}

function validate(input: ShiftInput): void {
  assert(input.name?.trim(), "VALIDATION_ERROR", "班次名称不能为空");
  assert(input.shortName?.trim(), "VALIDATION_ERROR", "班次简称不能为空");
  if (input.kind === "work") {
    assert(input.startTime && input.endTime, "VALIDATION_ERROR", "工作类班次必须填写开始和结束时间");
  }
}

export async function list(openid: string, payload: { workspaceId: string; active?: boolean }) {
  await requireWorkspace(openid, payload.workspaceId);
  const where: Record<string, unknown> = { workspaceId: payload.workspaceId };
  if (payload.active === true) {
    where.isActive = true;
  }
  const res = await db
    .collection("shiftTemplates")
    .where(where)
    .orderBy("sortOrder", "asc")
    .limit(100)
    .get();
  return res.data.map(toShiftTemplate);
}

export async function create(openid: string, input: ShiftInput) {
  await requireWorkspace(openid, input.workspaceId);
  validate(input);
  const now = nowIso();
  const added = await db.collection("shiftTemplates").add({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      shortName: input.shortName.trim().slice(0, 12),
      kind: input.kind,
      color: input.color,
      startTime: input.startTime,
      endTime: input.endTime,
      endsNextDay: Boolean(input.endsNextDay),
      unpaidBreakMinutes: input.unpaidBreakMinutes ?? 0,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  });
  const res = await db.collection("shiftTemplates").doc(added._id as string).get();
  await writeAudit(openid, input.workspaceId, "shift.create", "shiftTemplate", added._id as string, {
    name: input.name,
  });
  return toShiftTemplate(res.data);
}

export async function update(
  openid: string,
  input: ShiftInput & { id: string; version: number; isActive?: boolean },
) {
  await requireWorkspace(openid, input.workspaceId);
  validate(input);
  const data: Record<string, unknown> = {
    name: input.name.trim(),
    shortName: input.shortName.trim().slice(0, 12),
    kind: input.kind,
    color: input.color,
    startTime: input.startTime,
    endTime: input.endTime,
    endsNextDay: Boolean(input.endsNextDay),
    unpaidBreakMinutes: input.unpaidBreakMinutes ?? 0,
    sortOrder: input.sortOrder ?? 0,
    version: _.inc(1),
    updatedAt: nowIso(),
  };
  if (typeof input.isActive === "boolean") {
    data.isActive = input.isActive;
  }
  const res = await db
    .collection("shiftTemplates")
    .where({ _id: input.id, workspaceId: input.workspaceId, version: input.version })
    .update({ data });
  if ((res.stats as { updated?: number }).updated === 0) {
    throw new CloudError("VERSION_CONFLICT", "数据已被修改，请刷新后重试", 409);
  }
  const doc = await db.collection("shiftTemplates").doc(input.id).get();
  await writeAudit(openid, input.workspaceId, "shift.update", "shiftTemplate", input.id, {
    name: input.name,
  });
  return toShiftTemplate(doc.data);
}

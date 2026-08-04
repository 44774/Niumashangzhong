import { db } from "./db";
import { requireWorkspace, writeAudit } from "./db";
import { toChangeRequest } from "./map";
import { assert, CloudError, nowIso } from "./util";
import { assertNoOverlap, instanceTimes, normalizeSnapshot } from "./schedule";
import { get as getPrefs, rebuildJobs } from "./notify";

export async function create(openid: string, payload: any) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(
    payload.scheduleInstanceId && payload.requestedShift,
    "VALIDATION_ERROR",
    "scheduleInstanceId 与 requestedShift 为必填",
  );
  const requested = normalizeSnapshot(payload.requestedShift);
  const before = await db.collection("scheduleInstances").doc(payload.scheduleInstanceId).get();
  const current = before.data;
  if (!current || current.workspaceId !== payload.workspaceId || current.ownerOpenid !== openid) {
    throw new CloudError("NOT_FOUND", "排班不存在", 404);
  }
  const times = instanceTimes(current.businessDate, requested, current.timezone);
  await assertNoOverlap(current.workspaceId, openid, current.businessDate, times, payload.scheduleInstanceId);

  const result = await db.runTransaction(async (transaction: any) => {
    const txDoc = await transaction.collection("scheduleInstances").doc(payload.scheduleInstanceId).get();
    const txCurrent = txDoc.data;
    if (!txCurrent) {
      throw new CloudError("NOT_FOUND", "排班不存在", 404);
    }
    const newVersion = txCurrent.version + 1;
    await transaction.collection("scheduleInstances").doc(payload.scheduleInstanceId).update({
      data: {
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        kind: requested.kind,
        shiftSnapshot: requested,
        version: newVersion,
        history: [
          ...(Array.isArray(txCurrent.history) ? txCurrent.history : []),
          {
            version: newVersion,
            snapshot: txCurrent.shiftSnapshot,
            changeReason: payload.reason ?? "临时改班",
            createdAt: nowIso(),
          },
        ],
        updatedAt: nowIso(),
      },
    });
    const cr = {
      workspaceId: payload.workspaceId,
      scheduleInstanceId: payload.scheduleInstanceId,
      requesterOpenid: openid,
      originalSnapshot: txCurrent.shiftSnapshot,
      requestedSnapshot: requested,
      reason: payload.reason ?? null,
      status: "approved",
      approvalNote: "个人模式直接生效",
      createdAt: nowIso(),
      decidedAt: nowIso(),
    };
    const added = await transaction.collection("changeRequests").add({ data: cr });
    const updated = await transaction.collection("scheduleInstances").doc(payload.scheduleInstanceId).get();
    return { change: { ...cr, _id: added._id }, updated: updated.data };
  });

  const prefs = await getPrefs(openid, { workspaceId: payload.workspaceId });
  await rebuildJobs(openid, payload.workspaceId, result.updated, prefs);
  await writeAudit(openid, payload.workspaceId, "change.approve_direct", "changeRequest", result.change._id, {
    from: current.shiftSnapshot?.name,
    to: requested.name,
  });
  return toChangeRequest(result.change);
}

export async function list(openid: string, payload: { workspaceId: string; status?: string }) {
  await requireWorkspace(openid, payload.workspaceId);
  const where: Record<string, unknown> = {
    workspaceId: payload.workspaceId,
    requesterOpenid: openid,
  };
  if (payload.status) {
    where.status = payload.status;
  }
  const res = await db
    .collection("changeRequests")
    .where(where)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return res.data.map(toChangeRequest);
}

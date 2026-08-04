import { db, requireWorkspace, writeAudit } from "./db";
import { toShareSnapshot } from "./map";
import { assert, assertDate, CloudError, nowIso } from "./util";

/**
 * 分享快照由小程序端本地计算并提交（隐私过滤后的条目），
 * 云端只做存储，不再计算排班或天气。
 */
export async function create(openid: string, payload: any) {
  await requireWorkspace(openid, payload.workspaceId);
  assert(payload.rangeStart && payload.rangeEnd, "VALIDATION_ERROR", "rangeStart 与 rangeEnd 为必填");
  assertDate(payload.rangeStart);
  assertDate(payload.rangeEnd);
  if (payload.rangeStart > payload.rangeEnd) {
    throw new CloudError("VALIDATION_ERROR", "rangeStart 不能晚于 rangeEnd");
  }
  const privacy = {
    showDisplayName: Boolean(payload.privacyOptions?.showDisplayName),
    showTime: Boolean(payload.privacyOptions?.showTime),
    showWeather: Boolean(payload.privacyOptions?.showWeather),
    showLocation: Boolean(payload.privacyOptions?.showLocation),
    showNote: Boolean(payload.privacyOptions?.showNote),
  };
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  for (const entry of entries) {
    assert(
      entry && typeof entry.date === "string" && typeof entry.shiftName === "string",
      "VALIDATION_ERROR",
      "分享条目格式错误",
    );
  }
  const userRes = await db.collection("users").doc(openid).get();
  const createdAt = nowIso();
  const added = await db.collection("shareSnapshots").add({
    data: {
      workspaceId: payload.workspaceId,
      ownerOpenid: openid,
      rangeStart: payload.rangeStart,
      rangeEnd: payload.rangeEnd,
      privacyOptions: privacy,
      templateCode: payload.templateCode || "default",
      snapshot: {
        ownerDisplayName: privacy.showDisplayName ? userRes.data?.displayName ?? null : null,
        rangeStart: payload.rangeStart,
        rangeEnd: payload.rangeEnd,
        templateCode: payload.templateCode || "default",
        privacyOptions: privacy,
        entries,
      },
      createdAt,
    },
  });
  const doc = await db.collection("shareSnapshots").doc(added._id as string).get();
  await writeAudit(openid, payload.workspaceId, "share.create", "shareSnapshot", added._id as string, {
    rangeStart: payload.rangeStart,
    rangeEnd: payload.rangeEnd,
    entries: entries.length,
  });
  return toShareSnapshot(doc.data);
}

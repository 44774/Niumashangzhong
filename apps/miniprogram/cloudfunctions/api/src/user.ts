import { db, requireWorkspace } from "./db";
import { toUser } from "./map";
import { assert, CloudError, nowIso } from "./util";

export async function updateLocation(
  openid: string,
  payload: {
    workspaceId: string;
    location: { name: string; latitude: number; longitude: number };
  },
) {
  await requireWorkspace(openid, payload.workspaceId);
  const loc = payload.location;
  assert(loc && typeof loc.name === "string", "VALIDATION_ERROR", "位置名称不能为空");
  assert(
    typeof loc.latitude === "number" && typeof loc.longitude === "number",
    "VALIDATION_ERROR",
    "经纬度格式错误",
  );
  await db.collection("users").doc(openid).update({
    data: { defaultLocation: loc, updatedAt: nowIso() },
  });
  const user = await db.collection("users").doc(openid).get();
  if (!user.data) throw new CloudError("NOT_FOUND", "用户不存在", 404);
  return toUser(user.data);
}

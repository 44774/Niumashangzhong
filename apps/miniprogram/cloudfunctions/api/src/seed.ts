import { ensureDefaultRule, ensureUserAndWorkspace } from "./db";
import { toUser, toWorkspace } from "./map";

/**
 * 演示数据：只确保存在“初始排班表”规则；
 * 班次由小程序端按规则本地计算，云端不再写入固定实例，避免初始数据无法覆盖/删除。
 */
export async function seedDemo(openid: string) {
  // 强隔离：不修改已有用户昵称/头像，也不向已有数据的账号注入演示数据
  const { user, workspace } = await ensureUserAndWorkspace(openid);
  await ensureDefaultRule(openid, workspace);
  return { user: toUser(user), workspace: toWorkspace(workspace), created: 0 };
}

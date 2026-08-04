import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayInTimezone } from "@workcal/schedule-engine";
import {
  authHeaders,
  createTestApp,
  devLogin,
  resetTestDb,
  type TestContext,
} from "../helpers.js";

describe("工作空间隔离", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    await resetTestDb();
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.$client.end();
  });

  it("用户 A 的排班无法被用户 B 读取", async () => {
    const a = await devLogin(ctx.app, "用户A");
    const hA = authHeaders(a.accessToken, a.workspace.id);
    const tplA = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/shift-templates?active=true",
      headers: hA,
    });
    const today = todayInTimezone("Asia/Shanghai");
    const create = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers: hA,
      payload: { ownerUserId: "", businessDate: today, shiftTemplateId: tplA.json()[0].id },
    });
    const instanceId = create.json().id;

    const b = await devLogin(ctx.app, "用户B");
    const hB = authHeaders(b.accessToken, b.workspace.id);
    const stolen = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules/${instanceId}`,
      headers: hB,
    });
    expect(stolen.statusCode).toBe(404);

    const crossList = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules?from=${today}&to=${today}&ownerUserId=${a.user.id}`,
      headers: hB,
    });
    expect(crossList.statusCode).toBe(403);
  });

  it("缺少 X-Workspace-Id 请求头被拒绝", async () => {
    const login = await devLogin(ctx.app, "无头用户");
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/shift-templates",
      headers: { authorization: `Bearer ${login.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

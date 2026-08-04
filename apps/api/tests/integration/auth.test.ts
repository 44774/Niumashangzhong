import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, devLogin, resetTestDb, type TestContext } from "../helpers.js";

describe("认证与工作空间", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    await resetTestDb();
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.$client.end();
  });

  it("开发登录返回令牌、用户与个人工作空间", async () => {
    const login = await devLogin(ctx.app, "张小明");
    expect(login.accessToken).toBeTruthy();
    expect(login.user.displayName).toBe("张小明");
    expect(login.workspace.type).toBe("personal");
  });

  it("同一开发账号重复登录返回同一用户", async () => {
    const first = await devLogin(ctx.app, "张小明");
    const second = await devLogin(ctx.app, "张小明");
    expect(second.user.id).toBe(first.user.id);
  });

  it("获取当前用户与工作空间列表", async () => {
    const login = await devLogin(ctx.app, "李丽");
    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${login.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(login.user.id);

    const ws = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/workspaces",
      headers: { authorization: `Bearer ${login.accessToken}` },
    });
    expect(ws.statusCode).toBe(200);
    expect(ws.json()).toHaveLength(1);
    expect(ws.json()[0].id).toBe(login.workspace.id);
  });

  it("无令牌访问返回 401", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, todayInTimezone } from "@workcal/schedule-engine";
import {
  authHeaders,
  createTestApp,
  devLogin,
  resetTestDb,
  type TestContext,
} from "../helpers.js";

describe("排班领域", () => {
  let ctx: TestContext;
  let token: string;
  let userId: string;
  let workspaceId: string;
  let headers: Record<string, string>;
  let templates: Array<{ id: string; name: string; kind: string }>;

  beforeAll(async () => {
    await resetTestDb();
    ctx = await createTestApp();
    const login = await devLogin(ctx.app, "排班用户");
    token = login.accessToken;
    userId = login.user.id;
    workspaceId = login.workspace.id;
    headers = authHeaders(token, workspaceId);
    const tplRes = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/shift-templates?active=true",
      headers,
    });
    templates = tplRes.json();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.$client.end();
  });

  it("默认班次模板包含早班/晚班/夜班/休息", () => {
    expect(templates.map((t) => t.name).sort()).toEqual(["休息", "夜班", "早班", "晚班"]);
  });

  it("创建单日排班并可在范围查询中看到", async () => {
    const early = templates.find((t) => t.name === "早班");
    expect(early).toBeTruthy();
    const today = todayInTimezone("Asia/Shanghai");
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers,
      payload: { ownerUserId: "", businessDate: today, shiftTemplateId: early?.id },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.shiftSnapshot.name).toBe("早班");
    expect(created.startsAt).toMatch(/T01:00:00/); // 09:00 Asia/Shanghai

    const list = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules?from=${today}&to=${today}`,
      headers,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
  });

  it("重叠排班返回 409", async () => {
    const early = templates.find((t) => t.name === "早班");
    const today = todayInTimezone("Asia/Shanghai");
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers,
      payload: { ownerUserId: "", businessDate: today, shiftTemplateId: early?.id },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("SCHEDULE_CONFLICT");
  });

  it("版本冲突返回 409；仅当天范围合法，其他范围被拒绝", async () => {
    const today = todayInTimezone("Asia/Shanghai");
    const list = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules?from=${today}&to=${today}`,
      headers,
    });
    const instance = list.json()[0];
    const bad = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/schedules/${instance.id}`,
      headers,
      payload: {
        version: 99,
        changeScope: "only_this_day",
        customShift: { name: "晚班", kind: "work", startTime: "13:00", endTime: "21:30", color: "#2F80ED" },
        reason: "测试",
      },
    });
    expect(bad.statusCode).toBe(409);

    const scope = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/schedules/${instance.id}`,
      headers,
      payload: {
        version: instance.version,
        changeScope: "future_instances",
        customShift: { name: "晚班", kind: "work", startTime: "13:00", endTime: "21:30", color: "#2F80ED" },
        reason: "测试",
      },
    });
    expect(scope.statusCode).toBe(403);

    const ok = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/schedules/${instance.id}`,
      headers,
      payload: {
        version: instance.version,
        changeScope: "only_this_day",
        customShift: { name: "晚班", kind: "work", startTime: "13:00", endTime: "21:30", color: "#2F80ED" },
        reason: "改为晚班",
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().version).toBe(instance.version + 1);
    expect(ok.json().shiftSnapshot.name).toBe("晚班");
  });

  it("循环规则生成实例且不覆盖手动排班", async () => {
    const early = templates.find((t) => t.name === "早班");
    const rest = templates.find((t) => t.name === "休息");
    const today = todayInTimezone("Asia/Shanghai");
    const manualDate = addDays(today, 14);
    const manual = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers,
      payload: { ownerUserId: "", businessDate: manualDate, shiftTemplateId: rest?.id },
    });
    expect(manual.statusCode).toBe(201);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/schedule-rules",
      headers,
      payload: {
        ownerUserId: userId,
        name: "早晚休循环",
        startDate: today,
        timezone: "Asia/Shanghai",
        sequence: [
          { shiftTemplateId: early?.id },
          { shiftTemplateId: early?.id },
          { shiftTemplateId: rest?.id },
        ],
        generationHorizonDays: 21,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.generatedCount).toBeGreaterThan(0);

    const manualCheck = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules?from=${manualDate}&to=${manualDate}`,
      headers,
    });
    expect(manualCheck.json()[0].source).toBe("manual");
    expect(manualCheck.json()[0].shiftSnapshot.name).toBe("休息");
  });
});

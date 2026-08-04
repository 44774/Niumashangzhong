import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayInTimezone } from "@workcal/schedule-engine";
import {
  authHeaders,
  createTestApp,
  devLogin,
  resetTestDb,
  type TestContext,
} from "../helpers.js";

describe("临时改班", () => {
  let ctx: TestContext;
  let headers: Record<string, string>;
  let instanceId: string;

  beforeAll(async () => {
    await resetTestDb();
    ctx = await createTestApp();
    const login = await devLogin(ctx.app, "改班用户");
    headers = authHeaders(login.accessToken, login.workspace.id);
    const tplRes = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/shift-templates?active=true",
      headers,
    });
    const templates = tplRes.json() as Array<{ id: string; name: string }>;
    const early = templates.find((t) => t.name === "早班");
    if (!early) throw new Error("缺少早班模板");
    const today = todayInTimezone("Asia/Shanghai");
    const create = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers,
      payload: { ownerUserId: "", businessDate: today, shiftTemplateId: early.id },
    });
    instanceId = create.json().id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.$client.end();
  });

  it("提交改班申请后直接生效并留痕", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/change-requests",
      headers: { ...headers, "idempotency-key": "change-test-key-001" },
      payload: {
        scheduleInstanceId: instanceId,
        requestedShift: {
          name: "夜班",
          kind: "work",
          startTime: "21:00",
          endTime: "07:00",
          endsNextDay: true,
          color: "#7C3AED",
        },
        reason: "临时换成夜班",
      },
    });
    expect(res.statusCode).toBe(201);
    const change = res.json();
    expect(change.status).toBe("approved");
    expect(change.originalSnapshot.name).toBe("早班");
    expect(change.requestedSnapshot.name).toBe("夜班");

    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules/${instanceId}`,
      headers,
    });
    expect(detail.json().shiftSnapshot.name).toBe("夜班");
    expect(detail.json().history).toHaveLength(1);
  });

  it("相同幂等键重复提交返回同一记录", async () => {
    const first = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/change-requests",
      headers,
    });
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/change-requests",
      headers: { ...headers, "idempotency-key": "change-test-key-001" },
      payload: {
        scheduleInstanceId: instanceId,
        requestedShift: {
          name: "夜班",
          kind: "work",
          startTime: "21:00",
          endTime: "07:00",
          endsNextDay: true,
          color: "#7C3AED",
        },
        reason: "临时换成夜班",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(first.json()[0].id).toBe(res.json().id);
  });

  it("改班记录列表包含已生效记录", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/change-requests",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
    expect(res.json()[0].scheduleInstanceId).toBe(instanceId);
  });
});

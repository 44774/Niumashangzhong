import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, todayInTimezone } from "@workcal/schedule-engine";
import {
  authHeaders,
  createTestApp,
  devLogin,
  resetTestDb,
  type TestContext,
} from "../helpers.js";

describe("天气与分享", () => {
  let ctx: TestContext;
  let headers: Record<string, string>;
  let today: string;

  beforeAll(async () => {
    await resetTestDb();
    ctx = await createTestApp();
    const login = await devLogin(ctx.app, "分享用户");
    headers = authHeaders(login.accessToken, login.workspace.id);
    today = todayInTimezone("Asia/Shanghai");
    const tplRes = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/shift-templates?active=true",
      headers,
    });
    const early = tplRes.json().find((t: { name: string }) => t.name === "早班");
    for (let i = 0; i < 3; i += 1) {
      await ctx.app.inject({
        method: "POST",
        url: "/api/v1/schedules",
        headers,
        payload: {
          ownerUserId: "",
          businessDate: addDays(today, i),
          shiftTemplateId: early.id,
          note: i === 1 ? "内部备注：含敏感信息" : undefined,
        },
      });
    }
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.db.$client.end();
  });

  it("天气接口返回 mock 预报且排班详情附带天气", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/weather?from=${today}&to=${addDays(today, 2)}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(3);
    expect(res.json()[0].conditionText).toBeTruthy();

    const list = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules?from=${today}&to=${today}`,
      headers,
    });
    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/schedules/${list.json()[0].id}`,
      headers,
    });
    expect(detail.json().weather.conditionCode).toBeTruthy();
  });

  it("分享快照按隐私选项过滤敏感字段", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/share-snapshots",
      headers,
      payload: {
        rangeStart: today,
        rangeEnd: addDays(today, 2),
        templateCode: "default",
        privacyOptions: {
          showDisplayName: true,
          showTime: false,
          showWeather: true,
          showLocation: false,
          showNote: false,
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const snapshot = res.json();
    expect(snapshot.entries).toHaveLength(3);
    for (const entry of snapshot.entries) {
      expect(entry.timeText).toBeNull();
      expect(entry.note).toBeNull();
      expect(entry.location).toBeNull();
    }
    const noteEntry = snapshot.entries.find((e: { date: string }) => e.date === addDays(today, 1));
    expect(noteEntry.shiftName).toBe("早班");
    expect(noteEntry.weather).not.toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain("内部备注");
  });

  it("天气 Provider 故障时排班接口不受影响", async () => {
    const broken = await createTestApp("broken");
    const login = await devLogin(broken.app, "故障用户");
    const h = authHeaders(login.accessToken, login.workspace.id);
    const tplRes = await broken.app.inject({
      method: "GET",
      url: "/api/v1/shift-templates?active=true",
      headers: h,
    });
    const early = tplRes.json()[0];
    const create = await broken.app.inject({
      method: "POST",
      url: "/api/v1/schedules",
      headers: h,
      payload: { ownerUserId: "", businessDate: today, shiftTemplateId: early.id },
    });
    expect(create.statusCode).toBe(201);
    const detail = await broken.app.inject({
      method: "GET",
      url: `/api/v1/schedules/${create.json().id}`,
      headers: h,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().weather).toBeNull();
    await broken.app.close();
    await broken.db.$client.end();
  });
});

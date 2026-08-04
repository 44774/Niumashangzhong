import { describe, expect, it } from "vitest";
import {
  cycleSlots,
  instanceTimes,
  intervalsOverlap,
  normalizeSnapshot,
  zonedTimeToIso,
} from "../utils/local-schedule";

describe("本地排班时间逻辑", () => {
  it("跨午夜班次时间换算", () => {
    const snap = normalizeSnapshot({
      name: "夜班",
      kind: "work",
      startTime: "21:00",
      endTime: "07:00",
      endsNextDay: true,
      color: "#7C3AED",
    });
    const times = instanceTimes("2026-08-04", snap);
    expect(times.startsAt).toBe("2026-08-04T13:00:00.000Z");
    expect(times.endsAt).toBe("2026-08-04T23:00:00.000Z");
    expect(snap.endsNextDay).toBe(true);
  });

  it("结束时间早于开始时自动按次日处理", () => {
    const snap = normalizeSnapshot({
      name: "值班",
      kind: "work",
      startTime: "22:00",
      endTime: "06:00",
      color: "#1F6FEB",
    });
    expect(snap.endsNextDay).toBe(true);
  });

  it("zonedTimeToIso 使用 Asia/Shanghai 偏移", () => {
    expect(zonedTimeToIso("2026-08-05", "09:00")).toBe("2026-08-05T01:00:00.000Z");
  });

  it("重叠检测与休息班豁免", () => {
    const work = { startsAt: "2026-08-04T01:00:00.000Z", endsAt: "2026-08-04T09:30:00.000Z", kind: "work" };
    expect(intervalsOverlap(work, { startsAt: "2026-08-04T08:00:00.000Z", endsAt: "2026-08-04T12:00:00.000Z", kind: "work" })).toBe(true);
    expect(intervalsOverlap(work, { startsAt: "2026-08-04T08:00:00.000Z", endsAt: "2026-08-04T12:00:00.000Z", kind: "rest" })).toBe(false);
  });

  it("循环序列生成", () => {
    const slots = cycleSlots("2026-08-03", ["a", "b", "c"], 5);
    expect(slots.map((s) => s.date)).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
    expect(slots[4]?.shiftTemplateId).toBe("b");
    expect(() => cycleSlots("2026-08-03", [], 5)).toThrow("不能为空");
  });
});

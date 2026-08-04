import { describe, expect, it } from "vitest";
import { durationLabel, durationMinutes, formatTimeRange } from "../utils/format";

describe("班次展示格式", () => {
  it("跨午夜显示次日", () => {
    expect(
      formatTimeRange({
        name: "夜班",
        shortName: "夜班",
        kind: "work",
        color: "#7C3AED",
        startTime: "21:00",
        endTime: "07:00",
        endsNextDay: true,
        unpaidBreakMinutes: 0,
      }),
    ).toBe("21:00–次日07:00");
  });

  it("结束时间早于开始时间自动按次日处理", () => {
    expect(
      formatTimeRange({
        name: "夜班",
        shortName: "夜班",
        kind: "work",
        color: "#7C3AED",
        startTime: "22:00",
        endTime: "06:00",
        endsNextDay: false,
        unpaidBreakMinutes: 0,
      }),
    ).toBe("22:00–次日06:00");
  });

  it("时长计算与文案", () => {
    const snapshot = {
      name: "早班",
      shortName: "早班",
      kind: "work" as const,
      color: "#10B981",
      startTime: "09:00",
      endTime: "17:30",
      endsNextDay: false,
      unpaidBreakMinutes: 60,
    };
    expect(durationMinutes(snapshot)).toBe(450);
    expect(durationLabel(snapshot)).toBe("7 小时 30 分");
  });

  it("休息班无时间", () => {
    expect(
      formatTimeRange({
        name: "休息",
        shortName: "休",
        kind: "rest",
        color: "#94A3B8",
        startTime: null,
        endTime: null,
        endsNextDay: false,
        unpaidBreakMinutes: 0,
      }),
    ).toBeNull();
  });
});

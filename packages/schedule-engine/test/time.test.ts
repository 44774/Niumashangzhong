import { describe, expect, it } from "vitest";
import {
  durationLabel,
  formatTimeRange,
  rawDurationMinutes,
  workDurationMinutes,
  zonedTimeToIso,
} from "../src/time.js";

describe("时间与跨午夜", () => {
  it("普通同日班次", () => {
    expect(
      rawDurationMinutes({ startTime: "09:00", endTime: "17:30", endsNextDay: false }),
    ).toBe(510);
  });

  it("跨午夜班次 21:00 -> 07:00 为 600 分钟", () => {
    expect(
      rawDurationMinutes({ startTime: "21:00", endTime: "07:00", endsNextDay: true }),
    ).toBe(600);
  });

  it("结束时间小于开始时间时默认视为次日", () => {
    expect(rawDurationMinutes({ startTime: "22:00", endTime: "06:00", endsNextDay: false })).toBe(480);
  });

  it("结束时间等于开始时间按次日结束为 24 小时", () => {
    expect(rawDurationMinutes({ startTime: "08:00", endTime: "08:00", endsNextDay: false })).toBe(1440);
  });

  it("无薪休息扣减且不为负数", () => {
    expect(workDurationMinutes({ startTime: "09:00", endTime: "17:30", endsNextDay: false }, 60)).toBe(450);
    expect(workDurationMinutes({ startTime: "09:00", endTime: "09:30", endsNextDay: false }, 60)).toBe(0);
  });

  it("休息班无时长", () => {
    expect(rawDurationMinutes({ startTime: null, endTime: null, endsNextDay: false })).toBe(0);
  });

  it("时长文案", () => {
    expect(durationLabel(60)).toBe("1 小时");
    expect(durationLabel(450)).toBe("7 小时 30 分");
  });

  it("时间区间文案含次日", () => {
    expect(formatTimeRange({ startTime: "21:00", endTime: "07:00", endsNextDay: true })).toBe(
      "21:00–次日07:00",
    );
  });

  it("业务日期与时区转换为 UTC", () => {
    expect(zonedTimeToIso("2026-08-04", "09:00", "Asia/Shanghai")).toBe("2026-08-04T01:00:00.000Z");
    expect(zonedTimeToIso("2026-08-05", "07:00", "Asia/Shanghai")).toBe("2026-08-04T23:00:00.000Z");
  });
});

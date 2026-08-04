import { describe, expect, it } from "vitest";
import { buildCalendarGrid, calendarPosterHeight } from "../utils/poster";
import { isMultiDay, needsLongRangeWarning, rangeDaysCount } from "../utils/share-range";

const entries = [
  {
    date: "2026-08-03",
    shiftName: "早班",
    shortName: "早班",
    kind: "work" as const,
    color: "#10B981",
    timeText: "09:00–17:30",
    location: null,
    note: null,
    weather: null,
    overtime: true,
  },
];

describe("海报日历网格", () => {
  it("周一起始补齐前置空格", () => {
    // 2026-08-01 是周六，周一起始 offset=5
    const cells = buildCalendarGrid("2026-08-01", "2026-08-07", entries);
    expect(cells.length).toBe(12);
    expect(cells.filter((c) => !c.inRange)).toHaveLength(5);
    expect(cells[5]?.date).toBe("2026-08-01");
  });

  it("把班次与加班信息放入对应日期", () => {
    const cells = buildCalendarGrid("2026-08-03", "2026-08-03", entries);
    expect(cells[0]?.shiftName).toBe("早班");
    expect(cells[0]?.overtime).toBe(true);
  });

  it("海报高度按周数增长", () => {
    const oneWeek = calendarPosterHeight("2026-08-03", "2026-08-09");
    const twoWeeks = calendarPosterHeight("2026-08-03", "2026-08-16");
    expect(twoWeeks).toBeGreaterThan(oneWeek);
  });
});

describe("自定义范围阈值", () => {
  it("92 天内不警告，超过 92 天警告", () => {
    expect(needsLongRangeWarning("2026-01-01", "2026-04-02")).toBe(false); // 92 天
    expect(needsLongRangeWarning("2026-01-01", "2026-04-03")).toBe(true); // 93 天
  });

  it("单日与多日判断", () => {
    expect(isMultiDay("2026-08-03", "2026-08-03")).toBe(false);
    expect(isMultiDay("2026-08-03", "2026-08-04")).toBe(true);
  });

  it("rangeDaysCount 包含首尾", () => {
    expect(rangeDaysCount("2026-08-03", "2026-08-05")).toBe(3);
  });
});

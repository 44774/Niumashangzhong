import { describe, expect, it } from "vitest";
import {
  addDays,
  buildMonthGrid,
  formatDateCN,
  rangeDays,
  thisMonthRange,
  todayString,
  weekdayCN,
} from "../utils/date";

describe("日期工具", () => {
  it("addDays 支持跨月与跨年", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-08-04", -4)).toBe("2026-07-31");
  });

  it("月历网格为 42 格且周一起始", () => {
    // 2026-08-01 是周六，周一起始 => 网格从 2026-07-27 开始
    const grid = buildMonthGrid(2026, 8, "2026-08-04");
    expect(grid).toHaveLength(42);
    expect(grid[0]?.date).toBe("2026-07-27");
    expect(grid[0]?.inMonth).toBe(false);
    expect(grid[41]?.date).toBe("2026-09-06");
    const today = grid.find((c) => c.date === "2026-08-04");
    expect(today?.isToday).toBe(true);
  });

  it("中文日期与星期", () => {
    expect(formatDateCN("2026-08-04")).toBe("2026年8月4日");
    expect(weekdayCN("2026-08-03")).toBe("周一");
    expect(weekdayCN("2026-08-09")).toBe("周日");
  });

  it("rangeDays 生成连续日期", () => {
    expect(rangeDays("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });

  it("本月范围", () => {
    const { start, end } = thisMonthRange();
    expect(start).toMatch(/^\d{4}-\d{2}-01$/);
    expect(end >= start).toBe(true);
  });

  it("todayString 返回 YYYY-MM-DD", () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

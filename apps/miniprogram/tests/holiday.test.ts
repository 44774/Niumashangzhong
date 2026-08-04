import { describe, expect, it } from "vitest";
import {
  isOvertime,
  mergeHolidayMaps,
  parseHolidayYear,
  sliceHolidayMap,
  yearsInRange,
} from "../utils/holiday";

describe("节假日工具", () => {
  it("解析 timor.tech 年度数据", () => {
    const map = parseHolidayYear(2026, {
      holiday: {
        "10-01": { holiday: true, name: "国庆节", date: "2026-10-01" },
        "10-10": { holiday: false, name: "补班", date: "2026-10-10" },
        "10-02": { holiday: true, date: "2026-10-02" },
      },
    });
    expect(map["2026-10-01"]).toBe("holiday");
    expect(map["2026-10-10"]).toBe("workday");
    expect(map["2026-10-02"]).toBe("holiday");
  });

  it("合并与切片", () => {
    const merged = mergeHolidayMaps(
      { "2026-10-01": "holiday" },
      { "2026-10-02": "holiday", "2026-10-10": "workday" },
    );
    expect(Object.keys(merged)).toHaveLength(3);
    const sliced = sliceHolidayMap(merged, "2026-10-02", "2026-10-10");
    expect(Object.keys(sliced)).toEqual(["2026-10-02", "2026-10-10"]);
  });

  it("加班判定与休息班豁免", () => {
    const map = { "2026-10-01": "holiday", "2026-10-10": "workday" } as const;
    expect(isOvertime(map, "2026-10-01", "work")).toBe(true);
    expect(isOvertime(map, "2026-10-10", "work")).toBe(false);
    expect(isOvertime(map, "2026-10-01", "rest")).toBe(false);
    expect(isOvertime(map, "2026-08-04", "work")).toBe(false);
  });

  it("年份范围从 2019 起", () => {
    expect(yearsInRange("2025-12-31", "2026-01-02")).toEqual([2025, 2026]);
    expect(yearsInRange("2018-12-31", "2019-01-01")).toEqual([2019]);
  });
});

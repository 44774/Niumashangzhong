import { describe, expect, it } from "vitest";
import { generateCycleSlots } from "../src/cycle.js";

describe("循环排班", () => {
  it("按序列生成窗口内实例", () => {
    const slots = generateCycleSlots({
      startDate: "2026-08-03",
      sequence: ["a", "b"],
      generationHorizonDays: 7,
      endDate: null,
    });
    expect(slots).toHaveLength(7);
    expect(slots[0]).toEqual({ date: "2026-08-03", sequenceIndex: 0, shiftTemplateId: "a" });
    expect(slots[6]).toEqual({ date: "2026-08-09", sequenceIndex: 6, shiftTemplateId: "a" });
  });

  it("空序列不可保存", () => {
    expect(() =>
      generateCycleSlots({
        startDate: "2026-08-03",
        sequence: [],
        generationHorizonDays: 90,
        endDate: null,
      }),
    ).toThrow("不能为空");
  });

  it("结束日期早于窗口时以结束日期为准", () => {
    const slots = generateCycleSlots({
      startDate: "2026-08-03",
      endDate: "2026-08-05",
      sequence: ["a"],
      generationHorizonDays: 90,
    });
    expect(slots.map((s) => s.date)).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("结束日期早于开始日期时为空", () => {
    const slots = generateCycleSlots({
      startDate: "2026-08-10",
      endDate: "2026-08-05",
      sequence: ["a"],
      generationHorizonDays: 90,
    });
    expect(slots).toEqual([]);
  });
});

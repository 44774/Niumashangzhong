import { describe, expect, it } from "vitest";
import { computeRuleInstance, mergeSchedules } from "../utils/rule-view";
import type { ScheduleInstance, ScheduleRuleSummary, ShiftTemplate } from "../typings/api";

const templates: ShiftTemplate[] = [
  {
    id: "t-early",
    name: "早班",
    shortName: "早班",
    kind: "work",
    color: "#10B981",
    startTime: "09:00",
    endTime: "17:30",
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    defaultLocationId: null,
    version: 1,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "t-rest",
    name: "休息",
    shortName: "休",
    kind: "rest",
    color: "#94A3B8",
    startTime: null,
    endTime: null,
    endsNextDay: false,
    unpaidBreakMinutes: 0,
    defaultLocationId: null,
    version: 1,
    isActive: true,
    sortOrder: 2,
  },
];

const rule: ScheduleRuleSummary = {
  id: "r1",
  name: "早休循环",
  startDate: "2026-08-03",
  endDate: null,
  timezone: "Asia/Shanghai",
  sequence: [{ shiftTemplateId: "t-early" }, { shiftTemplateId: "t-rest" }],
  generationHorizonDays: 14,
  version: 1,
  isActive: true,
  isCurrent: true,
};

describe("本地循环计算", () => {
  it("按序列计算未来任意日期", () => {
    const tplMap = new Map(templates.map((t) => [t.id, t]));
    expect(computeRuleInstance(rule, tplMap, "2026-08-03")?.shiftSnapshot.name).toBe("早班");
    expect(computeRuleInstance(rule, tplMap, "2026-08-04")?.shiftSnapshot.name).toBe("休息");
    // 跨月：2026-09-01 偏移 29（0 基），序列 2 → 休息
    expect(computeRuleInstance(rule, tplMap, "2026-09-01")?.shiftSnapshot.name).toBe("休息");
  });

  it("起始日期前与结束日期后不生成", () => {
    const tplMap = new Map(templates.map((t) => [t.id, t]));
    expect(computeRuleInstance(rule, tplMap, "2026-08-02")).toBeNull();
    const ended = { ...rule, endDate: "2026-08-10" };
    expect(computeRuleInstance(ended, tplMap, "2026-08-11")).toBeNull();
  });

  it("合并时已有实例优先，缺失日期本地补齐", () => {
    const existing: ScheduleInstance[] = [
      {
        id: "s-manual",
        ownerUserId: "u1",
        businessDate: "2026-08-04",
        timezone: "Asia/Shanghai",
        startsAt: "2026-08-04T01:00:00.000Z",
        endsAt: "2026-08-04T09:30:00.000Z",
        kind: "work",
        status: "scheduled",
        source: "manual",
        shiftSnapshot: templates[0],
        locationSnapshot: null,
        note: "手动覆盖",
        version: 1,
      },
    ];
    const merged = mergeSchedules(existing, [rule], templates, "2026-08-03", "2026-08-05");
    expect(merged).toHaveLength(3);
    expect(merged[1].note).toBe("手动覆盖"); // 已有实例不被覆盖
    expect(merged[0].id).toBe("rule:r1:2026-08-03");
    expect(merged[2].id).toBe("rule:r1:2026-08-05");
  });

  it("无当前排班表时只返回已有实例", () => {
    const merged = mergeSchedules([], [{ ...rule, isCurrent: false }], templates, "2026-08-03", "2026-08-05");
    expect(merged).toHaveLength(0);
  });
});

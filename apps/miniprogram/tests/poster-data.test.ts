import { describe, expect, it } from "vitest";
import type { ScheduleInstance } from "../typings/api";
import { buildPreviewEntries } from "../utils/poster-data";

function instance(overrides: Partial<ScheduleInstance> = {}): ScheduleInstance {
  return {
    id: "i1",
    ownerUserId: "u1",
    businessDate: "2026-08-04",
    timezone: "Asia/Shanghai",
    startsAt: "2026-08-04T01:00:00Z",
    endsAt: "2026-08-04T09:30:00Z",
    kind: "work",
    status: "scheduled",
    source: "manual",
    shiftSnapshot: {
      name: "早班",
      shortName: "早班",
      kind: "work",
      color: "#10B981",
      startTime: "09:00",
      endTime: "17:30",
      endsNextDay: false,
      unpaidBreakMinutes: 0,
    },
    locationSnapshot: { name: "深圳总部", city: "深圳", address: null },
    note: "内部备注：含敏感信息",
    version: 1,
    ...overrides,
  };
}

describe("分享海报隐私过滤", () => {
  it("隐藏时间、地点与备注", () => {
    const entries = buildPreviewEntries(
      [instance()],
      [],
      {
        showDisplayName: true,
        showTime: false,
        showWeather: true,
        showLocation: false,
        showNote: false,
      },
    );
    expect(entries[0]?.timeText).toBeNull();
    expect(entries[0]?.location).toBeNull();
    expect(entries[0]?.note).toBeNull();
  });

  it("显示时间与备注时保留字段", () => {
    const entries = buildPreviewEntries(
      [instance()],
      [],
      {
        showDisplayName: true,
        showTime: true,
        showWeather: false,
        showLocation: true,
        showNote: true,
      },
    );
    expect(entries[0]?.timeText).toBe("09:00–17:30");
    expect(entries[0]?.location).toBe("深圳总部");
    expect(entries[0]?.note).toContain("内部备注");
    expect(entries[0]?.weather).toBeNull();
  });

  it("天气按日期匹配", () => {
    const entries = buildPreviewEntries(
      [instance()],
      [
        {
          date: "2026-08-04",
          conditionCode: "rain",
          conditionText: "小雨",
          temperatureMin: 24,
          temperatureMax: 28,
          humidityPercent: null,
          precipitationProbability: null,
          windDirection: null,
          windLevel: null,
          airQuality: null,
          warningCodes: [],
          updatedAt: "2026-08-04T00:00:00Z",
        },
      ],
      {
        showDisplayName: true,
        showTime: true,
        showWeather: true,
        showLocation: true,
        showNote: true,
      },
    );
    expect(entries[0]?.weather?.conditionText).toBe("小雨");
  });
});

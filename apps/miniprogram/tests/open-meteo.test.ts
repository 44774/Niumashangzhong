import { describe, expect, it } from "vitest";
import { mapWeatherCode } from "../utils/open-meteo";

describe("Open-Meteo 天气码映射", () => {
  it("常见天气码", () => {
    expect(mapWeatherCode(0).text).toBe("晴");
    expect(mapWeatherCode(2).text).toBe("多云");
    expect(mapWeatherCode(61).text).toBe("小雨");
    expect(mapWeatherCode(71).text).toBe("小雪");
    expect(mapWeatherCode(95).text).toBe("雷阵雨");
    expect(mapWeatherCode(95).warnings).toContain("storm");
  });

  it("未知天气码降级", () => {
    expect(mapWeatherCode(999).text).toBe("未知天气");
    expect(mapWeatherCode(999).code).toBe("unknown");
  });

  it("极端温度警告由调用方补充（映射本身不含）", () => {
    expect(mapWeatherCode(0).warnings).toEqual([]);
  });
});

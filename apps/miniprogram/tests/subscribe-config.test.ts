import { afterEach, describe, expect, it } from "vitest";
import { getSubscribeTemplates } from "../cloudfunctions/api/src/subscribe-config";

afterEach(() => {
  delete process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID;
  delete process.env.SUBSCRIBE_WEATHER_TEMPLATE_ID;
});

describe("订阅模板配置", () => {
  it("未配置任何模板时返回空列表", () => {
    expect(getSubscribeTemplates()).toEqual([]);
  });

  it("只配置上班提醒时，天气提醒复用同一模板并去重", () => {
    process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID = "T_SHIFT";
    const list = getSubscribeTemplates();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "shift_reminder", templateId: "T_SHIFT" });
  });

  it("分别配置两个模板时都返回", () => {
    process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID = "T_SHIFT";
    process.env.SUBSCRIBE_WEATHER_TEMPLATE_ID = "T_WEATHER";
    const list = getSubscribeTemplates();
    expect(list.map((item) => item.key)).toEqual(["shift_reminder", "weather_reminder"]);
    expect(list[1]?.templateId).toBe("T_WEATHER");
  });
});

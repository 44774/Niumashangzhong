/**
 * 微信订阅消息模板配置（单一来源）。
 * 模板 ID 通过云函数环境变量配置，未配置时接口返回空列表，客户端显示“未配置模板”，
 * 调度器只记录日志、不会真实发送。
 */
export interface SubscribeTemplateConfig {
  key: string;
  templateId: string;
  page: string;
  name: string;
}

export function getSubscribeTemplates(): SubscribeTemplateConfig[] {
  const shiftTemplateId = process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID || "";
  const weatherTemplateId = process.env.SUBSCRIBE_WEATHER_TEMPLATE_ID || shiftTemplateId;
  const list: SubscribeTemplateConfig[] = [
    {
      key: "shift_reminder",
      templateId: shiftTemplateId,
      page: "pages/calendar/index",
      name: "上班提醒",
    },
    {
      key: "weather_reminder",
      templateId: weatherTemplateId,
      page: "pages/calendar/index",
      name: "天气提醒",
    },
  ];
  // 天气模板未单独配置时复用上班提醒模板，并在订阅列表中按模板 ID 去重
  const seen = new Set<string>();
  return list.filter((item) => {
    if (!item.templateId || seen.has(item.templateId)) return false;
    seen.add(item.templateId);
    return true;
  });
}

export function getSubscribeTemplateByKey(key: string): SubscribeTemplateConfig | null {
  return getSubscribeTemplates().find((item) => item.key === key) ?? null;
}

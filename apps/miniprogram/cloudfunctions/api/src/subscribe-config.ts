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
  const list: SubscribeTemplateConfig[] = [
    {
      key: "shift_reminder",
      templateId: process.env.SUBSCRIBE_SHIFT_TEMPLATE_ID || "",
      page: "pages/calendar/index",
      name: "上班提醒",
    },
    {
      key: "weather_reminder",
      templateId: process.env.SUBSCRIBE_WEATHER_TEMPLATE_ID || "",
      page: "pages/calendar/index",
      name: "天气提醒",
    },
  ];
  return list.filter((item) => item.templateId.length > 0);
}

export function getSubscribeTemplateByKey(key: string): SubscribeTemplateConfig | null {
  return getSubscribeTemplates().find((item) => item.key === key) ?? null;
}

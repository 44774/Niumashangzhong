export const PRIVACY_USAGE_RULE =
  "开发者将会在本指引所明示的用途内使用收集的信息。如使用超出本指引目的或合理范围，开发者会在变更前再次以弹窗提示或公告方式告知，并征得您的明示同意。";

export interface PrivacyUsageItem {
  title: string;
  desc: string;
}

export const PRIVACY_ITEMS: PrivacyUsageItem[] = [
  {
    title: "微信昵称、头像",
    desc: "用于在“我的”页面展示您的昵称与头像，并在生成分享班表时作为分享人标识。",
  },
  {
    title: "位置信息",
    desc: "用于在您点击“使用当前位置”时获取定位，以查询您所在位置的天气并展示在班表中；仅在您主动操作时获取，不会后台采集。",
  },
  {
    title: "相册（仅写入）",
    desc: "用于将您生成的班表分享海报保存到手机相册。",
  },
  {
    title: "地图选点位置",
    desc: "用于设置天气默认位置，按您在地图中选择的地点查询并展示天气；位置由您主动选择，不会自动获取。",
  },
  {
    title: "订阅消息",
    desc: "用于向您发送上班提醒与天气提醒。",
  },
];

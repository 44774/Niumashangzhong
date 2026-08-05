// 后端模式：true = 微信云开发（CloudBase），false = 本地 Fastify API
export const USE_CLOUDBASE = true;

// 微信云开发环境 ID（开发者工具「云开发」控制台查看）
export const CLOUD_ENV_ID = "cloud1-d7gn5yyw2a7816ffd";

// 云函数名
export const CLOUD_FUNCTION = "api";

// 本地开发指向本机 API；真机调试时改为局域网 IP 或 HTTPS 域名（仅 USE_CLOUDBASE=false 时使用）
export const API_BASE = "http://127.0.0.1:3000/api/v1";

// 微信订阅消息模板 ID 兜底配置：云端返回模板时以云端为准；
// 这里仅用于本地/HTTP 模式或云端未配置时的兜底（上班提醒模板）
export const SUBSCRIBE_TEMPLATE_IDS: string[] = [
  "PPRLh5y2F-_DVDDB-fpMxD5UKcnEqs1FzsZgWk4NZ6Y",
];

export const DEFAULT_CITY = "深圳";

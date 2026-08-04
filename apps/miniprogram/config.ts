// 后端模式：true = 微信云开发（CloudBase），false = 本地 Fastify API
export const USE_CLOUDBASE = true;

// 微信云开发环境 ID（开发者工具「云开发」控制台查看）
export const CLOUD_ENV_ID = "cloud1-d7gn5yyw2a7816ffd";

// 云函数名
export const CLOUD_FUNCTION = "api";

// 本地开发指向本机 API；真机调试时改为局域网 IP 或 HTTPS 域名（仅 USE_CLOUDBASE=false 时使用）
export const API_BASE = "http://127.0.0.1:3000/api/v1";

// 微信订阅消息模板 ID（配置真实 AppID 后填写，开发模式为空）
export const SUBSCRIBE_TEMPLATE_IDS: string[] = [];

export const DEFAULT_CITY = "深圳";

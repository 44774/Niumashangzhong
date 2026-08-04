import { USE_CLOUDBASE } from "../config";
import { api as cloudApi } from "./api-cloud";
import { api as httpApi } from "./api-http";

// 统一出口：按配置切换云开发 / 本地 HTTP API
export const api = USE_CLOUDBASE ? cloudApi : httpApi;

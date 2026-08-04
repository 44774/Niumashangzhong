import { API_BASE } from "../config";
import { getToken, getWorkspaceId } from "../stores/session";

export class ApiError extends Error {
  code: string;
  statusCode: number;
  requestId?: string;

  constructor(statusCode: number, code: string, message: string, requestId?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const token = getToken();
    const workspaceId = getWorkspaceId();
    const header: Record<string, string> = {
      "content-type": "application/json",
      ...options.headers,
    };
    if (token) header.authorization = `Bearer ${token}`;
    if (workspaceId) header["x-workspace-id"] = workspaceId;
    if (options.idempotencyKey) header["idempotency-key"] = options.idempotencyKey;

    wx.request({
      url: `${API_BASE}${path}`,
      method: (options.method ?? "GET") as unknown as WechatMiniprogram.RequestOption["method"],
      data: options.data as string | WechatMiniprogram.IAnyObject | ArrayBuffer | undefined,
      header,
      success(res) {
        const statusCode = res.statusCode;
        if (statusCode >= 200 && statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        const body = (res.data ?? {}) as {
          error?: { code?: string; message?: string; requestId?: string };
        };
        reject(
          new ApiError(
            statusCode,
            body.error?.code ?? "REQUEST_FAILED",
            body.error?.message ?? `请求失败（${statusCode}）`,
            body.error?.requestId,
          ),
        );
      },
      fail() {
        reject(new ApiError(0, "NETWORK_ERROR", "网络连接失败，请检查后端服务与域名校验设置"));
      },
    });
  });
}

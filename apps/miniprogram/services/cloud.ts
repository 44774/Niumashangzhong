import { CLOUD_FUNCTION } from "../config";
import { ApiError } from "./request";

export function callCloud<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.cloud.callFunction({
      name: CLOUD_FUNCTION,
      data: { action, payload },
      success: (res) => {
        const result = (res.result ?? {}) as {
          ok?: boolean;
          data?: T;
          error?: { code?: string; message?: string };
        };
        if (result.ok) {
          resolve(result.data as T);
          return;
        }
        reject(
          new ApiError(
            400,
            result.error?.code ?? "CLOUD_ERROR",
            result.error?.message ?? "云函数调用失败",
          ),
        );
      },
      fail: (err) => {
        reject(new ApiError(0, "CLOUD_NETWORK", err.errMsg || "云函数调用失败"));
      },
    });
  });
}

export class CloudError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail(err: unknown): {
  ok: false;
  error: { code: string; message: string };
} {
  if (err instanceof CloudError) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  const message = err instanceof Error ? err.message : "服务器内部错误";
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}

export function assert(
  cond: unknown,
  code: string,
  message: string,
  statusCode = 400,
): asserts cond {
  if (!cond) {
    throw new CloudError(code, message, statusCode);
  }
}

export function assertDate(date: string): void {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "VALIDATION_ERROR", "日期格式必须为 YYYY-MM-DD");
}

export function assertTime(time: string): void {
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(time), "VALIDATION_ERROR", "时间格式必须为 HH:mm");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function docId(parts: string[]): string {
  return parts.join("_");
}

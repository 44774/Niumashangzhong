export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown> | null;

  constructor(code: string, message: string, statusCode = 400, details?: Record<string, unknown> | null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message = "资源不存在"): AppError {
  return new AppError("NOT_FOUND", message, 404);
}

export function forbidden(message = "没有权限执行此操作"): AppError {
  return new AppError("FORBIDDEN", message, 403);
}

export function unauthorized(message = "请先登录"): AppError {
  return new AppError("UNAUTHORIZED", message, 401);
}

export function versionConflict(message = "数据已被他人修改，请刷新后重试"): AppError {
  return new AppError("VERSION_CONFLICT", message, 409);
}

export function scheduleConflict(message = "该时段与现有班次冲突", details?: Record<string, unknown> | null) {
  return new AppError("SCHEDULE_CONFLICT", message, 409, details);
}

export function validationError(message: string, details?: Record<string, unknown> | null): AppError {
  return new AppError("VALIDATION_ERROR", message, 400, details);
}

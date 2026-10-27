export type AppErrorCode =
  | "NOT_REGISTERED"
  | "RATE_LIMITED"
  | "UPLOAD_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CSV_PARSE_ERROR"
  | "QUIZ_BLOCKED"
  | "SESSION_EXPIRED"
  | "ALREADY_SUBMITTED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly details?: unknown;

  constructor(code: AppErrorCode, userMessage: string, details?: unknown) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

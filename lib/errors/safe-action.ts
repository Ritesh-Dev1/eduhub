import { ZodError } from "zod";
import { AppError, isAppError } from "./app-error";
import { logErrorToDatabase, generateRefId } from "./logger";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string; ref: string; fieldErrors?: Record<string, string[]> };

export function formatZodError(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (firstIssue) {
    return firstIssue.message;
  }
  return "Please check the information you entered and try again.";
}

export function extractZodFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

export async function safeAction<T>(
  actionName: string,
  fn: () => Promise<T>,
  userId?: string | null
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: unknown) {
    const refId = generateRefId();

    if (err instanceof ZodError) {
      // Validation error: safe to present clean message
      const message = formatZodError(err);
      const fieldErrors = extractZodFieldErrors(err);
      return { ok: false, message, ref: refId, fieldErrors };
    }

    if (isAppError(err)) {
      // Known application error with user-friendly message
      await logErrorToDatabase({
        error: `${err.name} [${err.code}]: ${err.userMessage} | details: ${JSON.stringify(err.details || {})}`,
        route: actionName,
        userId,
        refId,
      });

      return {
        ok: false,
        message: err.userMessage,
        ref: refId,
      };
    }

    // Unexpected internal error: log full details to database with refId
    await logErrorToDatabase({
      error: err,
      route: actionName,
      userId,
      refId,
    });

    // Strictly return friendly message without leaking any technical information
    return {
      ok: false,
      message: `Something went wrong on our side. Please try again. If it continues, contact your admin and share reference ID: ${refId}.`,
      ref: refId,
    };
  }
}

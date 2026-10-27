import { createAdminClient } from "@/lib/supabase/admin";

export function generateRefId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface LogErrorParams {
  error: unknown;
  route?: string;
  userId?: string | null;
  refId?: string;
}

export async function logErrorToDatabase({
  error,
  route = "unknown",
  userId = null,
  refId = generateRefId(),
}: LogErrorParams): Promise<string> {
  const errorMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  const stack = error instanceof Error ? error.stack : undefined;

  try {
    const admin = createAdminClient();
    await admin.from("error_logs").insert({
      ref_id: refId,
      message: errorMessage || "Unknown server error",
      stack: stack || null,
      route,
      user_id: userId,
    });
  } catch {
    // Fail-safe: if database logging fails, do not throw or crash the request
  }

  return refId;
}

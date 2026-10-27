import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors/app-error";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingMinutes?: number;
}

export async function checkLoginRateLimit(ip: string, email: string): Promise<RateLimitCheckResult> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // Query failed attempts in the last 15 minutes for this IP and email
  const { data: attempts, error } = await admin
    .from("login_attempts")
    .select("attempted_at")
    .eq("ip", ip)
    .eq("email", email.toLowerCase())
    .eq("success", false)
    .gte("attempted_at", windowStart)
    .order("attempted_at", { ascending: true });

  if (error) {
    // If rate check fails, allow with caution or log silently
    return { allowed: true };
  }

  if (attempts && attempts.length >= MAX_ATTEMPTS) {
    // Oldest attempt in the active window determines expiry
    const oldestAttemptTime = new Date(attempts[0].attempted_at).getTime();
    const expiryTime = oldestAttemptTime + WINDOW_MINUTES * 60 * 1000;
    const diffMs = Math.max(0, expiryTime - Date.now());
    const remainingMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));

    return {
      allowed: false,
      remainingMinutes,
    };
  }

  return { allowed: true };
}

export async function recordLoginAttempt(ip: string, email: string, success: boolean): Promise<void> {
  const admin = createAdminClient();

  await admin.from("login_attempts").insert({
    ip,
    email: email.toLowerCase(),
    success,
  });

  if (success) {
    // Clear previous failed attempts on successful login
    await admin
      .from("login_attempts")
      .delete()
      .eq("ip", ip)
      .eq("email", email.toLowerCase())
      .eq("success", false);
  }
}

export async function enforceLoginRateLimit(ip: string, email: string): Promise<void> {
  const check = await checkLoginRateLimit(ip, email);
  if (!check.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      `Too many attempts. Please try again in ${check.remainingMinutes} minutes.`
    );
  }
}

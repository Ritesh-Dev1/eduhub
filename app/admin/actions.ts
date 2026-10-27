"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema } from "@/lib/validations/auth";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";
import { AppError } from "@/lib/errors/app-error";
import { enforceLoginRateLimit, recordLoginAttempt } from "@/lib/rate-limit/login-limiter";
import { getClientIp } from "@/lib/utils/get-ip";

export async function loginAdminAction(formData: unknown): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("loginAdminAction", async () => {
    const validated = loginSchema.parse(formData);
    const ip = await getClientIp();

    // 1. Enforce rate limiting: max 5 failed attempts in 15 mins
    await enforceLoginRateLimit(ip, validated.email);

    const supabase = await createClient();

    // 2. Attempt Supabase Auth login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (authError || !authData.user) {
      await recordLoginAttempt(ip, validated.email, false);
      throw new AppError("UNAUTHORIZED", "Invalid email address or password. Please try again.");
    }

    // 3. Confirm user is in admins table
    const adminClient = createAdminClient();
    const { data: adminRecord, error: adminQueryError } = await adminClient
      .from("admins")
      .select("id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (adminQueryError || !adminRecord) {
      // User has credentials but lacks admin role: revoke session and fail
      await supabase.auth.signOut();
      await recordLoginAttempt(ip, validated.email, false);
      throw new AppError("FORBIDDEN", "You do not have administrator permissions.");
    }

    // 4. Record successful attempt and clear failure window
    await recordLoginAttempt(ip, validated.email, true);

    return { success: true };
  });
}

export async function logoutAdminAction(): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("logoutAdminAction", async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { success: true };
  });
}

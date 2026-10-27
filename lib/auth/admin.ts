import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors/app-error";

export interface AdminUser {
  id: string;
  email: string;
}

export async function getCurrentAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AppError("UNAUTHORIZED", "Please sign in to access the admin panel.");
  }

  // Verify against admins table
  const adminClient = createAdminClient();
  const { data: adminRecord, error: adminError } = await adminClient
    .from("admins")
    .select("id, user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminRecord) {
    throw new AppError("FORBIDDEN", "You do not have administrator permissions.");
  }

  return {
    id: user.id,
    email: user.email || adminRecord.email || "",
  };
}

export async function verifyAdminStatus(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return !!data;
}

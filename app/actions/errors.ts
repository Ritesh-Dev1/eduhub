"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";

export interface ErrorLogItem {
  id: string;
  ref_id: string;
  message: string;
  stack: string | null;
  route: string | null;
  user_id: string | null;
  created_at: string;
}

export async function getErrorLogsAction(
  searchRefId?: string
): Promise<ActionResult<{ logs: ErrorLogItem[] }>> {
  return safeAction("getErrorLogsAction", async () => {
    await getCurrentAdmin();
    const admin = createAdminClient();

    let query = admin
      .from("error_logs")
      .select("id, ref_id, message, stack, route, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (searchRefId && searchRefId.trim() !== "") {
      const q = searchRefId.trim().toUpperCase();
      query = query.ilike("ref_id", `%${q}%`);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    return { logs: (logs as ErrorLogItem[]) || [] };
  });
}

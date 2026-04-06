import { supabase } from "@/integrations/supabase/client";

type AdminWriteParams = {
  table: string;
  operation: "insert" | "update" | "delete";
  data?: Record<string, unknown> | Record<string, unknown>[];
  match?: { column: string; value: string };
  matchColumn?: string;
  matchValues?: string[];
};

/**
 * Routes a write operation through the admin-write edge function,
 * which validates the admin PIN server-side before executing.
 */
export async function adminWrite(params: AdminWriteParams): Promise<{ success: boolean; error?: string }> {
  const pin = sessionStorage.getItem("admin_pin") ?? "";
  const { data, error } = await supabase.functions.invoke("admin-write", {
    body: { pin, ...params },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  if (!data?.success) {
    return { success: false, error: data?.error || "Unknown error" };
  }
  return { success: true };
}

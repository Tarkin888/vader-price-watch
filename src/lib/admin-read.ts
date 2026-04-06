import { supabase } from "@/integrations/supabase/client";

/**
 * Reads from admin-only tables via the admin-read edge function,
 * which validates the admin PIN server-side before executing.
 */
export async function adminRead(params: {
  table: string;
  order_by?: string;
  order_asc?: boolean;
  limit?: number;
}): Promise<{ data: any[] | null; error?: string }> {
  const pin = sessionStorage.getItem("admin_pin") ?? "";
  const { data, error } = await supabase.functions.invoke("admin-read", {
    body: { pin, ...params },
  });
  if (error) {
    return { data: null, error: error.message };
  }
  if (data?.error) {
    return { data: null, error: data.error };
  }
  return { data: data?.data ?? [] };
}

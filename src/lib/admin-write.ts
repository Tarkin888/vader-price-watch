import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

type AdminWriteParams = {
  table: string;
  operation: "insert" | "update" | "delete";
  data?: Record<string, unknown> | Record<string, unknown>[];
  match?: { column: string; value: string };
  matchColumn?: string;
  matchValues?: string[];
};

/**
 * Attempts to read a useful error message + details out of a Supabase
 * FunctionsHttpError response body. Edge functions now return the full
 * { error, details } shape on non-2xx, so we surface both instead of
 * falling back to the opaque "non-2xx status code" message.
 */
async function extractHttpErrorMessage(error: unknown): Promise<string | undefined> {
  if (!(error instanceof FunctionsHttpError)) return undefined;
  try {
    const body = await error.context.clone().json();
    if (body && typeof body === "object") {
      const msg = typeof body.error === "string" ? body.error : undefined;
      const det = typeof body.details === "string" ? body.details : undefined;
      if (msg && det && det !== msg) return `${msg} — ${det}`;
      return msg || det;
    }
  } catch {
    // Body wasn't JSON — fall through to text.
  }
  try {
    const text = await error.context.clone().text();
    if (text) return text;
  } catch {
    // Give up — caller will use error.message.
  }
  return undefined;
}

/**
 * Routes a write operation through the admin-write edge function,
 * which validates the admin PIN server-side before executing.
 */
export async function adminWrite(params: AdminWriteParams): Promise<{ success: boolean; error?: string }> {
  const pin = sessionStorage.getItem("admin_pin") ?? "";
  if (!pin) {
    return { success: false, error: "No admin PIN set — authenticate via Admin Dashboard first" };
  }
  const { data, error } = await supabase.functions.invoke("admin-write", {
    body: { pin, ...params },
  });
  if (error) {
    const detailed = await extractHttpErrorMessage(error);
    return { success: false, error: detailed || data?.error || error.message };
  }
  if (!data?.success) {
    const details = typeof data?.details === "string" ? data.details : undefined;
    const msg = data?.error || "Unknown error";
    return { success: false, error: details && details !== msg ? `${msg} — ${details}` : msg };
  }
  return { success: true };
}

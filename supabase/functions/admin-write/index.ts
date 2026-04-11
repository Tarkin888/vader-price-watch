import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyAuth(req: Request, supabase: any): Promise<{ user: any; profile: any; error?: string; status?: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, profile: null, error: "Not authenticated", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { user: null, profile: null, error: "Invalid session", status: 401 };
  }
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status !== "approved") {
    return { user, profile, error: "Account not approved", status: 403 };
  }
  return { user, profile };
}

const ALLOWED_TABLES = [
  "lots",
  "collection",
  "audit_log",
  "scraper_logs",
  "bug_reports",
  "knowledge_articles",
];

type Operation = "insert" | "update" | "delete";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pin, table, operation, data, match, matchColumn, matchValues } = body as {
      pin: string;
      table: string;
      operation: Operation;
      data?: Record<string, unknown> | Record<string, unknown>[];
      match?: { column: string; value: string };
      matchColumn?: string;
      matchValues?: string[];
    };

    if (!pin || !table || !operation) {
      return new Response(
        JSON.stringify({ error: "Missing pin, table, or operation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: "Invalid table" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["insert", "update", "delete"].includes(operation)) {
      return new Response(
        JSON.stringify({ error: "Invalid operation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Layer 1: JWT verification
    const auth = await verifyAuth(req, supabase);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status || 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Layer 1b: Admin role check
    if (auth.profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Layer 2: PIN verification
    const { data: pinValid } = await supabase.rpc("verify_admin_pin", {
      pin_input: pin,
    });
    if (!pinValid) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { error: unknown; data?: unknown; count?: number | null } = { error: null };

    if (operation === "insert") {
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Missing data for insert" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result = await supabase.from(table).insert(data as any);
    } else if (operation === "update") {
      if (!data || !match) {
        return new Response(
          JSON.stringify({ error: "Missing data or match for update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result = await supabase
        .from(table)
        .update(data as any)
        .eq(match.column, match.value);
    } else if (operation === "delete") {
      if (match) {
        result = await supabase.from(table).delete().eq(match.column, match.value);
      } else if (matchColumn && matchValues && matchValues.length > 0) {
        result = await supabase.from(table).delete().in(matchColumn, matchValues);
      } else {
        return new Response(
          JSON.stringify({ error: "Missing match or matchValues for delete" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (result.error) {
      const errMsg = (result.error as any).message || "Database error";
      const errDetails = (result.error as any).details || "";
      const errCode = (result.error as any).code || "";
      console.error("admin-write DB error:", JSON.stringify({ errMsg, errDetails, errCode, table, operation }));
      return new Response(
        JSON.stringify({ success: false, error: errMsg, details: errDetails, code: errCode }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Server error";
    console.error("admin-write exception:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

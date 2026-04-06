import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Validate required fields
    if (!pin || !table || !operation) {
      return new Response(
        JSON.stringify({ error: "Missing pin, table, or operation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate table name against whitelist
    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: "Invalid table" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate operation
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

    // Verify PIN server-side
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
      return new Response(
        JSON.stringify({ error: (result.error as any).message || "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

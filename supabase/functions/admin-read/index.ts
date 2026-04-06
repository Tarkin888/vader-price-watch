import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = ["scraper_logs", "audit_log"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pin, table, order_by, order_asc, limit: rowLimit } = await req.json();

    if (!pin || !table) {
      return new Response(JSON.stringify({ error: "Missing pin or table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Invalid table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pinValid } = await supabase.rpc("verify_admin_pin", { pin_input: pin });
    if (!pinValid) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.from(table).select("*");
    if (order_by) {
      query = query.order(order_by, { ascending: !!order_asc });
    }
    if (rowLimit) {
      query = query.limit(Math.min(Number(rowLimit), 500));
    }

    const { data, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

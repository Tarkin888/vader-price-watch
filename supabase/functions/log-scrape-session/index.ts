import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require service role key via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const {
      source,
      started_at,
      completed_at,
      duration_seconds,
      status,
      phase1_anchors,
      phase1_walks,
      lots_visited,
      moc_passed,
      new_inserted,
      duplicates_skipped,
      errors,
      error_summary,
      scraper_version,
    } = body;

    if (!source || !status) {
      return new Response(
        JSON.stringify({ error: "source and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const { data, error } = await supabase.from("scrape_sessions").insert({
      source,
      started_at: started_at || new Date().toISOString(),
      completed_at: completed_at || null,
      duration_seconds: duration_seconds ?? null,
      status,
      phase1_anchors: phase1_anchors ?? 0,
      phase1_walks: phase1_walks ?? 0,
      lots_visited: lots_visited ?? 0,
      moc_passed: moc_passed ?? 0,
      new_inserted: new_inserted ?? 0,
      duplicates_skipped: duplicates_skipped ?? 0,
      errors: errors ?? 0,
      error_summary: error_summary ? String(error_summary).slice(0, 500) : null,
      scraper_version: scraper_version || null,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

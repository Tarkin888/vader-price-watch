import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = claimsData.user;

    // Parse and validate body
    const body = await req.json();
    const { page_or_feature, description, severity, screenshot_url } = body as {
      page_or_feature?: string;
      description?: string;
      severity?: string;
      screenshot_url?: string;
    };

    if (!page_or_feature || typeof page_or_feature !== "string" || page_or_feature.trim().length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "page_or_feature is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return new Response(
        JSON.stringify({ ok: false, error: "Description must be at least 10 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (description.trim().length > 2000) {
      return new Response(
        JSON.stringify({ ok: false, error: "Description must be under 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSeverities = ["Low", "Medium", "High", "Critical"];
    const sev = severity && validSeverities.includes(severity) ? severity : "Medium";

    // Insert using service role to bypass any issues, but scope to the authed user
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: inserted, error: insertError } = await serviceClient
      .from("user_bug_reports")
      .insert({
        user_id: user.id,
        user_email: user.email || "",
        page_or_feature: page_or_feature.trim(),
        description: description.trim(),
        severity: sev,
        screenshot_url: screenshot_url || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("submit-bug-report insert error:", insertError);
      return new Response(
        JSON.stringify({ ok: false, error: insertError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, id: inserted.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("submit-bug-report exception:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

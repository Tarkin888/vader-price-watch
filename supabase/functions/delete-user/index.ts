import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyAuth(req, supabase) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, profile: null, error: "Not authenticated", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { user: null, profile: null, error: "Invalid session", status: 401 };
  }
  const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.status !== "approved") {
    return { user, profile, error: "Account not approved", status: 403 };
  }
  return { user, profile };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { userId, userEmail } = await req.json();
    if (!userId) return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const auth = await verifyAuth(req, supabase);
    if (auth.error) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status || 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (auth.profile.role !== "admin") return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (userId === auth.user.id) return new Response(JSON.stringify({ error: "You cannot delete your own account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    await supabase.from("page_views").insert({ page: `AUDIT:USER_DELETED:${userEmail || userId}`, user_agent: auth.user.email || "" });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pin, key, value } = await req.json();

    if (!pin || !key || value === undefined) {
      return new Response(JSON.stringify({ error: "Missing pin, key, or value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Layer 1: JWT verification
    const auth = await verifyAuth(req, supabase);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Layer 1b: Admin role check
    if (auth.profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Layer 2: PIN verification
    const { data: pinValid } = await supabase.rpc("verify_admin_pin", { pin_input: pin });
    if (!pinValid) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("admin_config")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

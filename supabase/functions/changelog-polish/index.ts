import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

const SYSTEM_PROMPT = `You are polishing a software changelog entry written in markdown for the Imperial Price Terminal admin dashboard. Tighten prose, fix typos and grammar, preserve all markdown formatting (headings, bullets, bold, code blocks, links), keep the original meaning, keep all version numbers / file names / commit hashes / URLs exactly as written. Use UK English spelling and grammar throughout (organise, behaviour, colour, optimise). Do not add new content. Do not remove technical detail. Return only the polished markdown — no preamble, no explanation, no code fences wrapping the whole response.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Not authenticated" });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json(401, { error: "Invalid session" });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role,status")
      .eq("id", user.id)
      .single();
    if (!profile || profile.status !== "approved") return json(403, { error: "Account not approved" });
    if (profile.role !== "admin") return json(403, { error: "Admin access required" });

    // Auth: PIN (header or body)
    let pin = req.headers.get("x-admin-pin") ?? "";
    let text = "";
    try {
      const body = await req.json();
      if (!pin && typeof body?.pin === "string") pin = body.pin;
      text = typeof body?.text === "string" ? body.text : "";
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const { data: pinValid } = await supabase.rpc("verify_admin_pin", { pin_input: pin });
    if (!pinValid) return json(401, { error: "Invalid PIN" });

    // Validate text
    const trimmed = text.trim();
    if (!trimmed) return json(400, { error: "Text is required" });
    if (text.length > 10000) return json(400, { error: "Text exceeds 10,000 character limit" });

    // Log request (length only, never body)
    await supabase.from("user_activity").insert({
      user_id: user.id,
      event_type: "changelog.polish_request",
      metadata: { text_length: text.length },
    });

    // Call Anthropic
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json(500, { error: "ANTHROPIC_API_KEY not configured" });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error:", res.status, errText);
      return json(502, { error: `Polish service error (${res.status})` });
    }

    const claudeData = await res.json();
    const polished = claudeData?.content?.[0]?.text;
    if (typeof polished !== "string" || !polished.trim()) {
      return json(502, { error: "Empty polish response" });
    }

    return json(200, { polished });
  } catch (e) {
    console.error("changelog-polish unhandled:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});

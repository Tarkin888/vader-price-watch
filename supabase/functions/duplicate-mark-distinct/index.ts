// PIN-gated insertion into duplicate_ignore_list so a flagged pair stops
// reappearing in scans.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { pin, lotIdA, lotIdB } = body ?? {};
    if (!pin || typeof pin !== "string") {
      return json({ error: "Missing PIN" }, 200);
    }
    if (!lotIdA || !lotIdB || lotIdA === lotIdB) {
      return json({ error: "Invalid lot IDs" }, 200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pinValid, error: pinErr } = await supabase.rpc(
      "verify_admin_pin",
      { pin_input: pin },
    );
    if (pinErr || !pinValid) {
      return json({ error: "Invalid PIN" }, 200);
    }

    const { error: insErr } = await supabase
      .from("duplicate_ignore_list")
      .insert({
        lot_id_a: lotIdA,
        lot_id_b: lotIdB,
        marked_by: "admin",
      });

    if (insErr) {
      // Unique violation = already marked. Treat as success.
      if (insErr.code === "23505") {
        return json({ success: true, alreadyMarked: true }, 200);
      }
      return json({ error: "Insert failed", details: insErr.message }, 200);
    }

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Unhandled error", details: String(e?.message ?? e) }, 200);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

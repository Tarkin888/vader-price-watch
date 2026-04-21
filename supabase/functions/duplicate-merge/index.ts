// PIN-gated merge of two suspected duplicate lots.
// Backfills empty fields on the kept lot from the losing lot, logs to
// duplicate_merge_log + audit_log, then deletes the losing lot.

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
    const { pin, keepLotId, deleteLotId } = body ?? {};
    if (!pin || typeof pin !== "string") {
      return json({ error: "Missing PIN" }, 200);
    }
    if (!keepLotId || !deleteLotId || keepLotId === deleteLotId) {
      return json({ error: "Invalid keepLotId / deleteLotId" }, 200);
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

    const { data: rows, error: fetchErr } = await supabase
      .from("lots")
      .select("id, source, lot_ref, condition_notes, image_urls, grade_subgrades")
      .in("id", [keepLotId, deleteLotId]);
    if (fetchErr) {
      return json({ error: "Failed to load lots", details: fetchErr.message }, 200);
    }
    const keep = rows?.find((r) => r.id === keepLotId);
    const losing = rows?.find((r) => r.id === deleteLotId);
    if (!keep || !losing) {
      return json({ error: "One or both lots not found" }, 200);
    }

    // Backfill empty fields on kept lot from losing lot.
    const updates: Record<string, unknown> = {};
    const isEmptyStr = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");
    const isEmptyArr = (v: unknown) => !Array.isArray(v) || v.length === 0;

    if (isEmptyStr(keep.condition_notes) && !isEmptyStr(losing.condition_notes)) {
      updates.condition_notes = losing.condition_notes;
    }
    if (isEmptyArr(keep.image_urls) && !isEmptyArr(losing.image_urls)) {
      updates.image_urls = losing.image_urls;
    }
    if (isEmptyStr(keep.grade_subgrades) && !isEmptyStr(losing.grade_subgrades)) {
      updates.grade_subgrades = losing.grade_subgrades;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabase
        .from("lots")
        .update(updates)
        .eq("id", keepLotId);
      if (updErr) {
        return json({ error: "Backfill failed", details: updErr.message }, 200);
      }
    }

    // Log merge.
    const { error: logErr } = await supabase.from("duplicate_merge_log").insert({
      kept_lot_id: keepLotId,
      deleted_lot_id: deleteLotId,
      kept_lot_ref: keep.lot_ref,
      deleted_lot_ref: losing.lot_ref,
      source: keep.source,
      merged_by: "admin",
    });
    if (logErr) {
      return json({ error: "Failed to log merge", details: logErr.message }, 200);
    }

    // Audit log entry.
    await supabase.from("audit_log").insert({
      action: "DUPLICATE_MERGE",
      lot_id: deleteLotId,
      lot_ref: losing.lot_ref,
      field_changed: "merged_into",
      old_value: deleteLotId,
      new_value: keepLotId,
    });

    // Delete the losing lot.
    const { error: delErr } = await supabase
      .from("lots")
      .delete()
      .eq("id", deleteLotId);
    if (delErr) {
      return json({ error: "Delete failed", details: delErr.message }, 200);
    }

    return json({ success: true, backfilled: Object.keys(updates) }, 200);
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

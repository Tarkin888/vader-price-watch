// PIN-gated scan for suspected duplicate lots.
// Rules: same source, same variant_grade_key, sale_date within 30 days,
// total_paid_gbp within 1%, not in duplicate_ignore_list.
// Returns up to 200 pairs ordered by most recent sale_date.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAIR_CAP = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

type LotRow = {
  id: string;
  source: string;
  sale_date: string;
  variant_grade_key: string;
  total_paid_gbp: number | null;
  cardback_code: string;
  lot_ref: string;
  lot_url: string;
  image_urls: string[] | null;
  condition_notes: string | null;
  grade_subgrades: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json().catch(() => ({}));
    if (!pin || typeof pin !== "string") {
      return json({ error: "Missing PIN" }, 200);
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

    // Fetch all lots needed for comparison.
    const { data: lots, error: lotsErr } = await supabase
      .from("lots")
      .select(
        "id, source, sale_date, variant_grade_key, total_paid_gbp, cardback_code, lot_ref, lot_url, image_urls, condition_notes, grade_subgrades",
      )
      .order("sale_date", { ascending: false });

    if (lotsErr) {
      return json({ error: "Failed to load lots", details: lotsErr.message }, 200);
    }

    // Fetch ignore list once.
    const { data: ignoreRows, error: ignoreErr } = await supabase
      .from("duplicate_ignore_list")
      .select("lot_id_a, lot_id_b");
    if (ignoreErr) {
      return json({ error: "Failed to load ignore list", details: ignoreErr.message }, 200);
    }
    const ignoreSet = new Set<string>();
    for (const r of ignoreRows ?? []) {
      ignoreSet.add(pairKey(r.lot_id_a, r.lot_id_b));
    }

    // Bucket by source + variant_grade_key for O(group^2) instead of O(n^2).
    const buckets = new Map<string, LotRow[]>();
    for (const lot of (lots ?? []) as LotRow[]) {
      if (!lot.source || !lot.variant_grade_key) continue;
      if (lot.total_paid_gbp == null || Number(lot.total_paid_gbp) <= 0) continue;
      const key = `${lot.source}::${lot.variant_grade_key}`;
      const arr = buckets.get(key) ?? [];
      arr.push(lot);
      buckets.set(key, arr);
    }

    // Collect all matching pairs first, count total, then sort + cap.
    type Pair = {
      a: LotRow;
      b: LotRow;
      maxSaleDate: number;
    };
    const allPairs: Pair[] = [];

    for (const arr of buckets.values()) {
      if (arr.length < 2) continue;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          if (ignoreSet.has(pairKey(a.id, b.id))) continue;

          const aDate = Date.parse(a.sale_date);
          const bDate = Date.parse(b.sale_date);
          if (Number.isNaN(aDate) || Number.isNaN(bDate)) continue;
          if (Math.abs(aDate - bDate) > 30 * DAY_MS) continue;

          const aPrice = Number(a.total_paid_gbp);
          const bPrice = Number(b.total_paid_gbp);
          const larger = Math.max(aPrice, bPrice);
          if (larger <= 0) continue;
          const diffPct = Math.abs(aPrice - bPrice) / larger;
          if (diffPct > 0.01) continue;

          allPairs.push({ a, b, maxSaleDate: Math.max(aDate, bDate) });
        }
      }
    }

    const pairsTotal = allPairs.length;
    allPairs.sort((x, y) => y.maxSaleDate - x.maxSaleDate);
    const capped = allPairs.slice(0, PAIR_CAP);

    // Stats: ignored count + merged count.
    const [{ count: ignoredCount }, { count: mergedCount }] = await Promise.all([
      supabase
        .from("duplicate_ignore_list")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("duplicate_merge_log")
        .select("id", { count: "exact", head: true }),
    ]);

    return json({
      pairs: capped.map((p) => ({ a: p.a, b: p.b })),
      pairsReturned: capped.length,
      pairsTotal,
      truncated: pairsTotal > capped.length,
      stats: {
        flagged: pairsTotal,
        ignored: ignoredCount ?? 0,
        merged: mergedCount ?? 0,
      },
    }, 200);
  } catch (e) {
    return json({ error: "Unhandled error", details: String(e?.message ?? e) }, 200);
  }
});

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

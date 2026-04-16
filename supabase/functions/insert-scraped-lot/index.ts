/**
 * insert-scraped-lot — Accepts a single scraped lot record and inserts it
 * into the `lots` table using service_role (bypasses RLS).
 *
 * Callers (5 scrapers):
 *   1. Heritage  — scripts/scrape-heritage.cjs
 *   2. Hake's    — (planned migration from local insert)
 *   3. LCG       — scripts/scrape-lcg.cjs
 *   4. Vectis    — scripts/scrape-vectis.js
 *   5. C&T       — scripts/scrape-candt.cjs
 *
 * Auth: Bearer token must match SCRAPER_SHARED_SECRET.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_FIELDS = ["source", "lot_ref", "sale_date"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, reason: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const secret = Deno.env.get("SCRAPER_SHARED_SECRET");
    if (!secret || authHeader.replace("Bearer ", "") !== secret) {
      return new Response(
        JSON.stringify({ success: false, reason: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Parse body ───────────────────────────────────────────────────
    const body = await req.json();

    // Map camelCase input to snake_case DB columns
    const row = {
      source: body.source,
      era: body.era || "UNKNOWN",
      cardback_code: body.cardbackCode || body.cardback_code || "UNKNOWN",
      variant_code: body.variantCode || body.variant_code,
      grade_tier_code: body.gradeTierCode || body.grade_tier_code,
      variant_grade_key: body.variantGradeKey || body.variant_grade_key || "",
      hammer_price_gbp: body.hammerPriceGBP ?? body.hammer_price_gbp ?? 0,
      buyers_premium_gbp: body.buyersPremiumGBP ?? body.buyers_premium_gbp ?? 0,
      total_paid_gbp: body.totalPaidGBP ?? body.total_paid_gbp ?? 0,
      sale_date: body.saleDate || body.sale_date,
      capture_date: body.captureDate || body.capture_date || new Date().toISOString().slice(0, 10),
      lot_ref: body.lotRef || body.lot_ref || "",
      lot_url: body.lotUrl || body.lot_url || "",
      condition_notes: body.conditionNotes || body.condition_notes || "",
      image_urls: body.imageUrls || body.image_urls || [],
      cached_image_url: body.cachedImageUrl || body.cached_image_url || null,
      usd_to_gbp_rate: body.usdToGbpRate ?? body.usd_to_gbp_rate ?? 1,
      grade_subgrades: body.gradeSubgrades || body.grade_subgrades || "",
      price_status: body.priceStatus || body.price_status || "CONFIRMED",
      estimate_low_gbp: body.estimateLowGBP ?? body.estimate_low_gbp ?? null,
      estimate_high_gbp: body.estimateHighGBP ?? body.estimate_high_gbp ?? null,
    };

    // ── Validation ───────────────────────────────────────────────────
    const errors: string[] = [];
    if (!row.source) errors.push("source is required");
    if (!row.lot_ref) errors.push("lot_ref (lotRef) is required");
    if (!row.sale_date) errors.push("sale_date (saleDate) is required");

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, reason: "validation", errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Supabase client (service role) ───────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Duplicate check ──────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("lots")
      .select("id")
      .eq("lot_ref", row.lot_ref)
      .eq("source", row.source)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, reason: "duplicate", existingId: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Insert ───────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("lots")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("DB insert error:", error);
      return new Response(
        JSON.stringify({ success: false, reason: "db_error", detail: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id, record: data }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("insert-scraped-lot error:", message);
    return new Response(
      JSON.stringify({ success: false, reason: "server_error", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

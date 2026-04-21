// Edge Function: log-scraper-run
// Purpose: Headless logging endpoint for the 5 scrapers (Heritage, Hakes,
// LCG, Vectis, CandT). Writes one row per run into the scraper_logs table
// (the same table the Admin → Scrapers dashboard reads).
//
// Auth: Authorization: Bearer <SCRAPER_SHARED_SECRET>  (same secret as
// insert-scraped-lot). Reject everything else with 401.
//
// Contract (POST JSON):
// {
//   "source": "heritage|hakes|lcg|vectis|candt"   // case-insensitive, normalised server-side
//   "status": "success|failed",                   // mapped to SUCCESS|FAILED
//   "captured_count": 0,
//   "skipped_count": 0,
//   "duration_ms": 0,
//   "error_message": "optional string, null on success",
//   "started_at": "optional ISO8601; falls back to now() - duration_ms"
// }
//
// Returns: { ok: true, run_id } on success, { ok: false, error } on failure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Casing source of truth — must match SOURCES in src/components/admin/ScrapersTab.tsx
const SOURCE_MAP: Record<string, string> = {
  heritage: "Heritage",
  hakes: "Hakes",
  lcg: "LCG",
  vectis: "Vectis",
  candt: "CandT",
};

// Status source of truth — verified against live scraper_logs rows (uppercase).
const STATUS_MAP: Record<string, string> = {
  success: "SUCCESS",
  failed: "FAILED",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  // --- Auth: shared scraper secret -----------------------------------------
  const sharedSecret = Deno.env.get("SCRAPER_SHARED_SECRET");
  if (!sharedSecret) {
    return json(500, { ok: false, error: "Server misconfigured: SCRAPER_SHARED_SECRET not set" });
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || authHeader.slice(7) !== sharedSecret) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  // --- Body parse ----------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  // --- Validate source -----------------------------------------------------
  const rawSource = typeof body.source === "string" ? body.source.trim().toLowerCase() : "";
  const source = SOURCE_MAP[rawSource];
  if (!source) {
    return json(400, {
      ok: false,
      error: `Invalid source. Expected one of: ${Object.keys(SOURCE_MAP).join(", ")}`,
    });
  }

  // --- Validate status -----------------------------------------------------
  const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  const status = STATUS_MAP[rawStatus];
  if (!status) {
    return json(400, {
      ok: false,
      error: `Invalid status. Expected one of: ${Object.keys(STATUS_MAP).join(", ")}`,
    });
  }

  // --- Numeric fields (lenient: missing → 0) -------------------------------
  const toInt = (v: unknown, field: string): number | { error: string } => {
    if (v == null) return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { error: `Invalid ${field}: must be a non-negative number` };
    return Math.floor(n);
  };
  const captured = toInt(body.captured_count, "captured_count");
  if (typeof captured === "object") return json(400, { ok: false, error: captured.error });
  const skipped = toInt(body.skipped_count, "skipped_count");
  if (typeof skipped === "object") return json(400, { ok: false, error: skipped.error });

  let durationMs = 0;
  if (body.duration_ms != null) {
    const n = Number(body.duration_ms);
    if (!Number.isFinite(n) || n < 0) {
      return json(400, { ok: false, error: "Invalid duration_ms: must be a non-negative number" });
    }
    durationMs = n;
  }
  // Float seconds with millisecond precision (no integer cast).
  const durationSeconds = durationMs / 1000;

  // --- Timestamps ----------------------------------------------------------
  const completedAt = new Date();
  let startedAt: Date;
  if (typeof body.started_at === "string" && body.started_at.length > 0) {
    const parsed = new Date(body.started_at);
    if (Number.isNaN(parsed.getTime())) {
      return json(400, { ok: false, error: "Invalid started_at: must be ISO8601" });
    }
    startedAt = parsed;
  } else {
    startedAt = new Date(completedAt.getTime() - durationMs);
  }

  // --- error_message -------------------------------------------------------
  let errorMessage: string | null = null;
  if (body.error_message != null) {
    if (typeof body.error_message !== "string") {
      return json(400, { ok: false, error: "error_message must be a string or null" });
    }
    errorMessage = body.error_message.length > 0 ? body.error_message.slice(0, 2000) : null;
  }

  // --- Insert --------------------------------------------------------------
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("scraper_logs")
    .insert({
      source,
      status,
      records_captured: captured,
      records_skipped: skipped,
      duration_seconds: durationSeconds,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      error_message: errorMessage,
    })
    .select("id")
    .single();

  if (error) {
    console.error("log-scraper-run insert failed:", error);
    return json(500, { ok: false, error: error.message });
  }

  return json(200, { ok: true, run_id: data.id });
});

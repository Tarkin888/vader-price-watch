import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const { data, error: fetchErr } = await supabase
  .from("lots")
  .select("id")
  .eq("source", "Vectis")
  .eq("price_status", "UNSOLD");

if (fetchErr) { console.error("Fetch error:", fetchErr.message); process.exit(1); }
if (!data.length) { console.log("No Vectis UNSOLD records found."); process.exit(0); }

const ids = data.map(r => r.id);
const { error: updateErr } = await supabase
  .from("lots")
  .update({
    price_status: "ESTIMATE_ONLY",
    hammer_price_gbp: null,
    buyers_premium_gbp: null,
    total_paid_gbp: null,
  })
  .in("id", ids);

if (updateErr) { console.error("Update error:", updateErr.message); process.exit(1); }

console.log(`Reset ${ids.length} records from UNSOLD back to ESTIMATE_ONLY`);

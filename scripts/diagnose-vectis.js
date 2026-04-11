const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  const { data, error } = await supabase
    .from("lots")
    .select("id, lot_ref, condition_notes, variant_code")
    .eq("source", "Vectis")
    .limit(10);

  if (error) { console.error("Error:", error.message); process.exit(1); }

  for (const record of data) {
    console.log("---");
    console.log("lotRef:", record.lot_ref);
    console.log("variant:", record.variant_code);
    console.log("condition_notes:", JSON.stringify(record.condition_notes));
  }
}

diagnose().catch(console.error);

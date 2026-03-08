import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { deriveFromVariantCode } from "@/lib/classify-lot";

export type Lot = Tables<"lots">;
export type LotInsert = TablesInsert<"lots">;

export async function getAllLots(): Promise<Lot[]> {
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .order("sale_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fix any lots with UNKNOWN era/cardback by deriving from variant_code */
export async function fixUnknownEraCardback(): Promise<void> {
  const { data, error } = await supabase
    .from("lots")
    .select("id, variant_code, era, cardback_code")
    .or("era.eq.UNKNOWN,cardback_code.eq.UNKNOWN");
  if (error || !data || data.length === 0) return;

  for (const lot of data) {
    const derived = deriveFromVariantCode(lot.variant_code);
    const updates: Record<string, string> = {};
    if (lot.era === "UNKNOWN" && derived.era !== "UNKNOWN") updates.era = derived.era;
    if (lot.cardback_code === "UNKNOWN" && derived.cardback_code !== "UNKNOWN") updates.cardback_code = derived.cardback_code;
    if (Object.keys(updates).length > 0) {
      await supabase.from("lots").update(updates).eq("id", lot.id);
    }
  }
}

export async function seedIfEmpty(): Promise<void> {
  const { count, error } = await supabase
    .from("lots")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const seeds: LotInsert[] = [
    {
      capture_date: "2025-03-01",
      sale_date: "2025-02-15",
      source: "Heritage",
      lot_ref: "LOT-4821",
      lot_url: "https://www.ha.com/example/lot-4821",
      variant_code: "12A",
      grade_tier_code: "AFA-80",
      hammer_price_gbp: 8500,
      buyers_premium_gbp: 2125,
      total_paid_gbp: 10625,
      usd_to_gbp_rate: 0.79,
      image_urls: ["https://placehold.co/200x300/080806/C9A84C?text=12A+AFA80"],
      condition_notes: "Minor card yellowing, bubble intact",
      grade_subgrades: "C80 B85 F80",
    },
    {
      capture_date: "2025-02-20",
      sale_date: "2025-01-28",
      source: "Vectis",
      lot_ref: "VEC-1192",
      lot_url: "https://www.vectis.co.uk/example/vec-1192",
      variant_code: "12B",
      grade_tier_code: "RAW-EX",
      hammer_price_gbp: 3200,
      buyers_premium_gbp: 800,
      total_paid_gbp: 4000,
      usd_to_gbp_rate: 0.79,
      image_urls: ["https://placehold.co/200x300/080806/C9A84C?text=12B+RAW"],
      condition_notes: "Unpunched card, slight crease top right",
      grade_subgrades: "",
    },
    {
      capture_date: "2025-03-05",
      sale_date: "2025-02-28",
      source: "Hakes",
      lot_ref: "HK-7734",
      lot_url: "https://hakes.com/example/hk-7734",
      variant_code: "12A-DT",
      grade_tier_code: "AFA-85",
      hammer_price_gbp: 12000,
      buyers_premium_gbp: 3000,
      total_paid_gbp: 15000,
      usd_to_gbp_rate: 0.78,
      image_urls: ["https://placehold.co/200x300/080806/C9A84C?text=12A-DT+AFA85"],
      condition_notes: "Double telescoping, near mint card",
      grade_subgrades: "C85 B90 F85",
    },
  ];

  const { error: insertError } = await supabase.from("lots").insert(seeds);
  if (insertError) throw insertError;
}

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


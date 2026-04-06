import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";

export interface CollectionItem {
  id: string;
  item_id: string;
  description: string;
  category: string;
  grading: string;
  purchase_price: number;
  purchase_date: string;
  purchase_source: string;
  current_estimated_value: number | null;
  notes: string;
  image_urls: string[];
  front_image_url: string;
  back_image_url: string;
  created_at: string;
  updated_at: string;
  estimation_tier: string | null;
}

export const CATEGORIES = [
  "SW-12", "SW-12A", "SW-12A-DT", "SW-12B", "SW-12B-DT", "SW-12C", "SW-12-DT",
  "SW-20", "SW-21",
  "ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48",
  "ROTJ-48", "ROTJ-65", "ROTJ-65A", "ROTJ-65B", "ROTJ-65D", "ROTJ-65-VP", "ROTJ-70", "ROTJ-77", "ROTJ-79", "ROTJ-79A", "ROTJ-79B",
  "POTF-92",
  "CAN", "PAL", "PAL-TL", "MEX", "PBP", "TAK", "TT", "HAR",
  "UNKNOWN",
] as const;

export const GRADINGS = [
  "RAW-NM", "RAW-EX", "RAW-VG",
  "AFA-40", "AFA-50", "AFA-60", "AFA-70", "AFA-75", "AFA-80", "AFA-85", "AFA-90+",
  "UKG-70", "UKG-75", "UKG-80", "UKG-85", "UKG-90",
  "CAS-70", "CAS-75", "CAS-80", "CAS-85",
  "GRADED-UNKNOWN", "UNKNOWN",
] as const;

export const PURCHASE_SOURCES = [
  "eBay", "Heritage", "Hakes", "Vectis", "LCG",
  "Facebook", "Rebel Hideout", "Gilding", "Frontier", "Benji", "Other",
] as const;

export async function getAllCollectionItems(): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from("collection")
    .select("*")
    .order("item_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CollectionItem[];
}

export async function getNextItemId(): Promise<string> {
  const { data, error } = await supabase
    .from("collection")
    .select("item_id")
    .order("item_id", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return "VADER001";
  const last = data[0].item_id;
  const num = parseInt(last.replace("VADER", ""), 10);
  return `VADER${String(num + 1).padStart(3, "0")}`;
}

export async function upsertCollectionItem(
  item: Partial<CollectionItem> & { item_id: string; description: string; category: string; grading: string; purchase_price: number; purchase_date: string; purchase_source: string },
  existingId?: string
) {
  if (existingId) {
    const { error } = await supabase
      .from("collection")
      .update(item as any)
      .eq("id", existingId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("collection")
      .insert(item as any);
    if (error) throw error;
  }
}

export async function deleteCollectionItem(id: string) {
  const { error } = await supabase.from("collection").delete().eq("id", id);
  if (error) throw error;
}

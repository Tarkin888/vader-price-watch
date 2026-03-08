import { supabase } from "@/integrations/supabase/client";

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
}

export const CATEGORIES = [
  "12 BACK", "20 BACK", "21 BACK", "ESB", "ROTJ",
  "SECRET OFFER", "FETT STICKER", "TRILOGO", "OTHER",
] as const;

export const GRADINGS = [
  "Not Graded", "AFA 75", "AFA 80", "AFA 85", "AFA 90+",
  "UKG 80", "UKG 85", "CAS 80", "CAS 85",
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

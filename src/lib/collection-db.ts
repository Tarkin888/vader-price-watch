import { supabase } from "@/integrations/supabase/client";

async function getCurrentUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export interface CollectionItem {
  id: string;
  item_id: string;
  description: string;
  user_id: string;
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
  const userId = await getCurrentUserId();
  if (existingId) {
    // Don't send user_id in update payload
    const { user_id, ...updateData } = item as any;
    const res = await adminWrite({ table: "collection", operation: "update", data: updateData as Record<string, unknown>, match: { column: "id", value: existingId } });
    if (!res.success) throw new Error(res.error);
  } else {
    const itemWithUser = { ...item, user_id: userId };
    const res = await adminWrite({ table: "collection", operation: "insert", data: itemWithUser as Record<string, unknown> });
    if (!res.success) throw new Error(res.error);
  }
}

export async function deleteCollectionItem(id: string) {
  const res = await adminWrite({ table: "collection", operation: "delete", match: { column: "id", value: id } });
  if (!res.success) throw new Error(res.error);
}

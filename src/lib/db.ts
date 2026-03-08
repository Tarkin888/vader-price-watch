import { supabase } from "@/integrations/supabase/client";

export interface Lot {
  id: string;
  capture_date: string;
  sale_date: string;
  source: "Heritage" | "Hakes" | "Vectis" | "LCG";
  lot_ref: string;
  lot_url: string;
  variant_code: "12A" | "12B" | "12C" | "12A-DT" | "12B-DT" | "CAN" | "PAL";
  grade_tier_code: "RAW-NM" | "RAW-EX" | "RAW-VG" | "AFA-70" | "AFA-75" | "AFA-80" | "AFA-85" | "AFA-90+" | "UKG-80" | "UKG-85" | "CAS-80";
  variant_grade_key: string;
  hammer_price_gbp: number;
  buyers_premium_gbp: number;
  total_paid_gbp: number;
  usd_to_gbp_rate: number;
  image_urls: string[];
  condition_notes: string;
  grade_subgrades: string;
  created_at: string;
  updated_at: string;
}

export async function getAllLots(): Promise<Lot[]> {
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Lot[];
}

export async function getLotById(id: string): Promise<Lot | null> {
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Lot | null;
}

export async function addLot(lot: Omit<Lot, "id" | "variant_grade_key" | "created_at" | "updated_at">): Promise<Lot> {
  const { data, error } = await supabase
    .from("lots")
    .insert(lot as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Lot;
}

export async function updateLot(id: string, updates: Partial<Omit<Lot, "id" | "variant_grade_key" | "created_at" | "updated_at">>): Promise<Lot> {
  const { data, error } = await supabase
    .from("lots")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Lot;
}

export async function deleteLot(id: string): Promise<void> {
  const { error } = await supabase
    .from("lots")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

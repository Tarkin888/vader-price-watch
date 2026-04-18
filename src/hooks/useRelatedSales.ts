import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lot } from "@/lib/db";
import type { CollectionItem } from "@/lib/collection-db";

export interface RelatedSalesStats {
  count: number;
  avgTotalPaidGBP: number;
  minTotalPaidGBP: number;
  maxTotalPaidGBP: number;
  latestSaleDate: string | null;
}

export interface UseRelatedSalesResult {
  data: Lot[];
  loading: boolean;
  error: Error | null;
  stats: RelatedSalesStats;
  matchKey: string | null;
}

const EMPTY_STATS: RelatedSalesStats = {
  count: 0,
  avgTotalPaidGBP: 0,
  minTotalPaidGBP: 0,
  maxTotalPaidGBP: 0,
  latestSaleDate: null,
};

// In-memory module-scoped cache to avoid refetches as the user scrolls.
// Keyed by `${cardback}|${variant}|${grade}`.
type CacheEntry = { promise: Promise<Lot[]>; data?: Lot[] };
const cache = new Map<string, CacheEntry>();

function pickField(primary: string | null | undefined, fallback: string | null | undefined): string | null {
  const p = (primary || "").trim();
  if (p && p !== "UNKNOWN") return p;
  const f = (fallback || "").trim();
  if (f && f !== "UNKNOWN") return f;
  return null;
}

/** Resolve the (cardback, variant, grade) triple for an inventory item, with fallbacks. */
export function resolveMatchKeys(item: Pick<CollectionItem, "cardback_code" | "variant_code" | "grade_tier_code" | "category" | "grading">) {
  const cardback = pickField(item.cardback_code, item.category);
  // variant_code defaults to the cardback when not specified (matches the bulk of the lots dataset)
  const variant = pickField(item.variant_code, item.cardback_code) || cardback;
  const grade = pickField(item.grade_tier_code, item.grading);
  return { cardback, variant, grade };
}

function computeStats(lots: Lot[]): RelatedSalesStats {
  if (lots.length === 0) return EMPTY_STATS;
  const prices = lots.map((l) => Number(l.total_paid_gbp) || 0).filter((n) => n > 0);
  const avg = prices.length ? prices.reduce((s, n) => s + n, 0) / prices.length : 0;
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  // lots already sorted DESC by sale_date
  const latest = lots[0]?.sale_date ?? null;
  return {
    count: lots.length,
    avgTotalPaidGBP: avg,
    minTotalPaidGBP: min,
    maxTotalPaidGBP: max,
    latestSaleDate: latest,
  };
}

async function fetchRelated(cardback: string, variant: string, grade: string): Promise<Lot[]> {
  const { data, error } = await supabase
    .from("lots")
    .select("*")
    .eq("cardback_code", cardback)
    .eq("variant_code", variant as any) // variant_code is an enum in the DB
    .eq("grade_tier_code", grade as any)
    .order("sale_date", { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data ?? []) as Lot[];
}

export function useRelatedSales(item: Pick<CollectionItem, "cardback_code" | "variant_code" | "grade_tier_code" | "category" | "grading">): UseRelatedSalesResult {
  const { cardback, variant, grade } = resolveMatchKeys(item);
  const matchKey = cardback && variant && grade ? `${cardback}|${variant}|${grade}` : null;

  const [data, setData] = useState<Lot[]>(() => {
    if (matchKey) {
      const cached = cache.get(matchKey);
      if (cached?.data) return cached.data;
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!matchKey) return false;
    const cached = cache.get(matchKey);
    return !cached?.data;
  });
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchKey || !cardback || !variant || !grade) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const cached = cache.get(matchKey);

    if (cached?.data) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const promise =
      cached?.promise ??
      fetchRelated(cardback, variant, grade).then((rows) => {
        const entry = cache.get(matchKey);
        if (entry) entry.data = rows;
        return rows;
      });

    if (!cached) cache.set(matchKey, { promise });

    promise
      .then((rows) => {
        if (cancelled) return;
        setData(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        // Clear failed cache entry so a retry can refetch
        cache.delete(matchKey);
      });

    return () => {
      cancelled = true;
    };
  }, [matchKey, cardback, variant, grade]);

  return {
    data,
    loading,
    error,
    stats: computeStats(data),
    matchKey,
  };
}

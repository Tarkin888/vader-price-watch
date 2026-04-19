import { useQuery } from "@tanstack/react-query";
import { adminRead } from "@/lib/admin-read";

export type Freshness = "green" | "amber" | "red";

export interface FreshnessEntry {
  source: string;
  lastSuccessAt: string | null;
  daysSince: number | null;
  level: Freshness;
}

const computeLevel = (daysSince: number | null): Freshness => {
  if (daysSince == null) return "red";
  if (daysSince < 7) return "green";
  if (daysSince <= 14) return "amber";
  return "red";
};

/**
 * Returns latest successful scraper run per source, keyed by source name.
 * Reads from scraper_logs (same data source as the Admin Scrapers tab).
 * Cached for 60s via React Query. Read-only.
 */
export const useScraperFreshness = (sources: string[]) => {
  return useQuery({
    queryKey: ["scraper-freshness", sources.join(",")],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Record<string, FreshnessEntry>> => {
      // Single round-trip: pull recent successful logs and reduce client-side.
      const { data } = await adminRead({
        table: "scraper_logs",
        filters: { status: "SUCCESS" },
        order_by: "started_at",
        order_asc: false,
        limit: 200,
      });

      const rows = (data ?? []) as Array<{ source: string; started_at: string | null; created_at: string | null }>;
      const latest: Record<string, string> = {};
      for (const r of rows) {
        const ts = r.started_at ?? r.created_at;
        if (!ts) continue;
        if (!latest[r.source] || new Date(ts) > new Date(latest[r.source])) {
          latest[r.source] = ts;
        }
      }

      const now = Date.now();
      const out: Record<string, FreshnessEntry> = {};
      for (const src of sources) {
        const ts = latest[src] ?? null;
        const days = ts ? Math.floor((now - new Date(ts).getTime()) / 86_400_000) : null;
        out[src] = { source: src, lastSuccessAt: ts, daysSince: days, level: computeLevel(days) };
      }
      return out;
    },
  });
};

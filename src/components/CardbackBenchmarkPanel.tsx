import { useState, useMemo } from "react";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";

interface Props {
  allLots: Lot[];
  currency: Currency;
  onSelectCardback: (code: string) => void;
  alwaysExpanded?: boolean;
}

const ERA_ORDER = ["SW", "ESB", "ROTJ", "POTF"] as const;

const ERA_BADGE_COLORS: Record<string, string> = {
  SW: "#4a7fa5",
  ESB: "#a04040",
  ROTJ: "#3a7a4a",
  POTF: "#C9A84C",
};

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function toUsd(gbp: number, rate: number): number {
  return rate > 0 ? Math.round(gbp / rate) : 0;
}

function fmtPrice(n: number, isUSD: boolean): string {
  if (isUSD) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CardData {
  code: string;
  era: string;
  count: number;
  medianGBP: number;
  p25GBP: number;
  p75GBP: number;
  highestGBP: number;
  highestGrade: string;
  highestDate: string;
  mostRecentDate: string;
  lots: Lot[];
}

const MIN_RECORDS = 3;

const CardbackBenchmarkPanel = ({ allLots, currency, onSelectCardback, alwaysExpanded = false }: Props) => {
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const isUSD = currency === "USD";

  const cards = useMemo(() => {
    const byCode = new Map<string, Lot[]>();
    allLots.forEach((l) => {
      const code = (l as any).cardback_code || "UNKNOWN";
      if (code === "UNKNOWN") return;
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code)!.push(l);
    });

    const result: CardData[] = [];
    byCode.forEach((lots, code) => {
      if (lots.length < MIN_RECORDS) return;

      const prices = lots.map((l) => Number(l.total_paid_gbp));
      const sorted = [...lots].sort(
        (a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
      );
      const highest = lots.reduce((best, l) =>
        Number(l.total_paid_gbp) > Number(best.total_paid_gbp) ? l : best
      );

      result.push({
        code,
        era: (lots[0] as any).era ?? "UNKNOWN",
        count: lots.length,
        medianGBP: median(prices),
        p25GBP: percentile(prices, 25),
        p75GBP: percentile(prices, 75),
        highestGBP: Number(highest.total_paid_gbp),
        highestGrade: highest.grade_tier_code,
        highestDate: highest.sale_date,
        mostRecentDate: sorted[0].sale_date,
        lots,
      });
    });

    // Sort by era order, then cardback number
    result.sort((a, b) => {
      const eraA = ERA_ORDER.indexOf(a.era as any);
      const eraB = ERA_ORDER.indexOf(b.era as any);
      const ea = eraA === -1 ? 99 : eraA;
      const eb = eraB === -1 ? 99 : eraB;
      if (ea !== eb) return ea - eb;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });

    return result;
  }, [allLots]);

  const convertPrice = (gbp: number, lotsForAvgRate: Lot[]) => {
    if (!isUSD) return gbp;
    // Use average rate from the lot group
    const rates = lotsForAvgRate.map((l) => Number(l.usd_to_gbp_rate)).filter((r) => r > 0);
    const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 1;
    return toUsd(gbp, avgRate);
  };

  const isOpen = alwaysExpanded || expanded;

  return (
    <div className={alwaysExpanded ? "" : "border-b border-border"}>
      {!alwaysExpanded && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-6 py-2 text-left text-[10px] tracking-widest hover:text-primary transition-colors flex items-center gap-2"
          style={{ color: "#e0d8c0" }}
        >
          <span className="text-primary">{expanded ? "▼" : "▶"}</span>
          {expanded ? "Hide Benchmark Panel" : "Show Benchmark Panel"}
          <span className="text-muted-foreground ml-2">({cards.length} cardbacks)</span>
        </button>
      )}

      {isOpen && (
        <div className="px-6 pb-4">
          {cards.length === 0 ? (
            <div className="text-muted-foreground text-xs tracking-wider py-4">
              No cardback codes with {MIN_RECORDS}+ records found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {cards.map((card) => {
                const bgEra = ERA_BADGE_COLORS[card.era] ?? "#555";
                const med = convertPrice(card.medianGBP, card.lots);
                const p25 = convertPrice(card.p25GBP, card.lots);
                const p75 = convertPrice(card.p75GBP, card.lots);
                const high = convertPrice(card.highestGBP, card.lots);

                // Range bar: scale p25–p75 relative to 0–high
                const barMax = high > 0 ? high : 1;
                const barLeft = (p25 / barMax) * 100;
                const barWidth = Math.max(((p75 - p25) / barMax) * 100, 2);

                return (
                  <button
                    key={card.code}
                    onClick={() => onSelectCardback(card.code)}
                    className="text-left p-3 rounded border transition-colors hover:border-primary/80 focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      backgroundColor: "#111109",
                      borderColor: "#C9A84C",
                      borderWidth: "1px",
                      fontFamily: "'Aptos', sans-serif",
                      color: "#e0d8c0",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold tracking-widest">{card.code}</span>
                      <span
                        className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: bgEra, color: "#fff" }}
                      >
                        {card.era}
                      </span>
                    </div>

                    {/* Sample size */}
                    <div className="text-[9px] text-muted-foreground tracking-wider mb-2">
                      n={card.count} sales
                    </div>

                    {/* Median */}
                    <div className="flex justify-between text-[10px] tracking-wider mb-1">
                      <span className="text-muted-foreground">MEDIAN</span>
                      <span className="text-primary font-bold">{fmtPrice(med, isUSD)}</span>
                    </div>

                    {/* P25–P75 range bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[8px] text-muted-foreground tracking-wider mb-0.5">
                        <span>P25: {fmtPrice(p25, isUSD)}</span>
                        <span>P75: {fmtPrice(p75, isUSD)}</span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="absolute h-full rounded-full bg-primary/60"
                          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        />
                      </div>
                    </div>

                    {/* Highest */}
                    <div className="flex justify-between text-[10px] tracking-wider mb-1">
                      <span className="text-muted-foreground">HIGH</span>
                      <span className="text-primary font-bold">{fmtPrice(high, isUSD)}</span>
                    </div>
                    <div className="text-[8px] text-muted-foreground tracking-wider mb-1.5">
                      {card.highestGrade} • {card.highestDate}
                    </div>

                    {/* Most recent */}
                    <div className="flex justify-between text-[9px] tracking-wider">
                      <span className="text-muted-foreground">LATEST</span>
                      <span>{card.mostRecentDate}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CardbackBenchmarkPanel;

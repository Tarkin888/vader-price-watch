import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(50, 14%, 6%)",
  border: "1px solid hsl(43, 20%, 18%)",
  color: "hsl(40, 30%, 82%)",
  fontSize: 11,
  fontFamily: "'Aptos', sans-serif",
};

const ERA_COLORS: Record<string, string> = {
  SW: "hsl(210, 35%, 47%)",
  ESB: "hsl(40, 12%, 49%)",
  ROTJ: "hsl(0, 43%, 44%)",
  POTF: "hsl(45, 50%, 54%)",
};
const ERAS_ORDER = ["SW", "ESB", "ROTJ", "POTF"] as const;

interface Props {
  lots: Lot[];
  allLots?: Lot[];
  currency?: Currency;
}

function calcEraStats(items: Lot[], isUSD: boolean) {
  const priced = items.filter((l) => (l as any).price_status !== "ESTIMATE_ONLY" && Number(l.total_paid_gbp) > 0);
  const prices = priced.map((l) => {
    const gbp = Number(l.total_paid_gbp);
    if (!isUSD) return gbp;
    const rate = Number(l.usd_to_gbp_rate);
    return rate > 0 ? Math.round(gbp / rate) : 0;
  });
  return {
    count: items.length,
    avg: prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0,
    max: prices.length > 0 ? Math.max(...prices) : 0,
  };
}

const fmtPrice = (n: number, isUSD: boolean) =>
  isUSD ? `$${Math.round(n).toLocaleString("en-US")}` : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SummaryDashboard = ({ lots, allLots, currency = "GBP" }: Props) => {
  const isUSD = currency === "USD";
  const sym = isUSD ? "$" : "£";

  // Defer chart rendering by one frame so ResponsiveContainer can measure its parent
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => { cancelAnimationFrame(id); setChartsReady(false); };
  }, []);

  const eraGroups = useMemo(() =>
    ERAS_ORDER.map((era) => ({
      era,
      lots: lots.filter((l) => l.era === era),
    })).filter((g) => g.lots.length > 0),
  [lots]);

  const SOURCE_DISPLAY: Record<string, string> = { Heritage: "Heritage", Hakes: "Hake's", Vectis: "Vectis", LCG: "LCG", CandT: "C&T" };

  const bySource = useMemo(() => {
    const map: Record<string, number> = {};
    lots.forEach((l) => { map[l.source] = (map[l.source] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name: SOURCE_DISPLAY[name] || name, count })).sort((a, b) => b.count - a.count);
  }, [lots]);

  const byVariant = useMemo(() => {
    const map: Record<string, number> = {};
    lots.forEach((l) => { map[l.variant_code] = (map[l.variant_code] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.length > 10 ? name.slice(0, 10) + "…" : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [lots]);

  const avgByGrade = useMemo(() => {
    const map: Record<string, { sum: number; count: number; rates: number[] }> = {};
    lots.forEach((l) => {
      if (!map[l.grade_tier_code]) map[l.grade_tier_code] = { sum: 0, count: 0, rates: [] };
      const gbp = Number(l.total_paid_gbp);
      if (isUSD) {
        const rate = Number(l.usd_to_gbp_rate);
        map[l.grade_tier_code].sum += rate > 0 ? Math.round(gbp / rate) : 0;
      } else {
        map[l.grade_tier_code].sum += gbp;
      }
      map[l.grade_tier_code].count += 1;
    });
    return Object.entries(map)
      .map(([name, { sum, count }]) => ({ name, avg: Math.round(sum / count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [lots, isUSD]);

  const fmt = (n: number) => fmtPrice(n, isUSD);

  return (
    <div className="px-6 py-4 space-y-6">
      {/* Era summary cards */}
      <div className="flex flex-wrap gap-2">
        {eraGroups.map(({ era, lots: eraLots }) => {
          const stats = calcEraStats(eraLots, isUSD);
          const color = ERA_COLORS[era] ?? "hsl(0, 0%, 33%)";
          return (
            <div
              key={era}
              className="border border-border rounded px-3 py-1.5 min-w-[150px] bg-secondary/50"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: color, color: "#fff" }}
                >
                  {era}
                </span>
                <span className="text-[10px] text-muted-foreground tracking-wider">
                  {stats.count} records
                </span>
              </div>
              <div className="flex gap-3 text-[10px] tracking-wider">
                <span>
                  <span className="text-muted-foreground">Avg </span>
                  <span className="text-primary font-bold">{fmt(stats.avg)}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">High </span>
                  <span className="text-primary font-bold">{fmt(stats.max)}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-xs tracking-wider">
        <div>
          <span className="text-muted-foreground">Total Records: </span>
          <span className="text-primary font-bold">{lots.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Sources: </span>
          <span className="text-primary font-bold">{bySource.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Variants: </span>
          <span className="text-primary font-bold">{byVariant.length}</span>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-border p-3" style={{ height: 300 }}>
          <div className="text-[10px] text-muted-foreground tracking-wider font-medium mb-2">Records by Source</div>
          {chartsReady && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bySource} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 50%, 54%, 0.1)" />
                <XAxis type="number" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 9, fill: "hsl(40, 15%, 50%)" }} />
                <YAxis dataKey="name" type="category" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 9, fill: "hsl(40, 15%, 50%)" }} width={60} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="hsl(43, 50%, 54%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-border p-3" style={{ height: 300 }}>
          <div className="text-[10px] text-muted-foreground tracking-wider font-medium mb-2">Records by Variant (top 8)</div>
          {chartsReady && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byVariant} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 50%, 54%, 0.1)" />
                <XAxis type="number" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 9, fill: "hsl(40, 15%, 50%)" }} />
                <YAxis dataKey="name" type="category" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 9, fill: "hsl(40, 15%, 50%)" }} width={80} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="hsl(20, 60%, 55%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-border p-3" style={{ height: 300 }}>
          <div className="text-[10px] text-muted-foreground tracking-wider font-medium mb-2">Avg Price by Grade</div>
          {chartsReady && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={avgByGrade} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 50%, 54%, 0.1)" />
                <XAxis type="number" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 9, fill: "hsl(40, 15%, 50%)" }} tickFormatter={(v) => `${sym}${v.toLocaleString()}`} />
                <YAxis dataKey="name" type="category" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 9, fill: "hsl(40, 15%, 50%)" }} width={100} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), "Avg"]} />
                <Bar dataKey="avg" fill="hsl(140, 45%, 50%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryDashboard;

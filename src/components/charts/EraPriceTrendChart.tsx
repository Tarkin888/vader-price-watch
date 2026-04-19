import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Lot } from "@/lib/db";

interface Props {
  lots: Lot[];
  currency: "GBP" | "USD";
}

const ERA_COLORS: Record<string, string> = {
  SW: "#C9A84C",
  ESB: "#7FB3D5",
  ROTJ: "#E07B39",
  POTF: "#A569BD",
};

// Tailwind-derived palette for cardback split
const CARDBACK_PALETTE = [
  "#C9A84C", "#7FB3D5", "#E07B39", "#A569BD",
  "#5BA55B", "#D45D7E", "#4DB6AC", "#F1C40F",
  "#9B59B6", "#3498DB", "#E67E22", "#16A085",
  "#E74C3C", "#1ABC9C", "#F39C12", "#8E44AD",
];

type SplitMode = "era" | "cardback";

const fmtMonth = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const EraPriceTrendChart = ({ lots, currency }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>("era");

  const isUSD = currency === "USD";
  const fmtPrice = (n: number) =>
    isUSD ? `$${Math.round(n).toLocaleString("en-US")}` : `£${Math.round(n).toLocaleString("en-GB")}`;

  const { chartData, seriesKeys, seriesColors, totalPoints } = useMemo(() => {
    const priced = lots.filter(
      (l) =>
        (l as any).price_status !== "ESTIMATE_ONLY" &&
        Number(l.total_paid_gbp) > 0 &&
        l.sale_date,
    );

    // Group: { monthKey: { __label, __ts, [seriesKey]: avgPrice } }
    const buckets: Record<string, { __label: string; __ts: number; sums: Record<string, number>; counts: Record<string, number> }> = {};

    const seriesSet = new Set<string>();
    const seriesPointCount: Record<string, number> = {};

    for (const l of priced) {
      const key =
        splitMode === "era"
          ? ((l as any).era as string) || "UNKNOWN"
          : ((l as any).cardback_code as string) || "UNKNOWN";
      if (key === "UNKNOWN") continue;
      if (splitMode === "era" && !ERA_COLORS[key]) continue; // only the 4 spec'd eras

      const mk = monthKey(l.sale_date);
      if (!buckets[mk]) {
        const d = new Date(l.sale_date);
        const first = new Date(d.getFullYear(), d.getMonth(), 1);
        buckets[mk] = { __label: fmtMonth(first.toISOString()), __ts: first.getTime(), sums: {}, counts: {} };
      }
      const gbp = Number(l.total_paid_gbp);
      const value = isUSD ? (Number(l.usd_to_gbp_rate) > 0 ? gbp / Number(l.usd_to_gbp_rate) : gbp) : gbp;
      buckets[mk].sums[key] = (buckets[mk].sums[key] ?? 0) + value;
      buckets[mk].counts[key] = (buckets[mk].counts[key] ?? 0) + 1;
      seriesSet.add(key);
    }

    // Build per-month rows with averaged prices
    const rows = Object.values(buckets)
      .sort((a, b) => a.__ts - b.__ts)
      .map((b) => {
        const row: Record<string, any> = { label: b.__label, ts: b.__ts };
        for (const k of Object.keys(b.sums)) {
          row[k] = Math.round(b.sums[k] / b.counts[k]);
          seriesPointCount[k] = (seriesPointCount[k] ?? 0) + 1;
        }
        return row;
      });

    // Drop series with < 2 points
    const validSeries = [...seriesSet].filter((k) => (seriesPointCount[k] ?? 0) >= 2);

    // Order: spec order for eras, otherwise alphabetical
    const ordered =
      splitMode === "era"
        ? ["SW", "ESB", "ROTJ", "POTF"].filter((e) => validSeries.includes(e))
        : validSeries.sort();

    // Colour map
    const colors: Record<string, string> = {};
    if (splitMode === "era") {
      for (const e of ordered) colors[e] = ERA_COLORS[e];
    } else {
      ordered.forEach((k, i) => {
        colors[k] = CARDBACK_PALETTE[i % CARDBACK_PALETTE.length];
      });
    }

    const total = ordered.reduce((sum, k) => sum + (seriesPointCount[k] ?? 0), 0);

    return { chartData: rows, seriesKeys: ordered, seriesColors: colors, totalPoints: total };
  }, [lots, splitMode, isUSD]);

  return (
    <div className="border-b border-border bg-card/30">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 md:px-6 py-2.5 text-left hover:bg-card/60 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "#C9A84C" }} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" style={{ color: "#C9A84C" }} />
          )}
          <span className="text-[11px] tracking-wider font-bold" style={{ color: "#C9A84C", fontFamily: "'Courier New', monospace" }}>
            PRICE TREND — {lots.length} RECORDS
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 md:px-6 pb-4 pt-2">
          {/* Split toggle */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.6)", fontFamily: "'Courier New', monospace" }}>
              SPLIT BY:
            </span>
            <div className="flex items-center border border-border rounded overflow-hidden">
              {(["era", "cardback"] as SplitMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSplitMode(mode)}
                  className="text-[10px] tracking-wider px-3 py-1 transition-colors"
                  style={{
                    background: splitMode === mode ? "rgba(201,168,76,0.15)" : "transparent",
                    color: splitMode === mode ? "#C9A84C" : "rgba(224,216,192,0.5)",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {mode === "era" ? "Era" : "Cardback Code"}
                </button>
              ))}
            </div>
          </div>

          {totalPoints < 2 || seriesKeys.length === 0 ? (
            <p className="italic text-[12px] py-8 text-center" style={{ color: "#a39580" }}>
              Not enough data to chart — adjust filters
            </p>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(201,168,76,0.1)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#a39580", fontSize: 10, fontFamily: "'Courier New', monospace" }}
                    stroke="rgba(201,168,76,0.3)"
                  />
                  <YAxis
                    tick={{ fill: "#a39580", fontSize: 10, fontFamily: "'Courier New', monospace" }}
                    stroke="rgba(201,168,76,0.3)"
                    tickFormatter={(v) => fmtPrice(v as number)}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#080806",
                      border: "1px solid #C9A84C",
                      color: "#e0d8c0",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 11,
                    }}
                    formatter={(v: number, name: string) => [fmtPrice(v), name]}
                  />
                  <Legend
                    wrapperStyle={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#e0d8c0" }}
                  />
                  {seriesKeys.map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={seriesColors[k]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: seriesColors[k] }}
                      activeDot={{ r: 5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EraPriceTrendChart;

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
  ZAxis,
} from "recharts";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";

const ERA_COLORS: Record<string, string> = {
  SW: "#4a9eff",
  ESB: "#ff4a4a",
  ROTJ: "#4aff7a",
  POTF: "#C9A84C",
};

const ERAS = ["SW", "ESB", "ROTJ", "POTF"] as const;

type DateRange = "12m" | "24m" | "all";

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(50, 14%, 6%)",
  border: "1px solid hsl(43, 20%, 18%)",
  color: "hsl(40, 30%, 82%)",
  fontSize: 11,
  fontFamily: "'Aptos', sans-serif",
};

const FONT_AXIS = { fontSize: 10, fill: "hsl(40, 15%, 50%)", fontFamily: "'Aptos', sans-serif" };

function toPrice(gbp: number, rate: number, currency: Currency): number {
  return currency === "USD" ? (rate > 0 ? Math.round(gbp / rate) : 0) : Number(gbp);
}

function fmtPrice(v: number, c: Currency) {
  return c === "USD" ? `$${v.toLocaleString()}` : `£${v.toLocaleString()}`;
}

function linearRegression(points: { x: number; y: number }[]) {
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface DotPayload {
  dateNum: number;
  price: number;
  era: string;
  sale_date: string;
  source: string;
  cardback_code: string;
  grade_tier_code: string;
  total_paid_gbp: number;
  lot_ref: string;
  usd_to_gbp_rate: number;
}

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload?.length) return null;
  const d: DotPayload = payload[0]?.payload;
  if (!d) return null;
  const price = toPrice(Number(d.total_paid_gbp), Number(d.usd_to_gbp_rate), currency);
  return (
    <div style={TOOLTIP_STYLE} className="p-2 rounded text-xs space-y-0.5">
      <div className="font-bold" style={{ color: ERA_COLORS[d.era] }}>{d.era}</div>
      <div>Date: {d.sale_date}</div>
      <div>Source: {d.source}</div>
      <div>Cardback: {d.cardback_code}</div>
      <div>Grade: {d.grade_tier_code}</div>
      <div>Total: {fmtPrice(price, currency)}</div>
      <div>Ref: {d.lot_ref}</div>
    </div>
  );
};

interface Props {
  lots: Lot[];
  currency: Currency;
}

const ScatterChartPanel = ({ lots, currency }: Props) => {
  const [enabledEras, setEnabledEras] = useState<Set<string>>(new Set(ERAS));
  const [cardbackFilter, setCardbackFilter] = useState<string>("ALL");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [showTrend, setShowTrend] = useState(false);

  const toggleEra = (era: string) => {
    setEnabledEras((prev) => {
      const next = new Set(prev);
      next.has(era) ? next.delete(era) : next.add(era);
      return next;
    });
  };

  const cardbacks = useMemo(() => [...new Set(lots.map((l) => l.cardback_code))].sort(), [lots]);
  const grades = useMemo(() => [...new Set(lots.map((l) => l.grade_tier_code))].sort(), [lots]);

  const cutoffDate = useMemo(() => {
    if (dateRange === "all") return 0;
    const now = new Date();
    const months = dateRange === "12m" ? 12 : 24;
    return new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).getTime();
  }, [dateRange]);

  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      if (!enabledEras.has(l.era)) return false;
      if (cardbackFilter !== "ALL" && l.cardback_code !== cardbackFilter) return false;
      if (gradeFilter !== "ALL" && l.grade_tier_code !== gradeFilter) return false;
      if (cutoffDate > 0 && new Date(l.sale_date).getTime() < cutoffDate) return false;
      return true;
    });
  }, [lots, enabledEras, cardbackFilter, gradeFilter, cutoffDate]);

  const eraData = useMemo(() => {
    const map: Record<string, DotPayload[]> = {};
    for (const era of ERAS) map[era] = [];
    for (const l of filteredLots) {
      if (!map[l.era]) continue;
      map[l.era].push({
        dateNum: new Date(l.sale_date).getTime(),
        price: toPrice(Number(l.total_paid_gbp), Number(l.usd_to_gbp_rate), currency),
        era: l.era,
        sale_date: l.sale_date,
        source: l.source,
        cardback_code: l.cardback_code,
        grade_tier_code: l.grade_tier_code,
        total_paid_gbp: Number(l.total_paid_gbp),
        lot_ref: l.lot_ref,
        usd_to_gbp_rate: Number(l.usd_to_gbp_rate),
      });
    }
    return map;
  }, [filteredLots, currency]);

  // Trend lines as data points for ComposedChart
  const trendLines = useMemo(() => {
    if (!showTrend) return {};
    const result: Record<string, { x: number; y: number }[]> = {};
    for (const era of ERAS) {
      const pts = eraData[era];
      if (pts.length < 2) continue;
      const reg = linearRegression(pts.map((p) => ({ x: p.dateNum, y: p.price })));
      if (!reg) continue;
      const sorted = [...pts].sort((a, b) => a.dateNum - b.dateNum);
      const minX = sorted[0].dateNum;
      const maxX = sorted[sorted.length - 1].dateNum;
      result[era] = [
        { x: minX, y: reg.slope * minX + reg.intercept },
        { x: maxX, y: reg.slope * maxX + reg.intercept },
      ];
    }
    return result;
  }, [showTrend, eraData]);

  // Summary table
  const summaryRows = useMemo(() => {
    return ERAS.filter((e) => enabledEras.has(e)).map((era) => {
      const pts = eraData[era];
      const count = pts.length;
      const prices = pts.map((p) => p.price);
      const med = median(prices);
      // Trend: compare avg of newest 25% vs oldest 25%
      let trend: "↑" | "↓" | "→" = "→";
      if (count >= 4) {
        const sorted = [...pts].sort((a, b) => a.dateNum - b.dateNum);
        const q = Math.max(1, Math.floor(count * 0.25));
        const oldAvg = sorted.slice(0, q).reduce((s, p) => s + p.price, 0) / q;
        const newAvg = sorted.slice(-q).reduce((s, p) => s + p.price, 0) / q;
        const diff = (newAvg - oldAvg) / (oldAvg || 1);
        trend = diff > 0.05 ? "↑" : diff < -0.05 ? "↓" : "→";
      }
      return { era, count, med, trend };
    });
  }, [eraData, enabledEras]);

  const sym = currency === "USD" ? "$" : "£";

  // Combine all scatter data for ComposedChart
  const allPoints = useMemo(() => {
    const result: (DotPayload & { eraColor: string })[] = [];
    for (const era of ERAS) {
      if (!enabledEras.has(era)) continue;
      for (const p of eraData[era]) {
        result.push({ ...p, eraColor: ERA_COLORS[era] });
      }
    }
    return result;
  }, [eraData, enabledEras]);

  return (
    <div className="border-b border-border px-6 py-4 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] tracking-widest">
        {/* Era toggles */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">ERA:</span>
          {ERAS.map((e) => (
            <label key={e} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledEras.has(e)}
                onChange={() => toggleEra(e)}
                className="accent-primary w-3 h-3"
              />
              <span style={{ color: ERA_COLORS[e] }}>{e}</span>
            </label>
          ))}
        </div>

        {/* Cardback filter */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">CARDBACK:</span>
          <select
            value={cardbackFilter}
            onChange={(e) => setCardbackFilter(e.target.value)}
            className="bg-[hsl(50,14%,6%)] border border-border text-foreground px-1 py-0.5 text-[10px] rounded"
          >
            <option value="ALL">All</option>
            {cardbacks.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Grade filter */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">GRADE:</span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="bg-[hsl(50,14%,6%)] border border-border text-foreground px-1 py-0.5 text-[10px] rounded"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            <option value="ALL">All</option>
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Trend line toggle */}
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrend}
            onChange={() => setShowTrend(!showTrend)}
            className="accent-primary w-3 h-3"
          />
          <span className="text-muted-foreground">TREND LINE</span>
        </label>

        {/* Date range */}
        <div className="flex items-center gap-1">
          {(["12m", "24m", "all"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-2 py-0.5 transition-colors ${dateRange === r ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              {r === "12m" ? "12M" : r === "24m" ? "24M" : "ALL"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {allPoints.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-[10px] tracking-widest">
          NO DATA FOR SELECTED FILTERS
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 18%)" />
            <XAxis
              dataKey="dateNum"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="hsl(40, 15%, 50%)"
              tick={FONT_AXIS}
              tickFormatter={(v) => new Date(v).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
              name="Date"
            />
            <YAxis
              dataKey="price"
              type="number"
              stroke="hsl(40, 15%, 50%)"
              tick={FONT_AXIS}
              tickFormatter={(v) => `${sym}${v.toLocaleString()}`}
              name="Total Paid"
            />
            <ZAxis range={[110, 110]} />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "'Courier New', monospace" }}
              payload={ERAS.filter((e) => enabledEras.has(e)).map((e) => ({
                value: e,
                type: "circle" as const,
                color: ERA_COLORS[e],
              }))}
            />
            {ERAS.filter((e) => enabledEras.has(e)).map((era) => (
              <Scatter
                key={era}
                name={era}
                data={eraData[era]}
                fill={ERA_COLORS[era]}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Trend lines rendered as SVG overlay — simpler approach: use a separate mini chart */}
      {showTrend && Object.keys(trendLines).length > 0 && allPoints.length > 0 && (
        <div className="text-[9px] text-muted-foreground tracking-widest pl-12">
          TREND LINES ACTIVE — {Object.keys(trendLines).map((e) => {
            const tl = trendLines[e];
            if (!tl || tl.length < 2) return null;
            const slope = tl[1].y - tl[0].y;
            return (
              <span key={e} className="mr-3" style={{ color: ERA_COLORS[e] }}>
                {e}: {fmtPrice(Math.round(tl[0].y), currency)} → {fmtPrice(Math.round(tl[1].y), currency)}
                {slope > 0 ? " ↑" : slope < 0 ? " ↓" : " →"}
              </span>
            );
          })}
        </div>
      )}

      {/* Summary table */}
      {summaryRows.length > 0 && (
        <table className="w-full text-[10px] tracking-widest border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1 px-2">ERA</th>
              <th className="text-right py-1 px-2">RECORDS</th>
              <th className="text-right py-1 px-2">MEDIAN ({currency})</th>
              <th className="text-center py-1 px-2">TREND</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((r) => (
              <tr key={r.era} className="border-b border-border/50">
                <td className="py-1 px-2 font-bold" style={{ color: ERA_COLORS[r.era] }}>{r.era}</td>
                <td className="text-right py-1 px-2 text-foreground">{r.count}</td>
                <td className="text-right py-1 px-2 text-foreground">{fmtPrice(Math.round(r.med), currency)}</td>
                <td className="text-center py-1 px-2 text-lg">
                  <span style={{ color: r.trend === "↑" ? "#4aff7a" : r.trend === "↓" ? "#ff4a4a" : "hsl(40, 15%, 50%)" }}>
                    {r.trend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScatterChartPanel;

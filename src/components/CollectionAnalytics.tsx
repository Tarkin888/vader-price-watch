import { useMemo } from "react";
import type { CollectionItem } from "@/lib/collection-db";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  ComposedChart,
} from "recharts";

const GOLD = "hsl(43, 50%, 54%)";
const GOLD_DIM = "hsl(43, 30%, 35%)";
const MUTED = "hsl(40, 15%, 50%)";
const GREEN = "hsl(142, 60%, 45%)";
const RED = "hsl(0, 62%, 50%)";
const WHITE = "hsl(40, 30%, 82%)";
const BG_CARD = "hsl(50, 14%, 6%)";

const GRADE_COLORS: Record<string, string> = {
  "AFA 80": GOLD,
  "AFA 75": "hsl(35, 60%, 50%)",
  "AFA 85": "hsl(43, 60%, 60%)",
  "AFA 90+": "hsl(50, 70%, 65%)",
  "CAS 85": "hsl(175, 40%, 45%)",
  "CAS 80": "hsl(210, 30%, 50%)",
  "UKG 80": "hsl(200, 35%, 45%)",
  "UKG 85": "hsl(190, 40%, 50%)",
  "Not Graded": "hsl(40, 10%, 40%)",
};

const CATEGORY_COLORS = [
  GOLD, "hsl(35, 50%, 45%)", "hsl(25, 45%, 40%)", "hsl(175, 35%, 40%)",
  "hsl(210, 30%, 45%)", "hsl(0, 40%, 45%)", "hsl(280, 30%, 45%)",
  "hsl(50, 40%, 55%)", "hsl(150, 25%, 40%)",
];

const fmt = (n: number) => `£${n.toLocaleString("en-GB")}`;
const fmtK = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${n}`;

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] tracking-wider text-primary mb-3 font-medium">{children}</h3>
);

const ChartTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] tracking-wider text-primary/80 mb-2 font-medium">{children}</div>
);

const NoData = ({ name }: { name: string }) => (
  <div className="border border-border rounded p-6 text-center text-muted-foreground text-xs tracking-wider">
    {name} — not enough data yet. Add more items to unlock.
  </div>
);

interface Props {
  items: CollectionItem[];
}

export default function CollectionAnalytics({ items }: Props) {
  // ── Computed data ──
  const totalCost = useMemo(() => items.reduce((s, i) => s + Number(i.purchase_price), 0), [items]);
  const portfolioValue = useMemo(() => items.reduce((s, i) => s + Number(i.current_estimated_value ?? i.purchase_price), 0), [items]);
  const unrealisedPnl = portfolioValue - totalCost;
  const unrealisedPct = totalCost > 0 ? ((unrealisedPnl / totalCost) * 100).toFixed(1) : "0";

  const avgPrice = items.length > 0 ? totalCost / items.length : 0;
  const medianPrice = useMemo(() => {
    if (items.length === 0) return 0;
    const sorted = [...items].map(i => Number(i.purchase_price)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [items]);

  const graded = useMemo(() => items.filter(i => i.grading !== "Not Graded"), [items]);
  const ungraded = useMemo(() => items.filter(i => i.grading === "Not Graded"), [items]);
  const gradedAvg = graded.length > 0 ? graded.reduce((s, i) => s + Number(i.purchase_price), 0) / graded.length : 0;
  const ungradedAvg = ungraded.length > 0 ? ungraded.reduce((s, i) => s + Number(i.purchase_price), 0) / ungraded.length : 0;
  const gradedPremium = ungradedAvg > 0 ? (gradedAvg / ungradedAvg).toFixed(1) : "N/A";

  const distinctCategories = useMemo(() => new Set(items.map(i => i.category)).size, [items]);

  const yearRange = useMemo(() => {
    if (items.length === 0) return { min: 0, max: 0 };
    const years = items.map(i => new Date(i.purchase_date).getFullYear());
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [items]);

  const mostActiveYear = useMemo(() => {
    const map: Record<number, { count: number; spend: number }> = {};
    items.forEach(i => {
      const y = new Date(i.purchase_date).getFullYear();
      if (!map[y]) map[y] = { count: 0, spend: 0 };
      map[y].count++;
      map[y].spend += Number(i.purchase_price);
    });
    let best = { year: 0, count: 0, spend: 0 };
    Object.entries(map).forEach(([y, v]) => {
      if (v.count > best.count || (v.count === best.count && v.spend > best.spend)) {
        best = { year: Number(y), ...v };
      }
    });
    return best;
  }, [items]);

  // ── Section 2: Donut by Category ──
  const spendByCategory = useMemo(() => {
    const map: Record<string, { spend: number; count: number }> = {};
    items.forEach(i => {
      if (!map[i.category]) map[i.category] = { spend: 0, count: 0 };
      map[i.category].spend += Number(i.purchase_price);
      map[i.category].count++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, pct: totalCost > 0 ? ((v.spend / totalCost) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.spend - a.spend);
  }, [items, totalCost]);

  // ── Section 2: Grade tier bars ──
  const spendByGrade = useMemo(() => {
    const map: Record<string, { spend: number; count: number }> = {};
    items.forEach(i => {
      if (!map[i.grading]) map[i.grading] = { spend: 0, count: 0 };
      map[i.grading].spend += Number(i.purchase_price);
      map[i.grading].count++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.spend - a.spend);
  }, [items]);

  // ── Section 3: Annual spend ──
  const annualData = useMemo(() => {
    if (items.length === 0) return [];
    const map: Record<number, { spend: number; count: number }> = {};
    items.forEach(i => {
      const y = new Date(i.purchase_date).getFullYear();
      if (!map[y]) map[y] = { spend: 0, count: 0 };
      map[y].spend += Number(i.purchase_price);
      map[y].count++;
    });
    const result = [];
    for (let y = yearRange.min; y <= yearRange.max; y++) {
      result.push({ year: y, spend: map[y]?.spend || 0, count: map[y]?.count || 0 });
    }
    return result;
  }, [items, yearRange]);

  // ── Section 3: Cumulative spend ──
  const cumulativeData = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
    let running = 0;
    return sorted.map(i => {
      running += Number(i.purchase_price);
      return { date: i.purchase_date, description: i.description, price: Number(i.purchase_price), total: running };
    });
  }, [items]);

  // ── Section 4: Source data ──
  const sourceData = useMemo(() => {
    const map: Record<string, { spend: number; count: number; highest: number }> = {};
    items.forEach(i => {
      const s = i.purchase_source || "Unknown";
      if (!map[s]) map[s] = { spend: 0, count: 0, highest: 0 };
      map[s].spend += Number(i.purchase_price);
      map[s].count++;
      map[s].highest = Math.max(map[s].highest, Number(i.purchase_price));
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, avg: Math.round(v.spend / v.count) }))
      .sort((a, b) => b.spend - a.spend);
  }, [items]);

  // ── Section 5: 12-Back ──
  const twelveBackItems = useMemo(() => items.filter(i => i.category === "12 BACK"), [items]);
  const twelveBackTotal = twelveBackItems.reduce((s, i) => s + Number(i.purchase_price), 0);
  const twelveBackAvg = twelveBackItems.length > 0 ? twelveBackTotal / twelveBackItems.length : 0;
  const twelveBackPct = totalCost > 0 ? ((twelveBackTotal / totalCost) * 100).toFixed(1) : "0";

  const twelveBackBars = useMemo(() =>
    [...twelveBackItems]
      .sort((a, b) => Number(b.purchase_price) - Number(a.purchase_price))
      .map(i => ({ name: i.description, price: Number(i.purchase_price), grade: i.grading, item_id: i.item_id })),
    [twelveBackItems]);

  const twelveBackScatter = useMemo(() =>
    twelveBackItems.map(i => ({
      year: new Date(i.purchase_date).getFullYear(),
      price: Number(i.purchase_price),
      description: i.description,
      grade: i.grading,
      fill: GRADE_COLORS[i.grading] || MUTED,
    })),
    [twelveBackItems]);

  // ── Section 6: Graded vs Ungraded dot plot ──
  const dotPlotData = useMemo(() => {
    const gradedDots = graded.map((i, idx) => ({
      group: "Graded", x: idx, price: Number(i.purchase_price), item_id: i.item_id, description: i.description, fill: GOLD,
    }));
    const ungradedDots = ungraded.map((i, idx) => ({
      group: "Ungraded", x: idx, price: Number(i.purchase_price), item_id: i.item_id, description: i.description, fill: MUTED,
    }));
    return { graded: gradedDots, ungraded: ungradedDots };
  }, [graded, ungraded]);

  const gradedSpendTotal = graded.reduce((s, i) => s + Number(i.purchase_price), 0);
  const gradedSpendPct = totalCost > 0 ? ((gradedSpendTotal / totalCost) * 100).toFixed(1) : "0";
  const mostExpensiveUngraded = useMemo(() => {
    if (ungraded.length === 0) return null;
    return ungraded.reduce((max, i) => Number(i.purchase_price) > Number(max.purchase_price) ? i : max, ungraded[0]);
  }, [ungraded]);

  // ── Section 7: P&L data ──
  const pnlItems = useMemo(() =>
    items
      .filter(i => i.current_estimated_value != null)
      .map(i => ({
        description: i.description,
        item_id: i.item_id,
        pnl: Number(i.current_estimated_value!) - Number(i.purchase_price),
      }))
      .sort((a, b) => b.pnl - a.pnl),
    [items]);
  const totalPnl = pnlItems.reduce((s, i) => s + i.pnl, 0);

  // ── Section 8: Insights ──
  const topCategoryBySpend = spendByCategory[0];
  const topTwoCombinedPct = spendByCategory.length >= 2
    ? (Number(spendByCategory[0].pct) + Number(spendByCategory[1].pct)).toFixed(1)
    : spendByCategory[0]?.pct || "0";

  const bestSource = useMemo(() => sourceData.length > 0 ? sourceData.reduce((min, s) => s.avg < min.avg ? s : min, sourceData[0]) : null, [sourceData]);
  const worstSource = useMemo(() => sourceData.length > 0 ? sourceData.reduce((max, s) => s.avg > max.avg ? s : max, sourceData[0]) : null, [sourceData]);
  const sourceDiffPct = bestSource && worstSource && bestSource.avg > 0
    ? (((worstSource.avg - bestSource.avg) / bestSource.avg) * 100).toFixed(0)
    : "0";

  const activeYears = annualData.filter(d => d.count > 0).length;
  const avgAnnualSpend = activeYears > 0 ? Math.round(totalCost / activeYears) : 0;

  const customTooltipStyle = {
    backgroundColor: BG_CARD,
    border: `1px solid ${GOLD_DIM}`,
    borderRadius: "2px",
    fontSize: "11px",
    fontFamily: "'Aptos', sans-serif",
    color: WHITE,
  };

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm tracking-wider">
        NO ITEMS IN COLLECTION — ADD ITEMS TO UNLOCK ANALYTICS
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-8">
      {/* Last updated */}
      <div className="text-right text-[10px] text-muted-foreground tracking-wider">
        Last updated: {new Date().toLocaleString("en-GB")}
      </div>

      {/* ── SECTION 1: KPI STRIP ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile label="PORTFOLIO COST" primary={fmt(totalCost)} secondary={`across ${items.length} items`} />
        <KpiTile label="PORTFOLIO VALUE" primary={fmt(portfolioValue)}
          secondary={<span className={unrealisedPnl >= 0 ? "text-green-500" : "text-red-500"}>{unrealisedPnl >= 0 ? "+" : ""}{fmt(unrealisedPnl)} ({unrealisedPct}%)</span>} />
        <KpiTile label="AVERAGE PRICE PAID" primary={fmt(Math.round(avgPrice))} secondary={`median ${fmt(Math.round(medianPrice))}`} />
        <KpiTile label="GRADED PREMIUM" primary={`${gradedPremium}×`} secondary={`graded avg ${fmt(Math.round(gradedAvg))} vs ungraded avg ${fmt(Math.round(ungradedAvg))}`} />
        <KpiTile label="COLLECTION DEPTH" primary={`${distinctCategories} categories`} secondary={`${graded.length} graded | ${ungraded.length} ungraded`} />
        <KpiTile label="ACQUISITION SPAN" primary={`${yearRange.min} → ${yearRange.max}`}
          secondary={`most active: ${mostActiveYear.year} (${mostActiveYear.count} items, ${fmt(mostActiveYear.spend)})`} />
      </div>

      {/* ── SECTION 2: COMPOSITION CHARTS ── */}
      <SectionTitle>Portfolio Composition</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut */}
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Spend by Category</ChartTitle>
          {spendByCategory.length < 2 ? <NoData name="Spend by Category" /> : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={spendByCategory} dataKey="spend" nameKey="name" cx="50%" cy="50%"
                    innerRadius={60} outerRadius={100} paddingAngle={2} label={false}>
                    {spendByCategory.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle}
                    formatter={(value: number, name: string, entry: any) => [
                      `${fmt(value)} (${entry.payload.count} items, ${entry.payload.pct}%)`, name
                    ]} />
                  <text x="50%" y="48%" textAnchor="middle" fill={MUTED} fontSize={9} fontFamily="Aptos, sans-serif">PORTFOLIO</text>
                  <text x="50%" y="56%" textAnchor="middle" fill={GOLD} fontSize={12} fontFamily="Aptos, sans-serif" fontWeight="bold">{fmt(totalCost)}</text>
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]">
                {spendByCategory.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="ml-auto text-foreground">{fmt(c.spend)} ({c.pct}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Grade tier bars */}
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Grade Tier Breakdown</ChartTitle>
          {spendByGrade.length < 2 ? <NoData name="Grade Tier Breakdown" /> : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={spendByGrade} layout="vertical" margin={{ left: 80, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                <XAxis type="number" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <YAxis type="category" dataKey="name" tick={{ fill: WHITE, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} width={75} />
                <Tooltip contentStyle={customTooltipStyle}
                  formatter={(value: number, _: string, entry: any) => [`${fmt(value)} (${entry.payload.count} items)`, "Spend"]} />
                <ReferenceLine x={ungradedAvg} stroke={MUTED} strokeDasharray="5 5" label={{ value: `Ungraded avg`, fill: MUTED, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} />
                <Bar dataKey="spend" radius={[0, 2, 2, 0]}>
                  {spendByGrade.map((entry) => (
                    <Cell key={entry.name} fill={entry.name === "Not Graded" ? "hsl(40, 10%, 30%)" : GOLD} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── SECTION 3: ACQUISITION TIMELINE ── */}
      <SectionTitle>Acquisition Timeline</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Annual Spend */}
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Annual Spend & Acquisition Velocity</ChartTitle>
          {annualData.length < 2 ? <NoData name="Annual Spend" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={annualData} margin={{ top: 20, right: 40, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                <XAxis dataKey="year" tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <YAxis yAxisId="left" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <Tooltip contentStyle={customTooltipStyle}
                  formatter={(value: number, name: string) => [name === "spend" ? fmt(value) : value, name === "spend" ? "Total Spend" : "Items"]}
                  labelFormatter={(label) => {
                    const d = annualData.find(a => a.year === label);
                    return `${label} — ${d?.count || 0} items, ${fmt(d?.spend || 0)}, avg ${fmt(d && d.count > 0 ? Math.round(d.spend / d.count) : 0)}`;
                  }} />
                <Bar yAxisId="left" dataKey="spend" fill={GOLD} radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke={WHITE} dot={{ fill: WHITE, r: 3 }} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cumulative */}
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Cumulative Portfolio Cost</ChartTitle>
          {cumulativeData.length < 2 ? <NoData name="Cumulative Cost" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cumulativeData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} tickFormatter={(v) => v.slice(0, 7)} />
                <YAxis tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <Tooltip contentStyle={customTooltipStyle}
                  formatter={(value: number, name: string, entry: any) => {
                    if (name === "total") return [fmt(value), "Running Total"];
                    return [fmt(value), name];
                  }}
                  labelFormatter={(_, payload) => {
                    if (payload && payload[0]) {
                      const d = payload[0].payload;
                      return `${d.description} — ${d.date} — ${fmt(d.price)}`;
                    }
                    return "";
                  }} />
                <ReferenceLine y={totalCost} stroke={GOLD} strokeDasharray="5 5" label={{ value: fmt(totalCost), fill: GOLD, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} />
                <Area type="monotone" dataKey="total" stroke={GOLD} fill={GOLD} fillOpacity={0.2} strokeWidth={2} dot={{ fill: GOLD, r: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── SECTION 4: SOURCE INTELLIGENCE ── */}
      <SectionTitle>Source Intelligence</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Spend by Source</ChartTitle>
          {sourceData.length < 2 ? <NoData name="Source Breakdown" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourceData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} angle={-30} textAnchor="end" />
                <YAxis tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <Tooltip contentStyle={customTooltipStyle}
                  formatter={(value: number, name: string, entry: any) => [
                    name === "spend" ? `${fmt(value)} (${entry.payload.count} items, avg ${fmt(entry.payload.avg)})` : value,
                    name === "spend" ? "Total Spend" : "Items"
                  ]} />
                <Bar dataKey="spend" fill={GOLD} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source Efficiency Table */}
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Where You Spend Most Per Item</ChartTitle>
          <div className="overflow-auto">
            <table className="w-full text-[10px] tracking-wider">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-1.5 text-left">#</th>
                  <th className="px-2 py-1.5 text-left">SOURCE</th>
                  <th className="px-2 py-1.5 text-right">ITEMS</th>
                  <th className="px-2 py-1.5 text-right">TOTAL</th>
                  <th className="px-2 py-1.5 text-right">AVG</th>
                  <th className="px-2 py-1.5 text-right">HIGHEST</th>
                </tr>
              </thead>
              <tbody>
                {sourceData.map((s, i) => (
                  <tr key={s.name} className={`border-b border-border/30 ${s.avg > avgPrice ? "text-primary" : "text-muted-foreground"}`}>
                    <td className="px-2 py-1.5">{i + 1}</td>
                    <td className="px-2 py-1.5 font-bold">{s.name}</td>
                    <td className="px-2 py-1.5 text-right">{s.count}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(s.spend)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(s.avg)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(s.highest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: 12-BACK DEEP DIVE ── */}
      {twelveBackItems.length > 0 && (
        <>
          <SectionTitle>12-Back Sub-Collection — {fmt(twelveBackTotal)} ({twelveBackItems.length} items, {twelveBackPct}% of portfolio)</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-border rounded p-4 bg-card">
              <ChartTitle>12-Back Items: Price Paid</ChartTitle>
              <ResponsiveContainer width="100%" height={Math.max(200, twelveBackBars.length * 40)}>
                <BarChart data={twelveBackBars} layout="vertical" margin={{ left: 120, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: WHITE, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} width={115} />
                  <Tooltip contentStyle={customTooltipStyle}
                    formatter={(value: number, _: string, entry: any) => [`${fmt(value)} — ${entry.payload.grade}`, entry.payload.item_id]} />
                  <ReferenceLine x={twelveBackAvg} stroke={MUTED} strokeDasharray="5 5"
                    label={{ value: `Avg: ${fmt(Math.round(twelveBackAvg))}`, fill: MUTED, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} />
                  <Bar dataKey="price" radius={[0, 2, 2, 0]}>
                    {twelveBackBars.map((entry) => <Cell key={entry.item_id} fill={GRADE_COLORS[entry.grade] || MUTED} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border border-border rounded p-4 bg-card">
              <ChartTitle>12-Back: Price vs Acquisition Year</ChartTitle>
              {twelveBackScatter.length < 2 ? <NoData name="12-Back Scatter" /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                    <XAxis type="number" dataKey="year" domain={["dataMin", "dataMax"]} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                    <YAxis type="number" dataKey="price" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                    <Tooltip contentStyle={customTooltipStyle} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return <div style={customTooltipStyle} className="p-2">{d.description}<br />{d.grade} — {d.year} — {fmt(d.price)}</div>;
                    }} />
                    <ReferenceLine y={twelveBackAvg} stroke={MUTED} strokeDasharray="5 5" />
                    <Scatter data={twelveBackScatter} fill={GOLD}>
                      {twelveBackScatter.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── SECTION 6: GRADED VS UNGRADED ── */}
      <SectionTitle>Graded vs Ungraded Analysis</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded p-4 bg-card">
          <ChartTitle>Price Distribution — Dot Plot</ChartTitle>
          {(graded.length === 0 && ungraded.length === 0) ? <NoData name="Graded vs Ungraded" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
                <XAxis type="number" dataKey="x" tick={false} label={{ value: "← Graded | Ungraded →", fill: MUTED, fontSize: 9, fontFamily: "'Aptos', sans-serif", position: "bottom" }} />
                <YAxis type="number" dataKey="price" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
                <Tooltip contentStyle={customTooltipStyle} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div style={customTooltipStyle} className="p-2">{d.item_id}: {d.description}<br />{fmt(d.price)}</div>;
                }} />
                <ReferenceLine y={gradedAvg} stroke={GOLD} strokeDasharray="5 5" label={{ value: `Graded avg: ${fmt(Math.round(gradedAvg))}`, fill: GOLD, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} />
                <ReferenceLine y={ungradedAvg} stroke={MUTED} strokeDasharray="5 5" label={{ value: `Ungraded avg: ${fmt(Math.round(ungradedAvg))}`, fill: MUTED, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} />
                <Scatter name="Graded" data={dotPlotData.graded} fill={GOLD}>
                  {dotPlotData.graded.map((_, i) => <Cell key={i} fill={GOLD} />)}
                </Scatter>
                <Scatter name="Ungraded" data={dotPlotData.ungraded.map(d => ({ ...d, x: d.x + graded.length + 3 }))} fill={MUTED}>
                  {dotPlotData.ungraded.map((_, i) => <Cell key={i} fill={MUTED} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-border rounded p-4 bg-card space-y-4">
          <ChartTitle>Graded Investment Metrics</ChartTitle>
          <InsightCard
            headline={`Graded items cost on average ${gradedPremium}× more than ungraded`}
            body={`Graded avg: ${fmt(Math.round(gradedAvg))} — Ungraded avg: ${fmt(Math.round(ungradedAvg))}`}
          />
          <InsightCard
            headline={`Graded items: ${graded.length} of ${items.length} (${items.length > 0 ? ((graded.length / items.length) * 100).toFixed(0) : 0}%) but ${gradedSpendPct}% of spend`}
            body={`Total graded spend: ${fmt(gradedSpendTotal)} of ${fmt(totalCost)}`}
          />
          {mostExpensiveUngraded && (
            <InsightCard
              headline={`Most expensive ungraded: ${mostExpensiveUngraded.description}`}
              body={`Purchased at ${fmt(Number(mostExpensiveUngraded.purchase_price))}`}
            />
          )}
        </div>
      </div>

      {/* ── SECTION 7: P&L TRACKER ── */}
      <SectionTitle>P&L Tracker</SectionTitle>
      {pnlItems.length === 0 ? (
        <div className="border border-primary/30 rounded p-6 bg-card text-center">
          <div className="text-primary text-sm tracking-wider font-bold mb-1">UNLOCK P&L TRACKING</div>
          <div className="text-muted-foreground text-xs tracking-wider">
            Add estimated values to your items in the Inventory view to unlock P&L tracking.
          </div>
        </div>
      ) : (
        <div className="border border-border rounded p-4 bg-card">
          <div className="text-[10px] text-muted-foreground tracking-wider mb-3">
            Total unrealised P&L: <span className={totalPnl >= 0 ? "text-green-500" : "text-red-500"}>{totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)}</span> across {pnlItems.length} valued items
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, pnlItems.length * 35)}>
            <BarChart data={pnlItems} layout="vertical" margin={{ left: 140, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 15%)" />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fill: MUTED, fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
              <YAxis type="category" dataKey="description" tick={{ fill: WHITE, fontSize: 9, fontFamily: "'Aptos', sans-serif" }} width={135} />
              <Tooltip contentStyle={customTooltipStyle}
                formatter={(value: number) => [`${value >= 0 ? "+" : ""}${fmt(value)}`, "P&L"]} />
              <ReferenceLine x={0} stroke={WHITE} />
              <Bar dataKey="pnl" radius={[0, 2, 2, 0]}>
                {pnlItems.map((entry) => <Cell key={entry.item_id} fill={entry.pnl >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── SECTION 8: INSIGHT CALLOUTS ── */}
      <SectionTitle>Insights</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topCategoryBySpend && (
          <InsightCard
            headline={`${topCategoryBySpend.name} represents ${topCategoryBySpend.pct}% of your portfolio spend`}
            body={`Your top two categories account for ${topTwoCombinedPct}% of total spend.`}
          />
        )}
        {bestSource && worstSource && (
          <InsightCard
            headline={`${bestSource.name} delivers the lowest average price at ${fmt(bestSource.avg)} per item`}
            body={`Compare to ${worstSource.name} at ${fmt(worstSource.avg)} avg — a ${sourceDiffPct}% difference.`}
          />
        )}
        <InsightCard
          headline={`Graded items hold ${gradedSpendPct}% of portfolio value on ${items.length > 0 ? ((graded.length / items.length) * 100).toFixed(0) : 0}% of items`}
          body={`The graded premium in your collection is ${gradedPremium}×.`}
        />
        <InsightCard
          headline={`Peak spending year was ${mostActiveYear.year} at ${fmt(mostActiveYear.spend)} across ${mostActiveYear.count} items`}
          body={`Average annual spend across active years: ${fmt(avgAnnualSpend)}.`}
        />
      </div>
    </div>
  );
}

function KpiTile({ label, primary, secondary }: { label: string; primary: string; secondary: React.ReactNode }) {
  return (
    <div className="border border-border rounded p-3 bg-card">
      <div className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mb-1">{label}</div>
      <div className="text-lg font-bold text-primary tracking-wider">{primary}</div>
      <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5">{secondary}</div>
    </div>
  );
}

function InsightCard({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="border-l-2 border-primary bg-secondary/50 rounded-r p-3">
      <div className="text-xs font-bold text-primary tracking-wider mb-1">{headline}</div>
      <div className="text-[10px] text-muted-foreground tracking-wider">{body}</div>
    </div>
  );
}

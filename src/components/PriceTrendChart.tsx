import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";
import type { Lot } from "@/lib/db";

const VARIANT_COLORS: Record<string, string> = {
  "12A": "hsl(43, 50%, 54%)",
  "12B": "hsl(20, 60%, 55%)",
  "12C": "hsl(200, 50%, 55%)",
  "12A-DT": "hsl(340, 50%, 55%)",
  "12B-DT": "hsl(270, 50%, 60%)",
  CAN: "hsl(140, 45%, 50%)",
  PAL: "hsl(60, 50%, 55%)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(50, 14%, 6%)",
  border: "1px solid hsl(43, 20%, 18%)",
  color: "hsl(40, 30%, 82%)",
  fontSize: 11,
  fontFamily: "'Aptos', sans-serif",
};

interface Props {
  lots: Lot[];
}

type ChartMode = "line" | "scatter";

const ScatterTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE} className="p-2 rounded text-xs space-y-0.5">
      <div className="text-primary font-bold">{d.variant_grade_key}</div>
      <div>Source: {d.source}</div>
      <div>Lot: {d.lot_ref}</div>
      <div>Date: {d.sale_date}</div>
      <div>Total: £{Number(d.total_paid_gbp).toLocaleString()}</div>
    </div>
  );
};

const PriceTrendChart = ({ lots }: Props) => {
  const [mode, setMode] = useState<ChartMode>("line");
  const [expanded, setExpanded] = useState(false);

  const { lineData, lineVariants } = useMemo(() => {
    const byVariant: Record<string, Lot[]> = {};
    lots.forEach((l) => {
      const v = l.variant_code;
      if (!byVariant[v]) byVariant[v] = [];
      byVariant[v].push(l);
    });
    const validVariants = Object.keys(byVariant).filter((v) => byVariant[v].length >= 2);
    if (validVariants.length === 0) return { lineData: [], lineVariants: [] };

    const dateMap: Record<string, Record<string, number>> = {};
    validVariants.forEach((v) => {
      byVariant[v].forEach((l) => {
        if (!dateMap[l.sale_date]) dateMap[l.sale_date] = {};
        dateMap[l.sale_date][v] = Number(l.total_paid_gbp);
      });
    });
    const sorted = Object.keys(dateMap).sort();
    return { lineData: sorted.map((d) => ({ date: d, ...dateMap[d] })), lineVariants: validVariants };
  }, [lots]);

  const scatterData = useMemo(() => {
    return lots.map((l) => ({
      ...l,
      dateNum: new Date(l.sale_date).getTime(),
      price: Number(l.total_paid_gbp),
    }));
  }, [lots]);

  const scatterVariants = useMemo(() => {
    return [...new Set(lots.map((l) => l.variant_code))];
  }, [lots]);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-6 py-2 text-[10px] tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
      >
        <span className="text-primary">{expanded ? "▼" : "▶"}</span>
        {expanded ? "Hide Price Trend" : "Show Price Trend"}
        <span className="text-muted-foreground ml-2">({lots.length} lots)</span>
      </button>

      {lots.length === 0 && expanded && (
        <div className="px-6 py-4 text-center text-muted-foreground text-[10px] tracking-widest">
          NO DATA FOR CHART
        </div>
      )}

      {expanded && lots.length > 0 && (
      <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
          {mode === "line" ? "Price Trend by Variant" : "Scatter Plot — All Lots"}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode("line")}
            className={`text-[10px] tracking-widest px-2 py-0.5 transition-colors ${mode === "line" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            LINE
          </button>
          <button
            onClick={() => setMode("scatter")}
            className={`text-[10px] tracking-widest px-2 py-0.5 transition-colors ${mode === "scatter" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            SCATTER
          </button>
        </div>
      </div>

      {mode === "line" ? (
        lineVariants.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-[10px] tracking-widest">
            LINE CHART REQUIRES 2+ DATA POINTS PER VARIANT
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 10, fill: "hsl(40, 15%, 50%)" }} />
              <YAxis stroke="hsl(40, 15%, 50%)" tick={{ fontSize: 10, fill: "hsl(40, 15%, 50%)" }} tickFormatter={(v) => `£${v.toLocaleString()}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`£${value.toLocaleString()}`, undefined]} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Aptos', sans-serif" }} />
              {lineVariants.map((v) => (
                <Line key={v} type="monotone" dataKey={v} stroke={VARIANT_COLORS[v] ?? "hsl(0, 0%, 60%)"} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 18%)" />
            <XAxis
              dataKey="dateNum"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="hsl(40, 15%, 50%)"
              tick={{ fontSize: 10, fill: "hsl(40, 15%, 50%)" }}
              tickFormatter={(v) => new Date(v).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
              name="Date"
            />
            <YAxis
              dataKey="price"
              type="number"
              stroke="hsl(40, 15%, 50%)"
              tick={{ fontSize: 10, fill: "hsl(40, 15%, 50%)" }}
              tickFormatter={(v) => `£${v.toLocaleString()}`}
              name="Total Paid"
            />
            <ZAxis range={[60, 60]} />
            <Tooltip content={<ScatterTooltipContent />} />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "'Aptos', sans-serif" }}
              payload={scatterVariants.map((v) => ({
                value: v,
                type: "circle" as const,
                color: VARIANT_COLORS[v] ?? "hsl(0, 0%, 60%)",
              }))}
            />
            <Scatter data={scatterData} name="Lots">
              {scatterData.map((entry, i) => (
                <Cell key={i} fill={VARIANT_COLORS[entry.variant_code] ?? "hsl(0, 0%, 60%)"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default PriceTrendChart;

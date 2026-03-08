import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

interface Props {
  lots: Lot[];
}

const PriceTrendChart = ({ lots }: Props) => {
  const { chartData, variants } = useMemo(() => {
    // Group by variant, filter to those with 2+ data points
    const byVariant: Record<string, Lot[]> = {};
    lots.forEach((l) => {
      const v = l.variant_code;
      if (!byVariant[v]) byVariant[v] = [];
      byVariant[v].push(l);
    });

    const validVariants = Object.keys(byVariant).filter(
      (v) => byVariant[v].length >= 2
    );

    if (validVariants.length === 0) return { chartData: [], variants: [] };

    // Build date-indexed map
    const dateMap: Record<string, Record<string, number>> = {};
    validVariants.forEach((v) => {
      byVariant[v].forEach((l) => {
        if (!dateMap[l.sale_date]) dateMap[l.sale_date] = {};
        dateMap[l.sale_date][v] = Number(l.total_paid_gbp);
      });
    });

    const sorted = Object.keys(dateMap).sort();
    const data = sorted.map((d) => ({ date: d, ...dateMap[d] }));

    return { chartData: data, variants: validVariants };
  }, [lots]);

  if (variants.length === 0) {
    return (
      <div className="px-6 py-4 text-center text-muted-foreground text-[10px] tracking-widest border-b border-border">
        PRICE TREND CHART REQUIRES 2+ DATA POINTS PER VARIANT
      </div>
    );
  }

  return (
    <div className="border-b border-border px-6 py-4">
      <div className="text-[10px] text-muted-foreground tracking-widest uppercase mb-2">
        Price Trend by Variant
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 18%)" />
          <XAxis
            dataKey="date"
            stroke="hsl(40, 15%, 50%)"
            tick={{ fontSize: 10, fill: "hsl(40, 15%, 50%)" }}
          />
          <YAxis
            stroke="hsl(40, 15%, 50%)"
            tick={{ fontSize: 10, fill: "hsl(40, 15%, 50%)" }}
            tickFormatter={(v) => `£${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(50, 14%, 6%)",
              border: "1px solid hsl(43, 20%, 18%)",
              color: "hsl(40, 30%, 82%)",
              fontSize: 11,
              fontFamily: "Courier New, monospace",
            }}
            formatter={(value: number) => [`£${value.toLocaleString()}`, undefined]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: "Courier New, monospace" }}
          />
          {variants.map((v) => (
            <Line
              key={v}
              type="monotone"
              dataKey={v}
              stroke={VARIANT_COLORS[v] ?? "hsl(0, 0%, 60%)"}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceTrendChart;

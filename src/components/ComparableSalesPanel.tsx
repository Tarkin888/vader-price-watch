import { useMemo } from "react";
import { X } from "lucide-react";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";

interface Props {
  lot: Lot;
  allLots: Lot[];
  onClose: () => void;
  currency?: Currency;
}

function getPrice(l: Lot, isUSD: boolean): number {
  const gbp = Number(l.total_paid_gbp);
  if (!isUSD) return gbp;
  const rate = Number(l.usd_to_gbp_rate);
  return rate > 0 ? Math.round(gbp / rate) : 0;
}

const fmtPrice = (n: number, isUSD: boolean) =>
  isUSD ? `$${Math.round(n).toLocaleString("en-US")}` : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ComparableSalesPanel = ({ lot, allLots, onClose, currency = "GBP" }: Props) => {
  const isUSD = currency === "USD";

  const { comparables, avgPrice, pctChange } = useMemo(() => {
    const same = allLots
      .filter((l) => l.variant_grade_key === lot.variant_grade_key && l.id !== lot.id)
      .sort((a, b) => b.sale_date.localeCompare(a.sale_date));

    const all = [lot, ...same].sort((a, b) => b.sale_date.localeCompare(a.sale_date));
    const avg = all.reduce((s, l) => s + getPrice(l, isUSD), 0) / all.length;

    let pct: number | null = null;
    if (all.length >= 2) {
      const newest = getPrice(all[0], isUSD);
      const second = getPrice(all[1], isUSD);
      if (second > 0) pct = ((newest - second) / second) * 100;
    }

    return { comparables: same, avgPrice: avg, pctChange: pct };
  }, [lot, allLots, isUSD]);

  const fmt = (n: number) => fmtPrice(n, isUSD);

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border z-50 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="text-[10px] tracking-wider text-muted-foreground">
          Comparable Sales
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border space-y-1">
        <div className="text-primary font-bold text-sm tracking-wider">{lot.variant_grade_key}</div>
        <div className="text-[10px] text-muted-foreground tracking-wider">
          Selected: {lot.lot_ref} • {lot.sale_date}
        </div>
        <div className="flex gap-4 mt-2">
          <div>
            <div className="text-[9px] text-muted-foreground tracking-wider">Avg Price</div>
            <div className="text-primary font-bold text-xs">{fmt(avgPrice)}</div>
          </div>
          {pctChange !== null && (
            <div>
              <div className="text-[9px] text-muted-foreground tracking-wider">Recent Δ</div>
              <div className={`font-bold text-xs ${pctChange >= 0 ? "text-green-500" : "text-destructive"}`}>
                {pctChange >= 0 ? "+" : ""}
                {pctChange.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {comparables.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-[10px] tracking-wider">
            No other sales for this variant-grade
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {comparables.map((c) => {
              const inner = (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">{c.sale_date}</span>
                    <span className="text-primary font-bold text-xs">{fmt(getPrice(c, isUSD))}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {c.source} • {c.lot_ref}
                  </div>
                  {c.condition_notes && (
                    <div className="text-[9px] text-muted-foreground/70 mt-0.5 truncate">
                      {c.condition_notes}
                    </div>
                  )}
                </>
              );
              return c.lot_url ? (
                <a
                  key={c.id}
                  href={c.lot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  {inner}
                </a>
              ) : (
                <div key={c.id} className="px-4 py-2.5 hover:bg-secondary/50 transition-colors">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparableSalesPanel;

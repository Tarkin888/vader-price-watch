import type { Lot } from "@/lib/db";
import type { Filters, Currency } from "@/components/FilterBar";

interface StatsBarProps {
  lots: Lot[];
  filters: Filters;
  currency?: Currency;
}

const ERA_COLORS: Record<string, string> = {
  SW: "hsl(210, 35%, 47%)",
  ESB: "hsl(40, 12%, 49%)",
  ROTJ: "hsl(0, 43%, 44%)",
  POTF: "hsl(45, 50%, 54%)",
};

const ERAS_ORDER = ["SW", "ESB", "ROTJ", "POTF"] as const;

function calcStats(items: Lot[], isUSD: boolean) {
  const count = items.length;
  if (count === 0) return { count: 0, avg: 0, max: 0, pricedCount: 0 };
  // Exclude ESTIMATE_ONLY records from price calculations
  const pricedItems = items.filter((l) => (l as any).price_status !== "ESTIMATE_ONLY" && Number(l.total_paid_gbp) > 0);
  const prices = pricedItems.map((l) => {
    const gbp = Number(l.total_paid_gbp);
    if (!isUSD) return gbp;
    const rate = Number(l.usd_to_gbp_rate);
    return rate > 0 ? Math.round(gbp / rate) : 0;
  });
  return {
    count,
    pricedCount: pricedItems.length,
    avg: prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0,
    max: prices.length > 0 ? Math.max(...prices) : 0,
    min: prices.length > 0 ? Math.min(...prices) : 0,
  };
}

const fmtVal = (n: number, isUSD: boolean) => {
  if (isUSD) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const StatsBar = ({ lots, filters, currency = "GBP" }: StatsBarProps) => {
  const isUSD = currency === "USD";
  const fmt = (n: number) => fmtVal(n, isUSD);
  if (lots.length === 0) {
    return (
      <div className="px-6 py-3 border-b border-border text-xs text-muted-foreground tracking-wider">
        NO RESULTS
      </div>
    );
  }

  const selectedEra = filters.era;

  if (selectedEra) {
    // Single era mode: summary + cardback breakdown
    const eraLots = lots.filter((l) => l.era === selectedEra);
    const stats = calcStats(eraLots, isUSD);

    // Group by cardback_code
    const byCardback = new Map<string, Lot[]>();
    eraLots.forEach((l) => {
      const code = l.cardback_code || "UNKNOWN";
      if (!byCardback.has(code)) byCardback.set(code, []);
      byCardback.get(code)!.push(l);
    });
    const cardbackEntries = [...byCardback.entries()].sort(([a], [b]) => a.localeCompare(b));

    const color = ERA_COLORS[selectedEra] ?? "hsl(0, 0%, 33%)";

    return (
      <div className="px-6 py-3 border-b border-border space-y-3">
        <div className="flex items-center gap-4">
          <span
            className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded"
            style={{ backgroundColor: color, color: "#fff" }}
          >
            {selectedEra}
          </span>
          <span className="text-xs text-muted-foreground tracking-wider">
            {stats.count} RECORDS
          </span>
          <span className="text-xs tracking-wider">
            <span className="text-muted-foreground">AVG:</span>{" "}
            <span className="text-primary font-bold">{fmt(stats.avg)}</span>
          </span>
          <span className="text-xs tracking-wider">
            <span className="text-muted-foreground">HIGH:</span>{" "}
            <span className="text-primary font-bold">{fmt(stats.max)}</span>
          </span>
        </div>

        {cardbackEntries.length > 0 && (
          <table className="text-[11px] tracking-wider w-auto">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left pr-6 pb-1 font-medium">CARDBACK</th>
                <th className="text-right pr-6 pb-1 font-medium">COUNT</th>
                <th className="text-right pr-6 pb-1 font-medium">AVG GBP</th>
                <th className="text-right pb-1 font-medium">HIGH GBP</th>
              </tr>
            </thead>
            <tbody>
              {cardbackEntries.map(([code, codeLots]) => {
                const s = calcStats(codeLots, isUSD);
                return (
                  <tr key={code}>
                    <td className="text-left pr-6 py-0.5 text-foreground font-mono">{code}</td>
                    <td className="text-right pr-6 py-0.5 text-foreground">{s.count}</td>
                    <td className="text-right pr-6 py-0.5 text-primary font-bold">{fmt(s.avg)}</td>
                    <td className="text-right py-0.5 text-primary font-bold">{fmt(s.max)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // All eras mode: just show a compact summary line (era cards are in the header)
  const totalStats = calcStats(lots, isUSD);

  return (
    <div className="flex items-center gap-4 px-6 py-2 border-b border-border text-xs tracking-wider">
      <span className="text-muted-foreground">
        {totalStats.count} RECORDS
      </span>
      <span>
        <span className="text-muted-foreground">AVG: </span>
        <span className="text-primary font-bold">{fmt(totalStats.avg)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">HIGH: </span>
        <span className="text-primary font-bold">{fmt(totalStats.max)}</span>
      </span>
    </div>
  );
};

export default StatsBar;

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";
import { useConfig } from "@/hooks/use-config";

interface Props {
  lots: Lot[];
  currency?: Currency;
}

const DEFAULT_THRESHOLD = 5000;
const TOP_COUNT = 3;

const fmtPrice = (n: number, isUSD: boolean) =>
  isUSD ? `$${Math.round(n).toLocaleString("en-US")}` : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function getPrice(l: Lot, isUSD: boolean): number {
  const gbp = Number(l.total_paid_gbp);
  if (!isUSD) return gbp;
  const rate = Number(l.usd_to_gbp_rate);
  return rate > 0 ? Math.round(gbp / rate) : 0;
}

const NotableSalesBanner = ({ lots, currency = "GBP" }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const config = useConfig();
  const threshold = Number(config["notable_sales_threshold"]) || DEFAULT_THRESHOLD;
  const isUSD = currency === "USD";

  const notable = useMemo(() => {
    return lots
      .filter((l) => Number(l.total_paid_gbp) >= threshold)
      .sort((a, b) => Number(b.total_paid_gbp) - Number(a.total_paid_gbp));
  }, [lots, threshold]);

  if (notable.length === 0) return null;

  const top = notable.slice(0, TOP_COUNT);

  return (
    <div className="px-6 py-2 border-b border-primary/30">
      <div className="flex items-center gap-2 text-[10px] tracking-wider">
        <Star className="w-3 h-3 text-primary fill-primary" />
        <span className="text-muted-foreground tracking-wider">
          Notable Sales ({notable.length})
        </span>
        <span className="text-foreground">
          {top.map((l, i) => (
            <span key={l.id}>
              {i > 0 && <span className="text-muted-foreground"> • </span>}
              <span className="text-primary font-bold">{l.variant_grade_key}</span>
              {" "}
              <span>{fmtPrice(getPrice(l, isUSD), isUSD)}</span>
            </span>
          ))}
        </span>
        {notable.length > TOP_COUNT && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-primary hover:underline ml-1"
          >
            {expanded ? "Hide" : "Show all"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {notable.map((l) => (
            <div key={l.id} className="text-[10px] tracking-wider flex items-center gap-3">
              <span className="text-primary font-bold w-40">{l.variant_grade_key}</span>
              <span className="w-24">{fmtPrice(getPrice(l, isUSD), isUSD)}</span>
              <span className="text-muted-foreground">{l.source} • {l.sale_date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotableSalesBanner;

import { useMemo } from "react";
import { Star } from "lucide-react";
import type { Lot } from "@/lib/db";

interface Props {
  lots: Lot[];
}

const THRESHOLD = 5000;

const NotableSalesBanner = ({ lots }: Props) => {
  const notable = useMemo(() => {
    return lots.filter((l) => Number(l.total_paid_gbp) >= THRESHOLD);
  }, [lots]);

  if (notable.length === 0) return null;

  return (
    <div className="px-6 py-2 border-b border-primary/30">
      <div className="text-[10px] text-muted-foreground tracking-widest mb-1.5 flex items-center gap-1.5">
        <Star className="w-3 h-3 text-primary" />
        NOTABLE SALES (£{THRESHOLD.toLocaleString()}+)
      </div>
      <div className="flex flex-wrap gap-2">
        {notable.map((l) => (
          <div
            key={l.id}
            className="border border-primary/50 bg-primary/5 px-2.5 py-1 text-[10px] tracking-wider flex items-center gap-2"
          >
            <span className="text-primary font-bold">{l.variant_grade_key}</span>
            <span className="text-foreground">
              £{Number(l.total_paid_gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-muted-foreground">{l.source} • {l.sale_date}</span>
            <span className="bg-primary text-primary-foreground px-1 py-0.5 text-[8px] tracking-widest font-bold">
              NOTABLE
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotableSalesBanner;

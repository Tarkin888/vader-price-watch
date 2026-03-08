import type { Lot } from "@/lib/db";

interface StatsBarProps {
  lots: Lot[];
}

const StatsBar = ({ lots }: StatsBarProps) => {
  const count = lots.length;
  const avg = count > 0 ? lots.reduce((s, l) => s + Number(l.total_paid_gbp), 0) / count : 0;
  const max = count > 0 ? Math.max(...lots.map((l) => Number(l.total_paid_gbp))) : 0;
  const min = count > 0 ? Math.min(...lots.map((l) => Number(l.total_paid_gbp))) : 0;

  const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-wrap gap-6 px-6 py-3 border-b border-border text-xs tracking-wider">
      <Stat label="RESULTS" value={String(count)} />
      <Stat label="AVG PAID" value={fmt(avg)} />
      <Stat label="HIGHEST" value={fmt(max)} />
      <Stat label="LOWEST" value={fmt(min)} />
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 items-baseline">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-primary font-bold">{value}</span>
    </div>
  );
}

export default StatsBar;

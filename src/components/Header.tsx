import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import HeaderPhoto from "./HeaderPhoto";
import type { Lot } from "@/lib/db";

const ERA_COLORS: Record<string, string> = {
  SW: "hsl(210, 35%, 47%)",
  ESB: "hsl(40, 12%, 49%)",
  ROTJ: "hsl(0, 43%, 44%)",
  POTF: "hsl(45, 50%, 54%)",
};

const ERAS_ORDER = ["SW", "ESB", "ROTJ", "POTF"] as const;

interface HeaderProps {
  totalRecords: number;
  lastScrapeDate: string | null;
  lots?: Lot[];
}

function calcEraStats(items: Lot[]) {
  const priced = items.filter((l) => (l as any).price_status !== "ESTIMATE_ONLY" && Number(l.total_paid_gbp) > 0);
  const prices = priced.map((l) => Number(l.total_paid_gbp));
  return {
    count: items.length,
    avg: prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0,
    max: prices.length > 0 ? Math.max(...prices) : 0,
  };
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Header = ({ totalRecords, lastScrapeDate, lots = [] }: HeaderProps) => {
  const eraGroups = ERAS_ORDER.map((era) => ({
    era,
    lots: lots.filter((l) => l.era === era),
  })).filter((g) => g.lots.length > 0);

  return (
    <header className="border-b border-border px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <HeaderPhoto />
        <div className="shrink-0">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="cursor-pointer">
              <h1 className="text-xl md:text-2xl font-bold text-primary tracking-wider">
                DARTH VADER MINT ON CARD FOCUS
              </h1>
            </Link>
            <span className="text-[10px] text-muted-foreground tracking-widest">
              v4.0 | March 2026
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground tracking-wider leading-relaxed">
            SW 12/20/21 &nbsp;• &nbsp;ESB 31/32/41/45/47/48 &nbsp;• &nbsp;ROTJ 48/65/77/79 &nbsp;• &nbsp;POTF 92
            <br />
            C&T &nbsp;• &nbsp;Hake's &nbsp;• &nbsp;Heritage &nbsp;• &nbsp;LCG &nbsp;• &nbsp;Vectis
          </p>
          <div className="mt-1 flex gap-6 text-xs text-muted-foreground tracking-wider">
            <span>RECORDS IN DATABASE: <span className="text-primary">{totalRecords}</span></span>
            <span>LAST SCRAPE: <span className="text-primary">{lastScrapeDate ?? "N/A"}</span></span>
          </div>
        </div>

        {/* Era stat badges */}
        <div className="flex flex-wrap gap-2 items-start">
          {eraGroups.map(({ era, lots: eraLots }) => {
            const stats = calcEraStats(eraLots);
            const color = ERA_COLORS[era] ?? "hsl(0, 0%, 33%)";
            return (
              <div
                key={era}
                className="border border-border rounded px-3 py-1.5 min-w-[150px] bg-secondary/50"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: color, color: "#fff" }}
                  >
                    {era}
                  </span>
                  <span className="text-[10px] text-muted-foreground tracking-wider">
                    {stats.count} records
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] tracking-wider">
                  <span>
                    <span className="text-muted-foreground">AVG </span>
                    <span className="text-primary font-bold">{fmt(stats.avg)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">HIGH </span>
                    <span className="text-primary font-bold">{fmt(stats.max)}</span>
                  </span>
                </div>
              </div>
            );
          })}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;

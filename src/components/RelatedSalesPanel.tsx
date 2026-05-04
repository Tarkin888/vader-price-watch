import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useRelatedSales, resolveMatchKeys } from "@/hooks/useRelatedSales";
import type { CollectionItem } from "@/lib/collection-db";
import SourceBadge from "@/components/SourceBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { COLLECTION_FEATURE_ENABLED } from "@/lib/feature-flags";

interface Props {
  item: CollectionItem;
  /** Default expanded state. Defaults to false (list view). */
  defaultExpanded?: boolean;
  /** Compact rendering for the mobile card. */
  compact?: boolean;
}

const fmtGBP = (n: number) =>
  n > 0 ? `£${Math.round(n).toLocaleString("en-GB")}` : "—";

const fmtDateLong = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const numericFont = "'Courier New', Courier, monospace";

const Chip = ({ label, value }: { label: string; value: string }) => (
  <span
    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] tracking-wider whitespace-nowrap"
    style={{
      border: "1px solid rgba(201, 168, 76, 0.4)",
      background: "transparent",
      color: "#e0d8c0",
      fontFamily: numericFont,
    }}
  >
    <span className="opacity-60">{label}</span>
    <span className="text-primary font-bold">{value}</span>
  </span>
);

const SkeletonChip = () => (
  <span
    className="inline-block h-[18px] w-20 rounded animate-pulse"
    style={{ background: "rgba(201, 168, 76, 0.12)" }}
  />
);

export default function RelatedSalesPanel({ item, defaultExpanded = false, compact = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { data, loading, error, stats, matchKey } = useRelatedSales(item);
  const { cardback, variant, grade } = resolveMatchKeys(item);

  const headerLabel = `Related Sales (${loading ? "…" : stats.count})`;

  if (!matchKey) {
    // No usable identity to query against — render a quiet hint.
    return (
      <div className="border border-border rounded px-3 py-2 text-[10px] text-muted-foreground tracking-wider">
        Related Sales — set a cardback, variant, and grade to see comparable auction results.
      </div>
    );
  }

  return (
    <div
      className="border border-border rounded"
      style={{ background: "rgba(8, 8, 6, 0.4)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />}
        <span
          className="text-[11px] tracking-wider text-primary font-bold whitespace-nowrap"
          style={{ fontFamily: numericFont }}
        >
          {headerLabel}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-1.5 justify-end">
          {loading ? (
            <>
              <SkeletonChip />
              <SkeletonChip />
              <SkeletonChip />
              <SkeletonChip />
            </>
          ) : stats.count === 0 ? (
            <span className="text-[10px] text-muted-foreground tracking-wider">No comps yet</span>
          ) : (
            <>
              <Chip label="Avg" value={fmtGBP(stats.avgTotalPaidGBP)} />
              <Chip label="Low" value={fmtGBP(stats.minTotalPaidGBP)} />
              <Chip label="High" value={fmtGBP(stats.maxTotalPaidGBP)} />
              <Chip label="Last" value={fmtDateLong(stats.latestSaleDate)} />
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-3 py-2">
          <div className="text-[10px] text-muted-foreground tracking-wider mb-2" style={{ fontFamily: numericFont }}>
            Matching: <span className="text-primary">{cardback}</span> · <span className="text-primary">{variant}</span> · <span className="text-primary">{grade}</span>
          </div>

          {error ? (
            <div className="text-[10px] text-destructive tracking-wider py-3">
              Failed to load comparable sales: {error.message}
            </div>
          ) : loading ? (
            <div className="space-y-1.5 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-full rounded animate-pulse"
                  style={{ background: "rgba(201, 168, 76, 0.08)" }}
                />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="text-[11px] text-muted-foreground tracking-wider py-3 text-center">
              No comparable sales recorded yet for this cardback + variant + grade.
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]" style={{ fontFamily: numericFont }}>
                  <thead>
                    <tr className="text-muted-foreground tracking-wider text-left border-b border-border/60">
                      <th className="px-1.5 py-1.5 whitespace-nowrap">Sale Date</th>
                      <th className="px-1.5 py-1.5">Source</th>
                      <th className="px-1.5 py-1.5 text-right whitespace-nowrap">Total Paid</th>
                      <th className="px-1.5 py-1.5 text-right whitespace-nowrap">Hammer</th>
                      <th className="px-1.5 py-1.5 whitespace-nowrap">Lot Ref</th>
                      {!compact && <th className="px-1.5 py-1.5">Condition</th>}
                      <th className="px-1.5 py-1.5">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((lot) => {
                      const total = Number(lot.total_paid_gbp) || 0;
                      const hammer = Number(lot.hammer_price_gbp) || 0;
                      const cond = (lot.condition_notes || "").trim();
                      return (
                        <tr key={lot.id} className="border-b border-border/30 hover:bg-secondary/40">
                          <td className="px-1.5 py-1.5 whitespace-nowrap text-foreground">
                            {fmtDateLong(lot.sale_date)}
                          </td>
                          <td className="px-1.5 py-1.5">
                            <SourceBadge source={lot.source} size="md" />
                          </td>
                          <td className="px-1.5 py-1.5 text-right text-primary font-bold whitespace-nowrap">
                            {fmtGBP(total)}
                          </td>
                          <td className="px-1.5 py-1.5 text-right text-foreground whitespace-nowrap">
                            {fmtGBP(hammer)}
                          </td>
                          <td className="px-1.5 py-1.5 text-muted-foreground whitespace-nowrap max-w-[120px] truncate" title={lot.lot_ref}>
                            {lot.lot_url ? (
                              <a
                                href={lot.lot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary underline-offset-2 hover:underline"
                              >
                                {lot.lot_ref}
                              </a>
                            ) : (
                              lot.lot_ref || "—"
                            )}
                          </td>
                          {!compact && (
                            <td className="px-1.5 py-1.5 max-w-[200px] text-muted-foreground">
                              {cond ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate inline-block max-w-[180px] align-bottom">{cond}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm text-[11px]">{cond}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-1.5 py-1.5">
                            {lot.lot_url ? (
                              <a
                                href={lot.lot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary inline-flex items-center"
                                aria-label="Open lot"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}

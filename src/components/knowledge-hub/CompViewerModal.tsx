import { useEffect, useMemo } from "react";
import { X, ExternalLink, ImageOff } from "lucide-react";
import { useCompsLookup } from "@/hooks/useRelatedSales";
import SourceBadge from "@/components/SourceBadge";
import { logActivity } from "@/lib/activity-log";
import { PLACEHOLDER_BG, PLACEHOLDER_SIZE, applyPlaceholderOnError } from "@/lib/imagePlaceholder";

interface CompViewerModalProps {
  cardbackCode: string;
  /** Optional variant narrowing — when present, narrows lookup to this variant. */
  variantCode?: string;
  open: boolean;
  onClose: () => void;
}

const fmtGBP = (n: number | null | undefined) => {
  const v = Number(n) || 0;
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const PLACEHOLDER_BG = "linear-gradient(135deg, rgba(201,168,76,0.05) 25%, transparent 25%, transparent 50%, rgba(201,168,76,0.05) 50%, rgba(201,168,76,0.05) 75%, transparent 75%)";

const CompViewerModal = ({ cardbackCode, variantCode, open, onClose }: CompViewerModalProps) => {
  const { data: lots, loading, stats } = useCompsLookup({
    cardbackCode: open ? cardbackCode : null,
    variantCode: open ? variantCode : null,
    limit: 25,
  });

  // Activity log fires on open with match count
  useEffect(() => {
    if (!open) return;
    if (loading) return;
    logActivity("knowledge_hub.comps_view", cardbackCode, { cardbackCode, variantCode: variantCode ?? null, matchCount: stats.count });
    // Only log once per (open, results-resolved) cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  // Esc key dismisses
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const summary = useMemo(() => {
    if (!stats.count) return null;
    return [
      { label: "Records", value: String(stats.count) },
      { label: "Avg", value: fmtGBP(stats.avgTotalPaidGBP) },
      { label: "Low", value: fmtGBP(stats.minTotalPaidGBP) },
      { label: "High", value: fmtGBP(stats.maxTotalPaidGBP) },
      { label: "Latest", value: stats.latestSaleDate ?? "—" },
    ];
  }, [stats]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Auction comps for ${cardbackCode}`}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-background"
        style={{ border: "2px solid #C9A84C", boxShadow: "0 0 24px hsl(43 50% 54% / 0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-primary/40">
          <div>
            <h3 className="text-sm sm:text-base font-medium tracking-wider" style={{ color: "#e0d8c0" }}>
              Auction Comps — <span className="text-primary font-bold">{cardbackCode}</span>
            </h3>
            <p className="text-[10px] tracking-wider text-muted-foreground mt-0.5">
              Most recent matching auction lots from the shared price database
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary chips */}
        {summary && (
          <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-border/50">
            {summary.map((chip) => (
              <div
                key={chip.label}
                className="flex items-baseline gap-1.5 px-2 py-1 rounded border border-primary/30 bg-secondary/40"
              >
                <span className="text-[9px] tracking-wider text-muted-foreground uppercase">{chip.label}</span>
                <span className="text-[11px] font-bold text-primary">{chip.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="border border-border/40 rounded p-2 space-y-2 animate-pulse">
                  <div className="aspect-square bg-secondary/50 rounded" />
                  <div className="h-2 bg-secondary/50 rounded w-2/3" />
                  <div className="h-2 bg-secondary/50 rounded w-1/2" />
                  <div className="h-3 bg-secondary/50 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : lots.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs text-muted-foreground tracking-wider italic">
                No comps yet for this cardback. Check back after the next scrape.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {lots.map((lot) => {
                const img = lot.cached_image_url || (lot.image_urls && lot.image_urls[0]) || null;
                const total = Number(lot.total_paid_gbp) || 0;
                const vgKey = `${lot.variant_code} • ${lot.grade_tier_code}`;
                return (
                  <div
                    key={lot.id}
                    className="border border-border/60 rounded overflow-hidden bg-card flex flex-col hover:border-primary/60 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-square bg-secondary/30 flex items-center justify-center overflow-hidden"
                      style={img ? undefined : { backgroundImage: PLACEHOLDER_BG, backgroundSize: PLACEHOLDER_SIZE }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={`${lot.variant_code} ${lot.lot_ref}`}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={applyPlaceholderOnError}
                        />
                      ) : (
                        <ImageOff className="w-6 h-6 text-muted-foreground/50" />
                      )}
                    </div>

                    {/* Meta */}
                    <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground tracking-wider">{lot.sale_date}</span>
                        <SourceBadge source={lot.source} size="sm" className="!w-auto !h-5" />
                      </div>
                      <div className="text-[10px] text-foreground/90 tracking-wider truncate" title={vgKey}>
                        {vgKey}
                      </div>
                      <div className="text-[13px] font-bold text-primary">{fmtGBP(total)}</div>
                      {lot.condition_notes && (
                        <div
                          className="text-[9px] text-muted-foreground/70 leading-snug"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {lot.condition_notes}
                        </div>
                      )}
                      <div className="mt-auto pt-1">
                        {lot.lot_url ? (
                          <a
                            href={lot.lot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary tracking-wider"
                          >
                            {lot.lot_ref || "View lot"} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground tracking-wider">{lot.lot_ref}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note when capped */}
        {!loading && lots.length >= 25 && (
          <div className="px-4 py-2 border-t border-border/50 text-[10px] tracking-wider text-muted-foreground text-center italic">
            Showing most recent 25 results. Use the Price Tracker for the full list.
          </div>
        )}
      </div>
    </div>
  );
};

export default CompViewerModal;

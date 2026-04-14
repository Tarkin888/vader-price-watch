import React, { useState, useCallback } from "react";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";
import SourceBadge from "@/components/SourceBadge";
import { Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { adminWrite } from "@/lib/admin-write";

/* ── image helpers (same as LotsTable) ── */
function getLotImageUrl(imageUrls: string[]): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  const junkPatterns = [
    /cookieyes/i, /spinner/i, /settings\//i, /data:image/i,
    /\.svg$/i, /poweredbt/i, /revisit\./i, /close\./i,
    /profile/i, /avatar/i, /\/user\//i, /\/user\?/i, /\/users\//i,
  ];
  const isJunk = (url: string) => junkPatterns.some((p) => p.test(url));
  const large = imageUrls.find((u) => /images\/lot\/.*_l\./i.test(u) && !isJunk(u));
  if (large) return large;
  const small = imageUrls.find((u) => /images\/lot\/.*_s\./i.test(u) && !isJunk(u));
  if (small) return small;
  const any = imageUrls.find((u) => !isJunk(u) && u.startsWith("http"));
  return any || null;
}

const USD_SOURCES = ["Heritage", "Hakes"];

const fmtPrice = (gbp: number, lot: Lot, isUSD: boolean) => {
  if (!isUSD) return `£${gbp.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rate = Number(lot.usd_to_gbp_rate);
  const usd = rate > 0 ? Math.round(gbp / rate) : 0;
  return `$${usd.toLocaleString("en-US")}`;
};

const copyRow = (lot: Lot) => {
  const fields = [
    lot.sale_date, lot.source, (lot as any).era, (lot as any).cardback_code,
    lot.variant_code, lot.grade_tier_code, lot.variant_grade_key,
    lot.total_paid_gbp, lot.hammer_price_gbp, lot.buyers_premium_gbp,
    lot.condition_notes, lot.lot_ref, lot.lot_url,
  ];
  navigator.clipboard.writeText(fields.join("\t"));
  toast.success("Row copied");
};

const ERA_COLORS: Record<string, string> = {
  SW: "#3b82f6",
  ESB: "#a855f7",
  ROTJ: "#22c55e",
  POTF: "#f59e0b",
  UNKNOWN: "#6b7280",
};

interface Props {
  lots: Lot[];
  currency?: Currency;
  onChanged?: () => void;
}

const PriceTrackerTileView = ({ lots, currency = "GBP", onChanged }: Props) => {
  const isUSD = currency === "USD";
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDelete = useCallback(async (lot: Lot) => {
    // Optimistically hide the card
    setDeletedIds((prev) => new Set(prev).add(lot.id));

    const undoRestore = () => {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(lot.id);
        return next;
      });
    };

    // Attempt delete via admin-write
    const res = await adminWrite({ table: "lots", operation: "delete", match: { column: "id", value: lot.id } });
    if (!res.success) {
      undoRestore();
      toast.error(res.error || "Delete failed");
      return;
    }

    toast("Record deleted. Undo?", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: async () => {
          // Re-insert the original lot data
          const { id, created_at, updated_at, ...insertData } = lot as any;
          const reinsert = await adminWrite({ table: "lots", operation: "insert", data: insertData });
          if (reinsert.success) {
            undoRestore();
            onChanged?.();
            toast.success("Record restored");
          } else {
            toast.error(reinsert.error || "Restore failed");
          }
        },
      },
      onAutoClose: () => {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(lot.id);
          return next;
        });
        onChanged?.();
      },
      onDismiss: () => {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(lot.id);
          return next;
        });
        onChanged?.();
      },
    });
  }, [onChanged]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 md:px-6">
      {lots.filter((lot) => !deletedIds.has(lot.id)).map((lot) => {
        const imgUrl = (lot as any).cached_image_url ?? getLotImageUrl(lot.image_urls);
        const era = (lot as any).era || "UNKNOWN";
        const cardback = (lot as any).cardback_code || "UNKNOWN";
        const total = Number(lot.total_paid_gbp) || 0;
        const isEstimate = (lot as any).price_status === "ESTIMATE_ONLY";

        return (
          <div
            key={lot.id}
            className="rounded-lg overflow-hidden transition-colors group"
            style={{ background: "#0d0d0a", border: "1px solid #1a1a14" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9A84C")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a14")}
          >
            {/* Image */}
            <div className="relative w-full" style={{ aspectRatio: "4/3", background: "#080806" }}>
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={lot.variant_grade_key}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const parent = (e.currentTarget as HTMLImageElement).parentElement;
                    if (parent && !parent.querySelector(".no-img-label")) {
                      const lbl = document.createElement("span");
                      lbl.className = "no-img-label absolute inset-0 flex items-center justify-center text-xs tracking-wider";
                      lbl.style.color = "rgba(224,216,192,0.3)";
                      lbl.textContent = "No Image";
                      parent.appendChild(lbl);
                    }
                  }}
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-xs tracking-wider" style={{ color: "rgba(224,216,192,0.3)" }}>
                  No Image
                </span>
              )}
              {isEstimate && (
                <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.9)", color: "#080806" }}>
                  ESTIMATE
                </span>
              )}
              {/* Quick delete button — visible on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(lot); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(26,26,26,0.8)" }}
                title="Delete record"
              >
                <X className="w-3.5 h-3.5" style={{ color: "#C9A84C" }} />
              </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-1.5" style={{ fontFamily: "'Courier New', monospace" }}>
              {/* Row 1: Source + Era */}
              <div className="flex items-center gap-2 flex-wrap">
                <SourceBadge source={lot.source} size="md" />
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                  style={{ background: `${ERA_COLORS[era] || ERA_COLORS.UNKNOWN}22`, color: ERA_COLORS[era] || ERA_COLORS.UNKNOWN }}
                >
                  {era}
                </span>
              </div>

              {/* Row 2: Cardback code */}
              <p className="text-[13px] font-bold" style={{ color: "#C9A84C" }}>
                {cardback}
              </p>

              {/* Row 3: Variant–Grade Key */}
              <p className="text-[11px] truncate" style={{ color: "rgba(224,216,192,0.6)" }}>
                {lot.variant_grade_key}
              </p>

              {/* Row 4: Total Paid */}
              <p className="text-base font-bold" style={{ color: "#C9A84C" }}>
                {total > 0 ? fmtPrice(total, lot, isUSD) : "—"}
              </p>

              {/* Row 5: Sale date */}
              <p className="text-[10px]" style={{ color: "rgba(224,216,192,0.4)" }}>
                {lot.sale_date}
              </p>

              {/* Footer: View Lot + Copy */}
              <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(201,168,76,0.1)" }}>
                {lot.lot_url ? (
                  <a
                    href={lot.lot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] tracking-wider transition-colors"
                    style={{ color: "rgba(224,216,192,0.5)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(224,216,192,0.5)")}
                  >
                    <ExternalLink className="w-3 h-3" /> View Lot
                  </a>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => copyRow(lot)}
                  className="p-1.5 transition-colors"
                  style={{ color: "rgba(224,216,192,0.4)", minHeight: 32, minWidth: 32 }}
                  title="Copy row"
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(224,216,192,0.4)")}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PriceTrackerTileView;

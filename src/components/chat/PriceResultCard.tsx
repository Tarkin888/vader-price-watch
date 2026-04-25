import { ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-log";

/**
 * Build a Price Tracker URL from Kenny's per-message filter object.
 * Filter keys are snake_case (from chat edge function), URL params match
 * those expected by Index.tsx hydration (`searchParams.get(...)`).
 * Returns "/" with no query string when no filters are active.
 */
function buildPriceTrackerUrl(query: any): string {
  if (!query || typeof query !== "object") return "/";
  const map: Array<[string, unknown]> = [
    ["source", query.source],
    ["era", query.era],
    ["cardback", query.cardback_code],
    ["variant", query.variant_code],
    ["grade", query.grade_tier_code],
    ["dateFrom", query.date_from],
    ["dateTo", query.date_to],
  ];
  const params = new URLSearchParams();
  for (const [key, val] of map) {
    if (val == null) continue;
    const s = String(val).trim();
    if (s) params.set(key, s);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

const SOURCE_COLORS: Record<string, string> = {
  Heritage: "#4A90D9",
  Hakes: "#5BA55B",
  LCG: "#D4A843",
  Vectis: "#C75050",
  CandT: "#8B5CF6",
  "C&T": "#8B5CF6",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatGBP(v: number) {
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PriceResultCardsProps {
  metadata: any;
}

export default function PriceResultCards({ metadata }: PriceResultCardsProps) {
  if (!metadata) return null;

  const { aggregation, results, resultCount, totalMatches } = metadata;

  if (aggregation === "count") {
    return (
      <div className="px-3 py-1.5 rounded-full text-xs inline-block mt-1"
        style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>
        {results?.count ?? resultCount} matching records found
      </div>
    );
  }

  if (aggregation === "average") {
    return (
      <div className="px-3 py-2 rounded-lg text-xs mt-1"
        style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}>
        <span style={{ color: "#C9A84C" }}>Average: {formatGBP(results?.average ?? 0)}</span>
        <span style={{ color: "#e0d8c0" }}> across {results?.count ?? 0} sales</span>
      </div>
    );
  }

  if (aggregation === "highest" || aggregation === "lowest") {
    const item = Array.isArray(results) ? results[0] : null;
    if (!item) return null;
    const borderColor = aggregation === "highest" ? "#C9A84C" : "#C75050";
    return (
      <div className="rounded-lg p-2 mt-1 text-xs" style={{ border: `2px solid ${borderColor}`, background: "#1A1A16" }}>
        <ResultRow item={item} />
      </div>
    );
  }

  // list
  if (!Array.isArray(results) || results.length === 0) return null;
  const shown = results.slice(0, 5);

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {shown.map((item: any, i: number) => (
        <div key={i} className="rounded-lg p-2 text-xs" style={{ background: "#1A1A16", border: "1px solid rgba(201,168,76,0.15)" }}>
          <ResultRow item={item} />
        </div>
      ))}
      {totalMatches > 5 && (() => {
        const href = buildPriceTrackerUrl(metadata.query);
        return (
          <a
            href={href}
            className="text-xs mt-1 underline"
            style={{ color: "#C9A84C" }}
            onClick={() => logActivity("kenny.view_in_price_tracker", null, { href, totalMatches })}
          >
            View all {totalMatches} results in Price Tracker →
          </a>
        );
      })()}
    </div>
  );
}

function ResultRow({ item }: { item: any }) {
  if (!item || item.total_paid_gbp == null) return null;
  const imgUrl = item.cached_image_url ?? item.image_urls?.[0];
  const srcColor = SOURCE_COLORS[item.source] || "#888";

  const handleCopy = () => {
    const row = [item.sale_date, item.source, item.variant_code, item.grade_tier_code, item.total_paid_gbp, item.lot_ref].join("\t");
    navigator.clipboard.writeText(row);
    toast.success("Copied");
  };

  return (
    <div className="flex items-start gap-2">
      <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-black/30 flex items-center justify-center">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px]" style={{ color: "#555" }}>N/A</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{ color: "#e0d8c0" }}>{formatDate(item.sale_date)}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: srcColor, color: "#fff" }}>
            {item.source}
          </span>
        </div>
        <div style={{ color: "#999" }}>{item.cardback_code} · {item.variant_code}-{item.grade_tier_code}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-bold" style={{ color: "#C9A84C" }}>{formatGBP(item.total_paid_gbp)}</span>
          {item.lot_url && (
            <a href={item.lot_url} target="_blank" rel="noopener noreferrer" style={{ color: "#e0d8c0" }}>
              <ExternalLink size={12} />
            </a>
          )}
          <button onClick={handleCopy} style={{ color: "#e0d8c0" }}><Copy size={12} /></button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculatePrices, type ExtractedData } from "@/lib/screenshot-prices";
import ExtractionReviewForm from "./ExtractionReviewForm";

type SaveStatus = "pending" | "saved" | "failed" | "skipped-duplicate";

interface LotState {
  extracted: ExtractedData;
  isDuplicate: boolean;
  status: SaveStatus;
  error?: string;
}

export interface PagerOutcome {
  attempted: number;
  saved: number;
  failed: number;
  skippedAsDuplicate: number;
}

interface Props {
  list: ExtractedData[];
  truncatedAt?: number | null;
  /** Saves a single record. Returns true on success, false on failure (no throw). Caller logs activity. */
  onSaveOne: (record: Record<string, unknown>) => Promise<boolean>;
  /** Called once when the user finishes (after Save All, or when they close from completion). */
  onBatchComplete: (outcome: PagerOutcome) => void;
  onReset: () => void;
  onClose: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  Heritage: "#3B82F6",
  Hakes: "#F97316",
  LCG: "#14B8A6",
  Vectis: "#A855F7",
  CandT: "#F59E0B",
  eBay: "#22C55E",
  Facebook: "#60A5FA",
  Other: "#6B7280",
};

function fmtGBP(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function summary(e: ExtractedData) {
  const prices = calculatePrices(e);
  return {
    cardback: e.cardbackCode ?? "UNKNOWN",
    grade: e.gradeTierCode ?? "UNKNOWN",
    total: prices.totalPaidGBP,
    source: e.source ?? "Other",
  };
}

const MultiLotReviewPager = ({
  list,
  truncatedAt,
  onSaveOne,
  onBatchComplete,
  onReset,
  onClose,
}: Props) => {
  const [lots, setLots] = useState<LotState[]>(() =>
    list.map((extracted) => ({
      extracted,
      isDuplicate: false,
      status: "pending" as SaveStatus,
    })),
  );
  const [idx, setIdx] = useState(0);
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [completion, setCompletion] = useState<PagerOutcome | null>(null);

  // Per-lot duplicate pre-check (batched by source)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const candidates = list
        .map((e, i) => ({ i, lot_ref: e.lotRef, source: e.source }))
        .filter((c) => !!c.lot_ref && !!c.source);
      if (candidates.length === 0) return;

      const bySource = new Map<string, { i: number; lot_ref: string }[]>();
      for (const c of candidates) {
        const arr = bySource.get(c.source as string) ?? [];
        arr.push({ i: c.i, lot_ref: c.lot_ref as string });
        bySource.set(c.source as string, arr);
      }

      const dupIdx = new Set<number>();
      await Promise.all(
        Array.from(bySource.entries()).map(async ([source, items]) => {
          const refs = items.map((it) => it.lot_ref);
          const { data } = await supabase
            .from("lots")
            .select("lot_ref")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq("source", source as any)
            .in("lot_ref", refs);
          if (!data) return;
          const hits = new Set(data.map((d) => d.lot_ref));
          for (const it of items) {
            if (hits.has(it.lot_ref)) dupIdx.add(it.i);
          }
        }),
      );
      if (cancelled) return;
      setLots((prev) =>
        prev.map((l, i) => (dupIdx.has(i) ? { ...l, isDuplicate: true } : l)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [list]);

  const total = lots.length;
  const current = lots[idx];

  const counts = useMemo(() => {
    let saved = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;
    for (const l of lots) {
      if (l.status === "saved") saved++;
      else if (l.status === "failed") failed++;
      else if (l.status === "skipped-duplicate") skipped++;
      else pending++;
    }
    return { saved, failed, skipped, pending };
  }, [lots]);

  // Stable React key forces ExtractionReviewForm to remount when lot changes,
  // so its internal useState seeds from the new `extracted` prop.
  const formKey = `pager-lot-${idx}-${current?.extracted.lotRef ?? "noref"}`;

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(total - 1, i + 1));

  const handleSaveCurrent = async (record: Record<string, unknown>) => {
    if (savingCurrent || bulkSaving) return;
    setSavingCurrent(true);

    // Per-lot duplicate check at save time (in case state went stale)
    try {
      const lotRef = (record.lot_ref as string) ?? "";
      const source = record.source as string;
      if (lotRef && source) {
        const { data: existing } = await supabase
          .from("lots")
          .select("id")
          .eq("lot_ref", lotRef)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq("source", source as any)
          .limit(1);
        if (existing && existing.length > 0) {
          const proceed = confirm(
            `Lot ${idx + 1} of ${total}: a record with this lot ref + source already exists. Save anyway?`,
          );
          if (!proceed) {
            setLots((prev) =>
              prev.map((l, i) =>
                i === idx ? { ...l, status: "skipped-duplicate" } : l,
              ),
            );
            setSavingCurrent(false);
            // Auto-advance if there are more pending
            if (idx < total - 1) setIdx(idx + 1);
            return;
          }
        }
      }

      const ok = await onSaveOne(record);
      setLots((prev) =>
        prev.map((l, i) =>
          i === idx ? { ...l, status: ok ? "saved" : "failed" } : l,
        ),
      );
      if (ok && idx < total - 1) setIdx(idx + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setLots((prev) =>
        prev.map((l, i) => (i === idx ? { ...l, status: "failed", error: msg } : l)),
      );
    } finally {
      setSavingCurrent(false);
    }
  };

  const handleSaveAll = async () => {
    if (bulkSaving || savingCurrent) return;
    if (
      !confirm(
        `Save all ${counts.pending} remaining lot${counts.pending === 1 ? "" : "s"} without individual review?\n\nDuplicates will be skipped automatically.`,
      )
    ) {
      return;
    }

    setBulkSaving(true);
    setBulkProgress(0);

    let saved = 0;
    let failed = 0;
    let skippedAsDuplicate = lots.filter((l) => l.status === "skipped-duplicate").length;

    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i];
      if (lot.status !== "pending") continue;
      setIdx(i);
      setBulkProgress((p) => p + 1);

      // Skip flagged duplicates silently
      if (lot.isDuplicate) {
        skippedAsDuplicate++;
        setLots((prev) =>
          prev.map((l, j) => (j === i ? { ...l, status: "skipped-duplicate" } : l)),
        );
        continue;
      }

      // Build a default record from the extracted data (no user edits)
      const record = buildDefaultRecord(lot.extracted);
      try {
        const ok = await onSaveOne(record);
        if (ok) {
          saved++;
          setLots((prev) =>
            prev.map((l, j) => (j === i ? { ...l, status: "saved" } : l)),
          );
        } else {
          failed++;
          setLots((prev) =>
            prev.map((l, j) => (j === i ? { ...l, status: "failed" } : l)),
          );
        }
      } catch (e: unknown) {
        failed++;
        const msg = e instanceof Error ? e.message : "Save failed";
        setLots((prev) =>
          prev.map((l, j) => (j === i ? { ...l, status: "failed", error: msg } : l)),
        );
      }
    }

    const outcome: PagerOutcome = {
      attempted: saved + failed,
      saved,
      failed,
      skippedAsDuplicate,
    };
    setBulkSaving(false);
    setCompletion(outcome);
    onBatchComplete(outcome);
  };

  const handleFinish = () => {
    const outcome: PagerOutcome = {
      attempted: counts.saved + counts.failed,
      saved: counts.saved,
      failed: counts.failed,
      skippedAsDuplicate: counts.skipped,
    };
    setCompletion(outcome);
    onBatchComplete(outcome);
  };

  // ─────────────── Completion screen ───────────────
  if (completion) {
    return (
      <div className="space-y-4 py-4">
        <div className="text-center space-y-2">
          <div className="text-[#C9A84C] text-sm tracking-wider font-mono">
            Batch import complete
          </div>
          <div className="text-xs tracking-wider font-mono text-foreground">
            <span className="text-green-400">{completion.saved} saved</span>
            <span className="text-muted-foreground"> · </span>
            <span className={completion.failed > 0 ? "text-red-400" : "text-muted-foreground"}>
              {completion.failed} failed
            </span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-muted-foreground">
              {completion.skippedAsDuplicate} skipped (duplicates)
            </span>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 text-xs tracking-wider font-mono border border-[#C9A84C] text-[#C9A84C] rounded hover:bg-[#C9A84C15]"
            style={{ minHeight: 44 }}
          >
            Import another batch
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs tracking-wider font-mono bg-[#C9A84C] text-background rounded"
            style={{ minHeight: 44 }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ─────────────── Pager view ───────────────
  if (!current) return null;
  const s = summary(current.extracted);
  const sourceColor = SOURCE_COLORS[s.source] ?? "#6B7280";

  return (
    <div className="space-y-3">
      {/* Pager header */}
      <div className="flex items-center gap-2 px-3 py-2 border border-[#C9A84C33] rounded bg-[#C9A84C0A]">
        <button
          onClick={goPrev}
          disabled={idx === 0 || savingCurrent || bulkSaving}
          className="p-1.5 rounded text-[#C9A84C] hover:bg-[#C9A84C22] disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Previous lot"
          style={{ minWidth: 32, minHeight: 32 }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <div className="text-[#C9A84C] text-xs tracking-wider font-mono font-bold">
            Lot {idx + 1} of {total} — {s.cardback}, {s.grade}, {fmtGBP(s.total)}
          </div>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold"
              style={{
                backgroundColor: `${sourceColor}22`,
                color: sourceColor,
                border: `1px solid ${sourceColor}55`,
              }}
            >
              {s.source.toUpperCase()}
            </span>
            {current.isDuplicate && current.status === "pending" && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                Duplicate
              </span>
            )}
            {current.status === "saved" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
            {current.status === "failed" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                <XCircle className="w-3 h-3" /> Failed
              </span>
            )}
            {current.status === "skipped-duplicate" && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                Skipped
              </span>
            )}
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={idx >= total - 1 || savingCurrent || bulkSaving}
          className="p-1.5 rounded text-[#C9A84C] hover:bg-[#C9A84C22] disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Next lot"
          style={{ minWidth: 32, minHeight: 32 }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tally + Save All */}
      <div className="flex items-center justify-between gap-2 text-[10px] tracking-wider font-mono">
        <div className="text-muted-foreground">
          <span className="text-green-400">{counts.saved} saved</span>
          <span> · </span>
          <span className={counts.failed > 0 ? "text-red-400" : ""}>{counts.failed} failed</span>
          <span> · </span>
          <span className="text-amber-400">{counts.skipped} skipped</span>
          <span> · </span>
          <span>{counts.pending} pending</span>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={bulkSaving || savingCurrent || counts.pending === 0}
          className="px-3 py-1.5 text-[10px] tracking-wider font-mono border border-[#C9A84C] text-[#C9A84C] rounded hover:bg-[#C9A84C15] disabled:opacity-40"
          style={{ minHeight: 32 }}
        >
          {bulkSaving
            ? `Saving ${bulkProgress} of ${counts.pending}…`
            : `Save all (${counts.pending})`}
        </button>
        <button
          onClick={handleFinish}
          disabled={bulkSaving || savingCurrent}
          className="px-3 py-1.5 text-[10px] tracking-wider font-mono border border-border text-muted-foreground rounded hover:text-foreground disabled:opacity-40"
          style={{ minHeight: 32 }}
        >
          Finish
        </button>
      </div>

      {truncatedAt && idx === 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 border border-amber-400/40 rounded text-amber-400 text-[10px] tracking-wider font-mono bg-amber-400/5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Input contained more than {truncatedAt} lots — first {truncatedAt} shown. Paste the
            rest in a second batch.
          </span>
        </div>
      )}

      {/* The pre-filled review form for the current lot */}
      <ExtractionReviewForm
        key={formKey}
        extracted={current.extracted}
        saving={savingCurrent}
        onSave={handleSaveCurrent}
        onBack={goPrev}
        saveLabel={
          current.status === "saved"
            ? idx < total - 1
              ? "Re-save & next"
              : "Re-save"
            : idx < total - 1
              ? "Save & next"
              : "Save"
        }
        backLabel={idx === 0 ? "Back to capture" : "← Previous"}
      />
    </div>
  );
};

/** Build a default record without user edits — mirrors ExtractionReviewForm.handleSubmit. */
function buildDefaultRecord(extracted: ExtractedData): Record<string, unknown> {
  // Re-use the same logic the review form uses by importing classifier
  // (kept inline to avoid a circular import on the form itself).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { classifyLot } = require("@/lib/classify-lot");
  const text = [extracted.title, extracted.conditionNotes].filter(Boolean).join(" ");
  const classified = classifyLot(text);
  const pick = (claude: string | null | undefined, fallback: string) =>
    claude && claude !== "UNKNOWN" && claude !== "Other" ? claude : fallback;

  const era = pick(extracted.era, classified.era);
  const cardback = pick(extracted.cardbackCode, classified.cardback_code);
  const variant = pick(extracted.variantCode, classified.variant_code);
  const grade = pick(extracted.gradeTierCode, classified.grade_tier_code);
  const prices = calculatePrices(extracted);

  return {
    source: extracted.source ?? "Other",
    lot_ref: extracted.lotRef ?? "",
    lot_url: extracted.lotUrl ?? "",
    sale_date: extracted.saleDate || new Date().toISOString().slice(0, 10),
    capture_date: new Date().toISOString().slice(0, 10),
    era,
    cardback_code: cardback,
    variant_code: variant,
    grade_tier_code: grade,
    variant_grade_key: `${variant}-${grade}`,
    hammer_price_gbp: prices.hammerPriceGBP,
    buyers_premium_gbp: prices.buyersPremiumGBP,
    total_paid_gbp: prices.totalPaidGBP,
    usd_to_gbp_rate: prices.usdToGbpRate,
    condition_notes: extracted.conditionNotes ?? "",
    image_urls: extracted.imageUrls ?? [],
    price_status: prices.priceStatus === "ESTIMATE_ONLY" ? "ESTIMATE_ONLY" : "CONFIRMED",
  };
}

export default MultiLotReviewPager;

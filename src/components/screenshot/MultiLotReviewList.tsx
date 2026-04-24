import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, EyeOff, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculatePrices, type ExtractedData } from "@/lib/screenshot-prices";
import { classifyLot } from "@/lib/classify-lot";
import ExtractionReviewForm from "./ExtractionReviewForm";

type SaveStatus = "idle" | "saving" | "saved" | "failed" | "skipped";

interface RowState {
  id: string;
  extracted: ExtractedData;
  /** The committed record (post-Edit ▾ apply). Null until the user opens & applies the editor. */
  edited: Record<string, unknown> | null;
  checked: boolean;
  expanded: boolean;
  isDuplicate: boolean;
  saveStatus: SaveStatus;
  saveError?: string;
}

interface BatchOutcome {
  attempted: number;
  saved: number;
  failed: number;
  skippedAsDuplicate: number;
}

interface Props {
  list: ExtractedData[];
  truncatedAt?: number | null;
  /** Saves a single record. Returns true on success, false on failure (no throw). */
  onSaveOne: (record: Record<string, unknown>) => Promise<boolean>;
  /** Called once when the entire batch finishes (success or partial). */
  onBatchComplete: (outcome: BatchOutcome) => void;
  /** Reset / start another batch (back to capture). */
  onReset: () => void;
  /** Close the modal entirely. */
  onClose: () => void;
}

/** Build a default record (same shape as ExtractionReviewForm.handleSubmit) without user edits. */
function buildDefaultRecord(extracted: ExtractedData): Record<string, unknown> {
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

function SourceChip({ source }: { source: string | null | undefined }) {
  const s = source ?? "Other";
  const color = SOURCE_COLORS[s] ?? "#6B7280";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {s.toUpperCase()}
    </span>
  );
}

function fmtGBP(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

const MultiLotReviewList = ({
  list,
  truncatedAt,
  onSaveOne,
  onBatchComplete,
  onReset,
  onClose,
}: Props) => {
  const [rows, setRows] = useState<RowState[]>(() =>
    list.map((extracted, i) => ({
      id: `row-${i}-${extracted.lotRef ?? "noref"}`,
      extracted,
      edited: null,
      checked: true,
      expanded: false,
      isDuplicate: false,
      saveStatus: "idle" as SaveStatus,
    })),
  );
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [batchInProgress, setBatchInProgress] = useState(false);
  const [batchProgressIdx, setBatchProgressIdx] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [completion, setCompletion] = useState<BatchOutcome | null>(null);

  // Run duplicate check on mount — single batched query for all rows that have a lot_ref + source.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const candidates = list
        .map((e, i) => ({ i, lot_ref: e.lotRef, source: e.source }))
        .filter((c) => !!c.lot_ref && !!c.source);
      if (candidates.length === 0) return;

      // Group by source so we can issue one query per source with .in() on lot_ref.
      const bySource = new Map<string, { i: number; lot_ref: string }[]>();
      for (const c of candidates) {
        const arr = bySource.get(c.source as string) ?? [];
        arr.push({ i: c.i, lot_ref: c.lot_ref as string });
        bySource.set(c.source as string, arr);
      }

      const dupRowIdx = new Set<number>();
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
            if (hits.has(it.lot_ref)) dupRowIdx.add(it.i);
          }
        }),
      );

      if (cancelled) return;
      setRows((prev) =>
        prev.map((r, i) =>
          dupRowIdx.has(i) ? { ...r, isDuplicate: true, checked: false } : r,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [list]);

  const visibleRows = useMemo(
    () => (hideDuplicates ? rows.filter((r) => !r.isDuplicate) : rows),
    [rows, hideDuplicates],
  );

  const selectedCount = rows.filter((r) => r.checked).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const allFlaggedAsDuplicate = duplicateCount === rows.length && rows.length > 0;

  const toggleRow = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };
  const toggleExpand = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)));
  };
  const setAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, checked })));
  };
  const applyEdit = (id: string, edited: Record<string, unknown>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, edited, expanded: false } : r)),
    );
  };

  const runBatchSave = async () => {
    const toSave = rows.filter((r) => r.checked);
    if (toSave.length === 0) return;
    setBatchInProgress(true);
    setBatchTotal(toSave.length);
    setBatchProgressIdx(0);

    let saved = 0;
    let failed = 0;
    const skippedAsDuplicate = rows.filter((r) => r.isDuplicate && !r.checked).length;

    for (let i = 0; i < toSave.length; i++) {
      const row = toSave[i];
      setBatchProgressIdx(i + 1);
      // Mark as saving in-place
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, saveStatus: "saving" } : r)),
      );
      const record = row.edited ?? buildDefaultRecord(row.extracted);
      try {
        const ok = await onSaveOne(record);
        if (ok) {
          saved++;
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, saveStatus: "saved" } : r)),
          );
        } else {
          failed++;
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, saveStatus: "failed" } : r)),
          );
        }
      } catch (e: unknown) {
        failed++;
        const msg = e instanceof Error ? e.message : "Save failed";
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, saveStatus: "failed", saveError: msg } : r,
          ),
        );
      }
    }

    const outcome: BatchOutcome = {
      attempted: toSave.length,
      saved,
      failed,
      skippedAsDuplicate,
    };
    setCompletion(outcome);
    setBatchInProgress(false);
    onBatchComplete(outcome);
  };

  // ─────────────────────── Completion screen ────────────────────────
  if (completion) {
    return (
      <div className="space-y-4 py-4">
        <div className="text-center space-y-2">
          <div className="text-[#C9A84C] text-sm tracking-wider font-mono">
            Batch import complete
          </div>
          <div className="text-xs tracking-wider font-mono text-foreground">
            <span className="text-green-400">{completion.saved} records saved</span>
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
          >
            Import another batch
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs tracking-wider font-mono bg-[#C9A84C] text-background rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────── Review list ────────────────────────
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <div className="text-[#C9A84C] text-sm tracking-wider font-mono">
          {rows.length} lots extracted — review and save
        </div>
        <div className="text-[10px] text-muted-foreground tracking-wider font-mono">
          Tick the lots you want to save. Uncheck any duplicates or bad extractions.
        </div>
      </div>

      {truncatedAt && (
        <div className="flex items-center gap-2 px-2 py-1.5 border border-amber-400/40 rounded text-amber-400 text-[10px] tracking-wider font-mono bg-amber-400/5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Input contained more than {truncatedAt} lots — first {truncatedAt} shown. Paste the
            rest in a second batch.
          </span>
        </div>
      )}

      {allFlaggedAsDuplicate && (
        <div className="flex items-center gap-2 px-2 py-1.5 border border-amber-400/40 rounded text-amber-400 text-[10px] tracking-wider font-mono bg-amber-400/5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            All extracted lots already exist in the database. Tick any you want to re-import
            anyway.
          </span>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
        {visibleRows.map((row) => {
          const idx = rows.findIndex((r) => r.id === row.id) + 1;
          const e = row.extracted;
          const totalGBP = row.edited
            ? (row.edited.total_paid_gbp as number)
            : calculatePrices(e).totalPaidGBP;
          const cardback = row.edited
            ? (row.edited.cardback_code as string)
            : (e.cardbackCode ?? "UNKNOWN");
          const grade = row.edited
            ? (row.edited.grade_tier_code as string)
            : (e.gradeTierCode ?? "UNKNOWN");

          return (
            <div
              key={row.id}
              className={`border rounded ${
                row.isDuplicate ? "border-red-500/40 bg-red-500/5" : "border-border"
              }`}
            >
              {/* Summary row */}
              <div className="flex items-center gap-2 p-2">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => toggleRow(row.id)}
                  disabled={batchInProgress}
                  className="w-4 h-4 accent-[#C9A84C]"
                  aria-label={`Include lot ${idx}`}
                />
                <span className="text-[10px] text-muted-foreground tracking-wider font-mono w-6 shrink-0">
                  {idx}.
                </span>
                <SourceChip source={e.source} />
                <span className="text-[11px] font-mono text-foreground">{cardback}</span>
                <span className="text-[10px] text-muted-foreground font-mono">·</span>
                <span className="text-[10px] font-mono text-muted-foreground">{grade}</span>
                <span className="text-[10px] text-muted-foreground font-mono">·</span>
                <span className="text-[11px] font-mono text-[#C9A84C] font-bold">
                  {fmtGBP(totalGBP)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">·</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {e.saleDate ?? "no date"}
                </span>

                <div className="flex-1 min-w-0 truncate text-[10px] text-muted-foreground font-mono ml-2">
                  {e.conditionNotes ?? e.title ?? ""}
                </div>

                {row.isDuplicate && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold bg-red-500/20 text-red-400 border border-red-500/40 whitespace-nowrap">
                    Duplicate
                  </span>
                )}

                {row.saveStatus === "saving" && (
                  <span className="text-[10px] font-mono text-amber-400 animate-pulse">…</span>
                )}
                {row.saveStatus === "saved" && (
                  <span className="text-[10px] font-mono text-green-400">✓</span>
                )}
                {row.saveStatus === "failed" && (
                  <span className="text-[10px] font-mono text-red-400" title={row.saveError}>
                    ✕
                  </span>
                )}

                <button
                  onClick={() => toggleExpand(row.id)}
                  disabled={batchInProgress}
                  className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-mono text-[#C9A84C] hover:underline shrink-0"
                  aria-expanded={row.expanded}
                  aria-label={row.expanded ? "Collapse editor" : "Expand editor"}
                >
                  {row.expanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Edit
                </button>
              </div>

              {row.expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <ExtractionReviewForm
                    extracted={row.extracted}
                    saving={false}
                    onBack={() => toggleExpand(row.id)}
                    onSave={(record) => applyEdit(row.id, record)}
                    saveLabel="Apply changes"
                    backLabel="Cancel"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <button
          onClick={() => setAll(selectedCount === rows.length ? false : true)}
          disabled={batchInProgress}
          className="text-[10px] font-mono text-[#C9A84C] hover:underline"
        >
          {selectedCount === rows.length ? "Deselect all" : "Select all"}
        </button>
        <button
          onClick={() => setHideDuplicates((v) => !v)}
          disabled={batchInProgress || duplicateCount === 0}
          className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-[#C9A84C] disabled:opacity-40"
        >
          {hideDuplicates ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {hideDuplicates ? "Show duplicates" : "Hide duplicates"}
        </button>

        <div className="flex-1 text-center text-[10px] font-mono text-muted-foreground">
          {batchInProgress ? (
            <span className="text-amber-400">
              Saving {batchProgressIdx} of {batchTotal}…
            </span>
          ) : (
            <>
              {selectedCount} of {rows.length} selected
              {hideDuplicates && duplicateCount > 0
                ? ` (${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} hidden)`
                : ""}
            </>
          )}
        </div>

        <button
          onClick={runBatchSave}
          disabled={selectedCount === 0 || batchInProgress}
          className="px-4 py-2 text-xs tracking-wider font-mono bg-[#C9A84C] text-background rounded disabled:opacity-40"
        >
          {batchInProgress
            ? "Saving…"
            : `Save ${selectedCount} record${selectedCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
};

export type { BatchOutcome };
export default MultiLotReviewList;

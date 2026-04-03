import React, { useState, useMemo, useEffect, useRef } from "react";
import type { Lot } from "@/lib/db";
import type { Currency } from "@/components/FilterBar";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, Pencil, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Columns3 } from "lucide-react";
import { toast } from "sonner";
import LotFormModal from "@/components/LotFormModal";
import popCounts, { type PopEntry } from "@/data/popCounts";
import { Checkbox } from "@/components/ui/checkbox";
import SourceBadge from "@/components/SourceBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/* ── image helpers ── */
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

function NoImagePlaceholder() {
  return (
    <div
      className="w-8 h-10 flex items-center justify-center text-[6px] font-bold tracking-wider leading-tight text-center"
      style={{ background: "#1a1a1a", border: "1px solid #C9A84C", color: "#C9A84C" }}
    >
      No Image
    </div>
  );
}

/* ── types ── */
type SortKey = "sale_date" | "created_at" | "variant_grade_key" | "total_paid_gbp" | "hammer_price_gbp" | "buyers_premium_gbp";
type SortDir = "asc" | "desc";

// All toggleable column keys
type ColId = "sale_date" | "created_at" | "variant_grade" | "total" | "hammer" | "bp" | "cardback" | "pop" | "source" | "lot_ref" | "notes" | "img" | "act";

interface LotsTableProps {
  lots: Lot[];
  onChanged: () => void;
  onCopyRow?: (lot: Lot) => void;
  onSelectLot?: (lot: Lot) => void;
  currency?: Currency;
  highlightLotId?: string | null;
}

/* ── constants ── */
const USD_SOURCES = ["Heritage", "Hakes"];
const NOTABLE_THRESHOLD = 5000;

const ERA_COLORS: Record<string, string> = {
  SW: "#4a7fa5", ESB: "#8a7f6e", ROTJ: "#a04040", POTF: "#C9A84C", UNKNOWN: "#555",
};

// Default hidden columns
const DEFAULT_HIDDEN: ColId[] = ["created_at", "bp"];
// Additional columns hidden below 1024px
const NARROW_HIDDEN: ColId[] = ["hammer", "pop"];

/* ── small components ── */
function toUsd(gbp: number, rate: number): number {
  return rate > 0 ? Math.round(gbp / rate) : 0;
}

function CurrencyBadge({ source }: { source: string }) {
  const isOrig = USD_SOURCES.includes(source);
  return (
    <span className={`ml-1 text-[8px] tracking-widest font-bold px-1 py-0.5 rounded ${isOrig ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
      {isOrig ? "ORIG USD" : "EST USD"}
    </span>
  );
}

function PopBadge({ variantCode }: { variantCode: string }) {
  const entry: PopEntry | undefined = popCounts[variantCode];
  if (!entry) return null;
  if (entry.pop !== null && entry.confidence === "HIGH") {
    return <span className="inline-block text-[8px] tracking-widest font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary" title={`Population: ${entry.pop} known graded examples — ${entry.source}`}>★ POP {entry.pop}</span>;
  }
  if (entry.confidence === "LOW") {
    return <span className="inline-block text-[8px] tracking-widest font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400" title={`Population estimate only — ${entry.source}`}>POP ?</span>;
  }
  return <span className="inline-block text-[8px] tracking-widest font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Population unknown — approximate">POP ~?</span>;
}

function EraBadge({ era }: { era: string }) {
  const bg = ERA_COLORS[era] ?? ERA_COLORS.UNKNOWN;
  return <span className="inline-block px-1.5 py-0.5 text-[9px] tracking-widest font-bold rounded" style={{ backgroundColor: bg, color: "#fff" }}>{era}</span>;
}

/* ── column definitions ── */
const COL_LABELS: Record<ColId, string> = {
  sale_date: "Sale Date",
  created_at: "Date/Time Added",
  variant_grade: "Variant-Grade",
  total: "Total",
  hammer: "Hammer",
  bp: "BP",
  cardback: "Cardback",
  pop: "Pop",
  source: "Source",
  lot_ref: "Lot Ref",
  notes: "Notes",
  img: "Img",
  act: "Actions",
};

/* ── main component ── */
const LotsTable = ({ lots, onChanged, onCopyRow, onSelectLot, currency = "GBP", highlightLotId }: LotsTableProps) => {
  const [editLot, setEditLot] = useState<Lot | null>(null);
  const [deleteLot, setDeleteLot] = useState<Lot | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("sale_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<ColId>>(new Set(DEFAULT_HIDDEN));
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightLotId) {
      setFlashId(highlightLotId);
      // Scroll after a brief delay to let the DOM render
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      // Clear flash after animation
      const timer = setTimeout(() => setFlashId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightLotId]);

  const isMobile = useIsMobile();
  const isNarrow = typeof window !== "undefined" && window.innerWidth < 1024;

  // Compute effective visible columns
  const isVisible = (col: ColId) => {
    if (hiddenCols.has(col)) return false;
    if (isNarrow && NARROW_HIDDEN.includes(col)) return !hiddenCols.has(col) ? true : false;
    // For narrow screens, auto-hide hammer/pop unless user explicitly toggled them on
    return true;
  };

  // On narrow screens, auto-hide hammer and pop unless user explicitly showed them
  const effectiveHidden = useMemo(() => {
    const set = new Set(hiddenCols);
    if (isNarrow) {
      NARROW_HIDDEN.forEach((c) => {
        // Only auto-hide if user hasn't explicitly toggled
        if (!hiddenCols.has(c) && DEFAULT_HIDDEN.indexOf(c) === -1) {
          // Check: if user toggled it on, respect that. We track this via hiddenCols not containing it.
          // For narrow auto-hide, we need separate tracking. Simplify: on narrow, always hide these unless user toggled.
        }
      });
    }
    return set;
  }, [hiddenCols, isNarrow]);

  // Simpler: track user overrides separately
  const [userShown, setUserShown] = useState<Set<ColId>>(new Set());

  const colVisible = (col: ColId): boolean => {
    if (userShown.has(col)) return true;
    if (hiddenCols.has(col)) return false;
    if (isNarrow && NARROW_HIDDEN.includes(col)) return false;
    return true;
  };

  const toggleCol = (col: ColId) => {
    // If currently visible, hide it
    if (colVisible(col)) {
      setUserShown((prev) => { const n = new Set(prev); n.delete(col); return n; });
      setHiddenCols((prev) => { const n = new Set(prev); n.add(col); return n; });
    } else {
      // Show it
      setHiddenCols((prev) => { const n = new Set(prev); n.delete(col); return n; });
      setUserShown((prev) => { const n = new Set(prev); n.add(col); return n; });
    }
  };

  const sorted = useMemo(() => {
    const copy = [...lots];
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] as any;
      let bv: string | number = b[sortKey] as any;
      if (["total_paid_gbp", "hammer_price_gbp", "buyers_premium_gbp"].includes(sortKey)) {
        av = Number(av); bv = Number(bv);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [lots, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((l) => l.id)));
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("lots").delete().in("id", ids);
    if (error) toast.error("Bulk delete failed: " + error.message);
    else { toast.success(`Deleted ${ids.length} lot(s)`); setSelectedIds(new Set()); onChanged(); }
    setBulkDeleting(false);
    setShowBulkConfirm(false);
  };

  const copyRow = (l: Lot) => {
    const fields = [l.capture_date, l.sale_date, l.source, (l as any).era ?? "", (l as any).cardback_code ?? "", l.lot_ref, l.variant_code, l.grade_tier_code, l.variant_grade_key, l.hammer_price_gbp, l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate, l.condition_notes];
    navigator.clipboard.writeText(fields.join("\t"));
    toast.success("Row copied to clipboard");
    onCopyRow?.(l);
  };

  const handleDelete = async () => {
    if (!deleteLot) return;
    const { error } = await supabase.from("lots").delete().eq("id", deleteLot.id);
    if (error) toast.error("Delete failed: " + error.message);
    else { toast.success("Lot deleted"); onChanged(); }
    setDeleteLot(null);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowDown className="w-2.5 h-2.5 opacity-20 inline ml-1" />;
    return sortDir === "asc" ? <ArrowUp className="w-2.5 h-2.5 text-primary inline ml-1" /> : <ArrowDown className="w-2.5 h-2.5 text-primary inline ml-1" />;
  };

  if (lots.length === 0) {
    return <div className="px-6 py-12 text-center text-muted-foreground text-sm tracking-wider">NO RECORDS MATCH CURRENT FILTERS</div>;
  }

  const isUSD = currency === "USD";
  const sym = isUSD ? "$" : "£";

  const fmtPrice = (gbp: number, rate: number) => {
    if (isUSD) return `$${toUsd(gbp, rate).toLocaleString("en-US")}`;
    return `£${Number(gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
  };

  const allSelected = selectedIds.size === sorted.length && sorted.length > 0;
  const someSelected = selectedIds.size > 0;

  // All column IDs for the columns toggle
  const ALL_COLS: ColId[] = ["sale_date", "created_at", "variant_grade", "total", "hammer", "bp", "cardback", "pop", "source", "lot_ref", "notes", "img", "act"];

  // Hidden fields for expanded row
  const getHiddenFields = (l: Lot) => {
    const fields: { label: string; value: React.ReactNode }[] = [];
    if (!colVisible("created_at")) fields.push({ label: "Added", value: `${new Date(l.created_at).toLocaleDateString("en-GB")} ${new Date(l.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` });
    if (!colVisible("hammer")) fields.push({ label: "Hammer", value: fmtPrice(Number(l.hammer_price_gbp), Number(l.usd_to_gbp_rate)) });
    if (!colVisible("bp")) fields.push({ label: "BP", value: fmtPrice(Number(l.buyers_premium_gbp), Number(l.usd_to_gbp_rate)) });
    if (!colVisible("pop")) fields.push({ label: "POP", value: <PopBadge variantCode={l.variant_code} /> });
    if (!colVisible("cardback")) fields.push({ label: "Cardback", value: <><EraBadge era={(l as any).era ?? "UNKNOWN"} /> <span className="text-muted-foreground">{(l as any).cardback_code ?? "—"}</span></> });
    if (!colVisible("source")) fields.push({ label: "Source", value: <SourceBadge source={l.source} /> });
    if (!colVisible("lot_ref")) fields.push({ label: "Lot Ref", value: l.lot_url ? <a href={l.lot_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">{l.lot_ref} <ExternalLink className="w-3 h-3" /></a> : l.lot_ref });
    if (!colVisible("notes")) fields.push({ label: "Notes", value: l.condition_notes || "—" });
    return fields;
  };

  const handleRowClick = (l: Lot) => {
    if (isMobile) {
      setExpandedRowId((prev) => prev === l.id ? null : l.id);
    } else {
      onSelectLot?.(l);
    }
  };

  // Count visible columns for colspan
  const visibleColCount = ALL_COLS.filter(colVisible).length + 1; // +1 for checkbox

  // Check if truly mobile (<768px)
  const isMobileCard = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <>
      {/* Columns toggle button */}
      <div className="px-4 md:px-6 py-1.5 border-b border-border flex items-center justify-between">

      {/* Mobile card layout */}
      {isMobileCard ? (
        <div className="px-3 py-2 space-y-2">
          {sorted.map((l) => {
            const isExpanded = expandedRowId === l.id;
            const imgUrl = getLotImageUrl(l.image_urls);
            return (
              <div
                key={l.id}
                ref={l.id === flashId ? highlightRef : undefined}
                onClick={() => setExpandedRowId(isExpanded ? null : l.id)}
                className={`border border-border rounded p-3 cursor-pointer transition-colors hover:bg-secondary/50 ${l.id === flashId ? "animate-pulse bg-primary/20" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-primary font-bold text-xs">{l.variant_grade_key}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(l.sale_date).toLocaleDateString("en-GB")}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-primary font-bold text-xs">
                      {(l as any).price_status === "ESTIMATE_ONLY" ? (
                        <span className="text-amber-400 text-[10px]">EST {sym}{Number((l as any).estimate_low_gbp ?? 0).toLocaleString()}–{sym}{Number((l as any).estimate_high_gbp ?? 0).toLocaleString()}</span>
                      ) : (l as any).price_status === "UNSOLD" ? (
                        <span className="text-muted-foreground text-[10px]">UNSOLD</span>
                      ) : fmtPrice(Number(l.total_paid_gbp), Number(l.usd_to_gbp_rate))}
                    </div>
                  </div>
                  <SourceBadge source={l.source} size="sm" className="scale-[0.5] origin-right shrink-0" />
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    {imgUrl && (
                      <img src={imgUrl} alt="lot" className="w-full max-w-[200px] h-auto object-cover border border-border rounded" />
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                      <div><span className="text-muted-foreground">Era:</span> <EraBadge era={(l as any).era ?? "UNKNOWN"} /></div>
                      <div><span className="text-muted-foreground">Cardback:</span> <span>{(l as any).cardback_code ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Hammer:</span> {fmtPrice(Number(l.hammer_price_gbp), Number(l.usd_to_gbp_rate))}</div>
                      <div><span className="text-muted-foreground">BP:</span> {fmtPrice(Number(l.buyers_premium_gbp), Number(l.usd_to_gbp_rate))}</div>
                      <div><span className="text-muted-foreground">Pop:</span> <PopBadge variantCode={l.variant_code} /></div>
                      <div><span className="text-muted-foreground">Lot:</span> {l.lot_url ? <a href={l.lot_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{l.lot_ref}</a> : l.lot_ref}</div>
                    </div>
                    {l.condition_notes && (
                      <div className="text-[10px] text-muted-foreground">{l.condition_notes}</div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); copyRow(l); }} className="text-muted-foreground hover:text-primary transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditLot(l); }} className="text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteLot(l); }} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onSelectLot?.(l); }} className="text-muted-foreground hover:text-primary transition-colors text-[9px] tracking-wider ml-auto">View Details →</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
      /* Desktop table */
        <div className="flex items-center gap-3">
          {someSelected && (
            <>
              <span className="text-[10px] tracking-wider text-primary font-bold">{selectedIds.size} selected</span>
              <button onClick={() => setShowBulkConfirm(true)} className="text-[10px] tracking-wider px-3 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors font-bold">Delete Selected</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors">Clear</button>
            </>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-[10px] tracking-wider text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/50">
              <Columns3 className="w-3 h-3" /> Columns
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2 bg-card border-border">
            <div className="space-y-1">
              {ALL_COLS.map((col) => (
                <label key={col} className="flex items-center gap-2 text-[10px] tracking-wider cursor-pointer hover:text-primary transition-colors py-0.5">
                  <Checkbox
                    checked={colVisible(col)}
                    onCheckedChange={() => toggleCol(col)}
                    className="border-muted-foreground h-3 w-3"
                  />
                  {COL_LABELS[col]}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground tracking-wider text-left">
              <th className="px-3 py-2 w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} className="border-muted-foreground" />
              </th>
              {colVisible("sale_date") && <th className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleSort("sale_date")}>Sale Date<SortIcon col="sale_date" /></th>}
              {colVisible("created_at") && <th className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleSort("created_at")}>Date/Time Added<SortIcon col="created_at" /></th>}
              {colVisible("variant_grade") && <th className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleSort("variant_grade_key")}>Variant-Grade<SortIcon col="variant_grade_key" /></th>}
              {colVisible("total") && <th className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors text-right" onClick={() => toggleSort("total_paid_gbp")}>Total ({sym}){isUSD ? " (USD)" : ""}<SortIcon col="total_paid_gbp" /></th>}
              {colVisible("hammer") && <th className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors text-right" onClick={() => toggleSort("hammer_price_gbp")}>Hammer{isUSD ? " (USD)" : ""}<SortIcon col="hammer_price_gbp" /></th>}
              {colVisible("bp") && <th className="px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors text-right" onClick={() => toggleSort("buyers_premium_gbp")}>BP{isUSD ? " (USD)" : ""}<SortIcon col="buyers_premium_gbp" /></th>}
              {colVisible("cardback") && <th className="px-3 py-2">Cardback</th>}
              {colVisible("pop") && <th className="px-3 py-2">Pop</th>}
              {colVisible("source") && <th className="px-3 py-2">Source</th>}
              {colVisible("lot_ref") && <th className="px-3 py-2">Lot Ref</th>}
              {colVisible("notes") && <th className="px-3 py-2">Notes</th>}
              {colVisible("img") && <th className="px-3 py-2">Img</th>}
              {colVisible("act") && <th className="px-3 py-2">Act</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => {
              const isExpanded = expandedRowId === l.id;
              const hiddenFields = getHiddenFields(l);
              return (
                <React.Fragment key={l.id}>
                  <tr
                    ref={l.id === flashId ? highlightRef : undefined}
                    onClick={() => handleRowClick(l)}
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${Number(l.total_paid_gbp) >= NOTABLE_THRESHOLD ? "border-l-2 border-l-primary" : ""} ${selectedIds.has(l.id) ? "bg-secondary/40" : ""} ${l.id === flashId ? "animate-pulse bg-primary/20" : ""}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} className="border-muted-foreground" />
                    </td>
                    {colVisible("sale_date") && <td className="px-3 py-2 whitespace-nowrap">{new Date(l.sale_date).toLocaleDateString("en-GB")}</td>}
                    {colVisible("created_at") && (
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString("en-GB")}{" "}
                        <span className="text-[9px]">{new Date(l.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                      </td>
                    )}
                    {colVisible("variant_grade") && <td className="px-3 py-2 text-primary font-bold whitespace-nowrap">{l.variant_grade_key}</td>}
                    {colVisible("total") && (
                      <td className="px-3 py-2 text-right text-primary font-bold whitespace-nowrap">
                        {(l as any).price_status === "ESTIMATE_ONLY" ? (
                          <span className="flex items-center justify-end gap-1.5">
                            <span className="text-[8px] tracking-widest font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">EST</span>
                            <span className="text-amber-400">
                              {sym}{isUSD ? toUsd(Number((l as any).estimate_low_gbp ?? 0), Number(l.usd_to_gbp_rate)).toLocaleString() : Number((l as any).estimate_low_gbp ?? 0).toLocaleString("en-GB")}
                              –{sym}{isUSD ? toUsd(Number((l as any).estimate_high_gbp ?? 0), Number(l.usd_to_gbp_rate)).toLocaleString() : Number((l as any).estimate_high_gbp ?? 0).toLocaleString("en-GB")}
                            </span>
                          </span>
                        ) : (l as any).price_status === "UNSOLD" ? (
                          <span className="flex items-center justify-end">
                            <span className="text-[8px] tracking-widest font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground">UNSOLD</span>
                          </span>
                        ) : (
                          <>{fmtPrice(Number(l.total_paid_gbp), Number(l.usd_to_gbp_rate))}{isUSD && <CurrencyBadge source={l.source} />}</>
                        )}
                      </td>
                    )}
                    {colVisible("hammer") && <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPrice(Number(l.hammer_price_gbp), Number(l.usd_to_gbp_rate))}</td>}
                    {colVisible("bp") && <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPrice(Number(l.buyers_premium_gbp), Number(l.usd_to_gbp_rate))}</td>}
                    {colVisible("cardback") && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EraBadge era={(l as any).era ?? "UNKNOWN"} />
                        <span className="ml-1.5 text-muted-foreground">{(l as any).cardback_code ?? "—"}</span>
                      </td>
                    )}
                    {colVisible("pop") && <td className="px-3 py-2"><PopBadge variantCode={l.variant_code} /></td>}
                    {colVisible("source") && <td className="px-3 py-2"><SourceBadge source={l.source} /></td>}
                    {colVisible("lot_ref") && (
                      <td className="px-3 py-2">
                        {l.lot_url ? (
                          <a href={l.lot_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
                            {l.lot_ref} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : l.lot_ref}
                      </td>
                    )}
                    {colVisible("notes") && <td className="px-3 py-2 max-w-[200px] truncate" title={l.condition_notes}>{l.condition_notes}</td>}
                    {colVisible("img") && (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const imgUrl = getLotImageUrl(l.image_urls);
                          return imgUrl ? (
                            <button onClick={() => setLightboxUrl(imgUrl)}>
                              <img src={imgUrl} alt="lot" className="w-8 h-10 object-cover border border-border hover:border-primary transition-colors"
                                onError={(e) => { const t = e.currentTarget; t.style.display = "none"; const p = document.createElement("div"); p.className = "w-8 h-10 flex items-center justify-center text-center font-bold tracking-wider leading-tight"; p.style.cssText = "width:32px;height:40px;background:#1a1a1a;border:1px solid #C9A84C;color:#C9A84C;font-size:6px;display:flex;align-items:center;justify-content:center;"; p.textContent = "No Image"; t.parentElement?.appendChild(p); }}
                              />
                            </button>
                          ) : <NoImagePlaceholder />;
                        })()}
                      </td>
                    )}
                    {colVisible("act") && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); copyRow(l); }} className="text-muted-foreground hover:text-primary transition-colors" title="Copy row"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditLot(l); }} className="text-muted-foreground hover:text-primary transition-colors" title="Edit lot"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteLot(l); }} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete lot"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {/* Expanded row for mobile / hidden fields */}
                  {isExpanded && hiddenFields.length > 0 && (
                    <tr className="bg-secondary/20 border-b border-border/50">
                      <td colSpan={visibleColCount} className="px-4 py-2">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          {hiddenFields.map((f) => (
                            <div key={f.label} className="flex items-center gap-2">
                              <span className="text-[9px] tracking-widest text-muted-foreground w-16 shrink-0">{f.label.toUpperCase()}</span>
                              <span>{f.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); copyRow(l); }} className="text-muted-foreground hover:text-primary transition-colors" title="Copy row"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditLot(l); }} className="text-muted-foreground hover:text-primary transition-colors" title="Edit lot"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteLot(l); }} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete lot"><Trash2 className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); onSelectLot?.(l); }} className="text-muted-foreground hover:text-primary transition-colors text-[9px] tracking-wider ml-2">View Details →</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-1.5 border-b border-border text-[9px] text-muted-foreground tracking-wider flex items-center gap-4">
        <span><span className="text-primary">★ Gold</span> = confirmed Pop</span>
        <span><span className="text-amber-400">Amber</span> = estimated</span>
        <span>Grey = unknown</span>
      </div>

      <LotFormModal open={!!editLot} onOpenChange={(o) => { if (!o) setEditLot(null); }} onSaved={onChanged} editLot={editLot} />

      <AlertDialog open={!!deleteLot} onOpenChange={(o) => { if (!o) setDeleteLot(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary tracking-wider text-sm">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs tracking-wider">
              Delete lot <span className="text-primary font-bold">{deleteLot?.variant_grade_key}</span> ({deleteLot?.lot_ref})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs tracking-wider">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground text-xs tracking-wider hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkConfirm} onOpenChange={(o) => { if (!o) setShowBulkConfirm(false); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary tracking-wider text-sm">Confirm Bulk Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs tracking-wider">
              Delete <span className="text-primary font-bold">{selectedIds.size}</span> selected lot(s)? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs tracking-wider">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground text-xs tracking-wider hover:bg-destructive/90">
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="lot zoom" className="max-w-[90vw] max-h-[90vh] object-contain border border-border rounded shadow-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
};

export default LotsTable;

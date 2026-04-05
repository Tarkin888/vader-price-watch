import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { classifyLot, deriveFromVariantCode } from "@/lib/classify-lot";

const SOURCES = ["Heritage", "Hakes", "LCG", "Vectis", "CandT"] as const;
const ERAS = ["SW", "ESB", "ROTJ", "POTF"] as const;
const CARDBACK_CODES = [
  "SW-12", "SW-12A", "SW-12A-DT", "SW-12B", "SW-12B-DT", "SW-12C", "SW-12-DT",
  "SW-20", "SW-21",
  "ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48",
  "ROTJ-48", "ROTJ-65", "ROTJ-65A", "ROTJ-65B", "ROTJ-65D", "ROTJ-65-VP",
  "ROTJ-70", "ROTJ-77", "ROTJ-79", "ROTJ-79A", "ROTJ-79B",
  "POTF-92",
  "CAN", "PAL", "PAL-TL", "MEX", "PBP", "TAK", "TT", "HAR", "CLIP",
];

interface DbStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  earliest: string | null;
  latest: string | null;
}

interface BadRow {
  lot_ref: string;
  source: string;
  extra: string;
}

const AdminDataTab = () => {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bad data
  const [nullDates, setNullDates] = useState<{ count: number; rows: BadRow[] }>({ count: 0, rows: [] });
  const [suspPrices, setSuspPrices] = useState<{ count: number; rows: BadRow[] }>({ count: 0, rows: [] });
  const [missingImages, setMissingImages] = useState<{ count: number; rows: BadRow[] }>({ count: 0, rows: [] });
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  // Dedup
  const [dupGroups, setDupGroups] = useState<{ lot_ref: string; source: string; count: number }[] | null>(null);

  // Quick add
  const [qa, setQa] = useState({
    source: "Heritage", lot_ref: "", lot_url: "", sale_date: "", era: "",
    cardback_code: "", variant_code: "", grade_tier_code: "",
    hammer_price_gbp: "", buyers_premium_gbp: "", total_paid_gbp: "",
    condition_notes: "", image_urls: "",
  });
  const [qaErrors, setQaErrors] = useState<Record<string, string>>({});
  const [qaSaving, setQaSaving] = useState(false);

  // Bulk delete
  const [delSource, setDelSource] = useState("Heritage");
  const [delConfirm, setDelConfirm] = useState("");
  const [delOpen, setDelOpen] = useState(false);

  // Reclassify
  const [reclassifying, setReclassifying] = useState(false);

  // Import
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);
  const [importing, setImporting] = useState(false);

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

      const [totalRes, weekRes, monthRes, earliestRes, latestRes] = await Promise.all([
        supabase.from("lots").select("id", { count: "exact", head: true }),
        supabase.from("lots").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
        supabase.from("lots").select("id", { count: "exact", head: true }).gte("created_at", monthAgo.toISOString()),
        supabase.from("lots").select("sale_date").order("sale_date", { ascending: true }).limit(1),
        supabase.from("lots").select("sale_date").order("sale_date", { ascending: false }).limit(1),
      ]);

      setStats({
        total: totalRes.count ?? 0,
        thisWeek: weekRes.count ?? 0,
        thisMonth: monthRes.count ?? 0,
        earliest: earliestRes.data?.[0]?.sale_date ?? null,
        latest: latestRes.data?.[0]?.sale_date ?? null,
      });

      // Bad data counts
      const [nullDateRes, suspRes, imgRes] = await Promise.all([
        supabase.from("lots").select("lot_ref, source, sale_date").is("sale_date", null).limit(20),
        supabase.from("lots").select("lot_ref, source, total_paid_gbp").or("total_paid_gbp.lt.5,total_paid_gbp.gt.50000").limit(20),
        supabase.from("lots").select("lot_ref, source, condition_notes").eq("image_urls", "{}" as any).limit(20),
      ]);

      const [nullDateCount, suspCount, imgCount] = await Promise.all([
        supabase.from("lots").select("id", { count: "exact", head: true }).is("sale_date", null),
        supabase.from("lots").select("id", { count: "exact", head: true }).or("total_paid_gbp.lt.5,total_paid_gbp.gt.50000"),
        supabase.from("lots").select("id", { count: "exact", head: true }).eq("image_urls", "{}" as any),
      ]);

      setNullDates({ count: nullDateCount.count ?? 0, rows: (nullDateRes.data ?? []).map((r: any) => ({ lot_ref: r.lot_ref, source: r.source, extra: r.sale_date ?? "NULL" })) });
      setSuspPrices({ count: suspCount.count ?? 0, rows: (suspRes.data ?? []).map((r: any) => ({ lot_ref: r.lot_ref, source: r.source, extra: `£${r.total_paid_gbp}` })) });
      setMissingImages({ count: imgCount.count ?? 0, rows: (imgRes.data ?? []).map((r: any) => ({ lot_ref: r.lot_ref, source: r.source, extra: (r.condition_notes ?? "").slice(0, 60) })) });
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Reclassifier
  const runReclassify = async () => {
    setReclassifying(true);
    try {
      const { data } = await supabase.from("lots").select("id, lot_ref, variant_code, era, cardback_code, condition_notes").or("cardback_code.eq.UNKNOWN,era.eq.UNKNOWN");
      if (!data || data.length === 0) { toast.info("No UNKNOWN records to reclassify"); return; }

      let changed = 0;
      for (const lot of data) {
        const titleText = [lot.lot_ref, lot.condition_notes].join(" ");
        const classified = classifyLot(titleText);
        let newEra = classified.era;
        let newCardback = classified.cardback_code;
        if (newEra === "UNKNOWN" || newCardback === "UNKNOWN") {
          const derived = deriveFromVariantCode(lot.variant_code);
          if (newEra === "UNKNOWN" && derived.era !== "UNKNOWN") newEra = derived.era;
          if (newCardback === "UNKNOWN" && derived.cardback_code !== "UNKNOWN") newCardback = derived.cardback_code;
        }

        const updates: Record<string, string> = {};
        const auditEntries: any[] = [];
        if (newEra !== "UNKNOWN" && newEra !== lot.era) {
          updates.era = newEra;
          auditEntries.push({ lot_id: lot.id, lot_ref: lot.lot_ref, action: "RECLASSIFY", field_changed: "era", old_value: lot.era, new_value: newEra });
        }
        if (newCardback !== "UNKNOWN" && newCardback !== lot.cardback_code) {
          updates.cardback_code = newCardback;
          auditEntries.push({ lot_id: lot.id, lot_ref: lot.lot_ref, action: "RECLASSIFY", field_changed: "cardback_code", old_value: lot.cardback_code, new_value: newCardback });
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from("lots").update(updates).eq("id", lot.id);
          if (auditEntries.length > 0) await supabase.from("audit_log").insert(auditEntries);
          changed++;
        }
      }
      toast.success(`Reclassified ${changed} of ${data.length} records`);
      fetchAll();
    } catch (e: any) {
      toast.error("Reclassify failed: " + e.message);
    } finally {
      setReclassifying(false);
    }
  };

  // Dedup
  const runDedup = async () => {
    const { data } = await supabase.from("lots").select("lot_ref, source");
    if (!data) { toast.info("No duplicates found"); return; }
    const counts: Record<string, number> = {};
    for (const r of data) {
      const key = `${r.lot_ref}|||${r.source}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    const dups = Object.entries(counts)
      .filter(([, c]) => c > 1)
      .map(([k, c]) => { const [lot_ref, source] = k.split("|||"); return { lot_ref, source, count: c }; });

    if (dups.length === 0) { toast.info("No duplicates found"); setDupGroups([]); }
    else { setDupGroups(dups); }
  };

  // Quick add
  const handleQuickAdd = async () => {
    const errors: Record<string, string> = {};
    if (!qa.source) errors.source = "Required";
    if (!qa.lot_ref.trim()) errors.lot_ref = "Required";
    if (!qa.total_paid_gbp) errors.total_paid_gbp = "Required";
    if (Object.keys(errors).length > 0) { setQaErrors(errors); return; }
    setQaErrors({});
    setQaSaving(true);
    try {
      const row: any = {
        source: qa.source,
        lot_ref: qa.lot_ref.trim(),
        lot_url: qa.lot_url || "",
        sale_date: qa.sale_date || new Date().toISOString().slice(0, 10),
        capture_date: new Date().toISOString().slice(0, 10),
        era: qa.era || "UNKNOWN",
        cardback_code: qa.cardback_code || "UNKNOWN",
        variant_code: qa.variant_code || "UNKNOWN",
        grade_tier_code: qa.grade_tier_code || "UNKNOWN",
        hammer_price_gbp: parseFloat(qa.hammer_price_gbp) || 0,
        buyers_premium_gbp: parseFloat(qa.buyers_premium_gbp) || 0,
        total_paid_gbp: parseFloat(qa.total_paid_gbp) || 0,
        condition_notes: qa.condition_notes,
        image_urls: qa.image_urls ? qa.image_urls.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      };
      const { error } = await supabase.from("lots").insert(row);
      if (error) throw error;
      await supabase.from("audit_log").insert({ lot_ref: qa.lot_ref.trim(), action: "INSERT" });
      toast.success(`Lot ${qa.lot_ref} added`);
      setQa({ source: "Heritage", lot_ref: "", lot_url: "", sale_date: "", era: "", cardback_code: "", variant_code: "", grade_tier_code: "", hammer_price_gbp: "", buyers_premium_gbp: "", total_paid_gbp: "", condition_notes: "", image_urls: "" });
      fetchAll();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setQaSaving(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    const { data } = await supabase.from("lots").select("*").order("sale_date", { ascending: false });
    if (!data || data.length === 0) { toast.info("No data to export"); return; }
    const headers = ["captureDate", "saleDate", "source", "era", "cardbackCode", "lotRef", "variantCode", "gradeTierCode", "variantGradeKey", "hammerPriceGBP", "buyersPremiumGBP", "totalPaidGBP", "usdToGbpRate", "conditionNotes"];
    const rows = data.map((l: any) => [
      l.capture_date, l.sale_date, l.source, l.era, l.cardback_code, l.lot_ref, l.variant_code, l.grade_tier_code, l.variant_grade_key,
      l.hammer_price_gbp, l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate, `"${(l.condition_notes ?? "").replace(/"/g, '""')}"`,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vader-prices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} records`);
  };

  // Import CSV
  const handleFileSelect = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split("\n");
    let start = 0;
    if (lines[0]?.toLowerCase().includes("capturedate") || lines[0]?.toLowerCase().includes("capture_date")) start = 1;
    const parsed: any[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 12) continue;
      parsed.push({
        capture_date: cols[0], sale_date: cols[1], source: cols[2], lot_ref: cols[5] || cols[3],
        era: cols[3] || "UNKNOWN", cardback_code: cols[4] || "UNKNOWN",
        variant_code: cols[6] || "UNKNOWN", grade_tier_code: cols[7] || "UNKNOWN",
        hammer_price_gbp: parseFloat(cols[9]) || 0, buyers_premium_gbp: parseFloat(cols[10]) || 0,
        total_paid_gbp: parseFloat(cols[11]) || 0, usd_to_gbp_rate: parseFloat(cols[12]) || 1,
        condition_notes: cols[13] || "",
      });
    }
    setImportTotal(parsed.length);
    setImportPreview(parsed);
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const toInsert = importPreview.map((r) => ({ ...r, capture_date: r.capture_date || new Date().toISOString().slice(0, 10) }));
      const { error } = await supabase.from("lots").insert(toInsert);
      if (error) throw error;
      await supabase.from("audit_log").insert(toInsert.map((r: any) => ({ lot_ref: r.lot_ref, action: "IMPORT" })));
      toast.success(`Imported ${toInsert.length} records`);
      setImportPreview(null);
      fetchAll();
    } catch (e: any) {
      toast.error("Import failed: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (delConfirm !== "DELETE") { toast.error("Type DELETE to confirm"); return; }
    const { count } = await supabase.from("lots").select("id", { count: "exact", head: true }).eq("source", delSource as any);
    const { error } = await supabase.from("lots").delete().eq("source", delSource as any);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    await supabase.from("audit_log").insert({ action: "DELETE", old_value: `${delSource}: records deleted` });
    toast.success(`Deleted ${delSource} records`);
    setDelOpen(false); setDelConfirm("");
    fetchAll();
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, width: "100%", fontSize: 13, minHeight: 44,
  };

  const togglePanel = (name: string) => setExpandedPanel(expandedPanel === name ? null : name);

  if (loading) {
    return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading data…</p>;
  }

  return (
    <div className="space-y-6 relative">
      <button onClick={fetchAll} className="absolute top-0 right-0 p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
        <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
      </button>

      {/* DB Summary */}
      {stats && (
        <div className="rounded p-4 grid grid-cols-2 md:grid-cols-5 gap-3" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
          {[
            { label: "Total Records", value: stats.total.toLocaleString() },
            { label: "This Week", value: stats.thisWeek.toLocaleString() },
            { label: "This Month", value: stats.thisMonth.toLocaleString() },
            { label: "Earliest", value: stats.earliest ?? "—" },
            { label: "Latest", value: stats.latest ?? "—" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.6)" }}>{s.label}</p>
              <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button onClick={runReclassify} disabled={reclassifying} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44, opacity: reclassifying ? 0.5 : 1 }}>
          {reclassifying ? "RUNNING…" : "RUN RECLASSIFIER"}
        </button>
        <button onClick={runDedup} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
          DEDUP CHECKER
        </button>
      </div>

      {/* Dedup results */}
      {dupGroups !== null && (
        <div className="rounded p-3" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
          <h3 className="text-xs tracking-wider font-bold mb-2" style={{ color: "#C9A84C" }}>
            Found {dupGroups.length} duplicate group{dupGroups.length !== 1 ? "s" : ""}
          </h3>
          {dupGroups.map((d, i) => (
            <div key={i} className="flex items-center justify-between py-1 text-[11px]" style={{ color: "#e0d8c0", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
              <span>{d.lot_ref} — {d.source} — {d.count}×</span>
              <a href={`/?q=${encodeURIComponent(d.lot_ref)}`} className="underline" style={{ color: "#C9A84C" }}>View</a>
            </div>
          ))}
        </div>
      )}

      {/* Bad data */}
      <div className="space-y-2">
        <h3 className="text-xs tracking-wider font-bold" style={{ color: "rgba(224,216,192,0.6)" }}>BAD DATA REPORT</h3>
        {[
          { key: "nullDates", label: "Null Dates", data: nullDates },
          { key: "suspPrices", label: "Suspicious Prices", data: suspPrices },
          { key: "missingImages", label: "Missing Images", data: missingImages },
        ].map((panel) => (
          <div key={panel.key} className="rounded" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "#0D0D0B" }}>
            <button onClick={() => togglePanel(panel.key)} className="flex items-center justify-between w-full px-3 py-2 text-[11px]" style={{ color: "#e0d8c0", minHeight: 44 }}>
              <span>{panel.label} ({panel.data.count})</span>
              {expandedPanel === panel.key ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedPanel === panel.key && (
              <div className="px-3 pb-3">
                {panel.data.rows.length === 0 ? (
                  <p className="italic text-[11px]" style={{ color: "rgba(224,216,192,0.5)" }}>No records.</p>
                ) : (
                  panel.data.rows.map((r, i) => (
                    <div key={i} className="flex gap-4 py-1 text-[11px]" style={{ color: "#e0d8c0", background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
                      <span className="w-24 flex-shrink-0">{r.lot_ref}</span>
                      <span className="w-16 flex-shrink-0">{r.source}</span>
                      <span className="truncate">{r.extra}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Add Lot */}
      <div className="rounded p-4" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
        <h3 className="text-xs tracking-wider font-bold mb-3" style={{ color: "#C9A84C" }}>QUICK ADD LOT</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>SOURCE *</label>
            <select value={qa.source} onChange={(e) => setQa({ ...qa, source: e.target.value })} style={inputStyle}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {qaErrors.source && <span className="text-[10px]" style={{ color: "#F44336" }}>{qaErrors.source}</span>}
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>LOT REF *</label>
            <input value={qa.lot_ref} onChange={(e) => setQa({ ...qa, lot_ref: e.target.value })} style={inputStyle} />
            {qaErrors.lot_ref && <span className="text-[10px]" style={{ color: "#F44336" }}>{qaErrors.lot_ref}</span>}
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>LOT URL</label>
            <input type="url" value={qa.lot_url} onChange={(e) => setQa({ ...qa, lot_url: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>SALE DATE</label>
            <input type="date" value={qa.sale_date} onChange={(e) => setQa({ ...qa, sale_date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>ERA</label>
            <select value={qa.era} onChange={(e) => setQa({ ...qa, era: e.target.value })} style={inputStyle}>
              <option value="">—</option>
              {ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>CARDBACK CODE</label>
            <select value={qa.cardback_code} onChange={(e) => setQa({ ...qa, cardback_code: e.target.value })} style={inputStyle}>
              <option value="">—</option>
              {CARDBACK_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>VARIANT CODE</label>
            <input value={qa.variant_code} onChange={(e) => setQa({ ...qa, variant_code: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>GRADE TIER CODE</label>
            <input value={qa.grade_tier_code} onChange={(e) => setQa({ ...qa, grade_tier_code: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>HAMMER PRICE (GBP)</label>
            <input type="number" inputMode="decimal" value={qa.hammer_price_gbp} onChange={(e) => setQa({ ...qa, hammer_price_gbp: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>BUYER'S PREMIUM (GBP)</label>
            <input type="number" inputMode="decimal" value={qa.buyers_premium_gbp} onChange={(e) => setQa({ ...qa, buyers_premium_gbp: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>TOTAL PAID (GBP) *</label>
            <input type="number" inputMode="decimal" value={qa.total_paid_gbp} onChange={(e) => setQa({ ...qa, total_paid_gbp: e.target.value })} style={inputStyle} />
            {qaErrors.total_paid_gbp && <span className="text-[10px]" style={{ color: "#F44336" }}>{qaErrors.total_paid_gbp}</span>}
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>CONDITION NOTES</label>
            <textarea value={qa.condition_notes} onChange={(e) => setQa({ ...qa, condition_notes: e.target.value })} rows={2} style={{ ...inputStyle, minHeight: 60 }} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>IMAGE URLS (comma-sep)</label>
            <textarea value={qa.image_urls} onChange={(e) => setQa({ ...qa, image_urls: e.target.value })} rows={2} style={{ ...inputStyle, minHeight: 60 }} />
          </div>
        </div>
        <button onClick={handleQuickAdd} disabled={qaSaving} className="mt-3 px-6 py-2 rounded text-[11px] font-bold tracking-wider" style={{ background: "#C9A84C", color: "#080806", minHeight: 44, opacity: qaSaving ? 0.5 : 1 }}>
          {qaSaving ? "ADDING…" : "ADD LOT"}
        </button>
      </div>

      {/* Bulk operations */}
      <div className="rounded p-4" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
        <h3 className="text-xs tracking-wider font-bold mb-3" style={{ color: "#C9A84C" }}>BULK OPERATIONS</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Delete by source */}
          <div className="space-y-2">
            <select value={delSource} onChange={(e) => setDelSource(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {!delOpen ? (
              <button onClick={() => setDelOpen(true)} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid #F44336", color: "#F44336", minHeight: 44 }}>
                DELETE ALL {delSource.toUpperCase()} RECORDS
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px]" style={{ color: "#F44336" }}>Type DELETE to confirm:</p>
                <input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} style={inputStyle} placeholder="DELETE" />
                <button onClick={handleBulkDelete} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ background: "#F44336", color: "#fff", minHeight: 44 }}>
                  CONFIRM DELETE
                </button>
              </div>
            )}
          </div>

          {/* Export */}
          <button onClick={handleExport} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider self-start" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
            EXPORT CSV
          </button>

          {/* Import */}
          <div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
              IMPORT CSV
            </button>
          </div>
        </div>

        {/* Import preview */}
        {importPreview && (
          <div className="mt-4 rounded p-3" style={{ border: "1px solid rgba(201,168,76,0.2)" }}>
            <p className="text-[11px] mb-2" style={{ color: "#e0d8c0" }}>Preview: {importTotal} rows parsed. First 5:</p>
            <div className="overflow-x-auto text-[10px]" style={{ color: "#e0d8c0" }}>
              {importPreview.slice(0, 5).map((r, i) => (
                <div key={i} className="py-1" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
                  {r.lot_ref} | {r.source} | £{r.total_paid_gbp}
                </div>
              ))}
            </div>
            <button onClick={confirmImport} disabled={importing} className="mt-2 px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ background: "#C9A84C", color: "#080806", minHeight: 44, opacity: importing ? 0.5 : 1 }}>
              {importing ? "IMPORTING…" : `IMPORT ${importTotal} RECORDS`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export default AdminDataTab;

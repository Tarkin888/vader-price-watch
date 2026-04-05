import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BUG_CATEGORIES = ["SCRAPER", "CLASSIFICATION", "UI", "DATA", "OTHER"] as const;
const CAT_COLORS: Record<string, string> = {
  SCRAPER: "#2196F3", CLASSIFICATION: "#9B59B6", UI: "#1ABC9C", DATA: "#E67E22", OTHER: "#666",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "#FF9800", IN_PROGRESS: "#2196F3", RESOLVED: "#4CAF50", DISMISSED: "#666",
};

interface BugReport {
  id: string;
  category: string;
  description: string;
  lot_ref: string | null;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const AdminBugReportsTab = () => {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Form
  const [fCat, setFCat] = useState<string>("OTHER");
  const [fDesc, setFDesc] = useState("");
  const [fLotRef, setFLotRef] = useState("");
  const [fError, setFError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase.from("bug_reports").select("*").order("created_at", { ascending: false });
      setBugs((data ?? []) as BugReport[]);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 300000); return () => clearInterval(id); }, [fetchAll]);

  const stats = {
    OPEN: bugs.filter((b) => b.status === "OPEN").length,
    IN_PROGRESS: bugs.filter((b) => b.status === "IN_PROGRESS").length,
    RESOLVED: bugs.filter((b) => b.status === "RESOLVED").length,
    DISMISSED: bugs.filter((b) => b.status === "DISMISSED").length,
  };

  const filtered = catFilter === "All" ? bugs : bugs.filter((b) => b.category === catFilter);

  const handleSubmit = async () => {
    if (fDesc.trim().length < 10) { setFError("Description must be at least 10 characters"); return; }
    setFError("");
    setSaving(true);
    try {
      const { error } = await supabase.from("bug_reports").insert({
        category: fCat, description: fDesc.trim(), lot_ref: fLotRef.trim() || null,
      });
      if (error) throw error;
      toast.success("Bug report submitted");
      setModalOpen(false);
      setFDesc(""); setFLotRef("");
      fetchAll();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === "RESOLVED") {
      update.resolved_at = new Date().toISOString();
      update.resolution_notes = notes || null;
    }
    const { error } = await supabase.from("bug_reports").update(update).eq("id", id);
    if (error) { toast.error("Update failed"); return; }
    toast.success(`Status updated to ${status}`);
    setResolvingId(null);
    setResolutionNotes("");
    fetchAll();
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, width: "100%", fontSize: 13, minHeight: 44,
  };

  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading bug reports…</p>;

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-wider font-bold" style={{ color: "#C9A84C" }}>BUG REPORTS</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
            ADD BUG REPORT
          </button>
          <button onClick={fetchAll} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
            <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const).map((s) => (
          <span key={s} className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: `${STATUS_COLORS[s]}20`, color: STATUS_COLORS[s], minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            {s.replace("_", " ")}: {stats[s]}
          </span>
        ))}
      </div>

      {/* Filter */}
      <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
        <option value="All">All Categories</option>
        {BUG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Bug list */}
      {filtered.length === 0 ? (
        <p className="italic text-center py-8" style={{ color: "rgba(224,216,192,0.5)" }}>No bug reports yet. Use the button above to log an issue.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((b, i) => (
            <div key={b.id} className="rounded p-3" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110", border: "1px solid rgba(201,168,76,0.1)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${CAT_COLORS[b.category] || "#666"}33`, color: CAT_COLORS[b.category] || "#666" }}>
                      {b.category}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${STATUS_COLORS[b.status] || "#666"}20`, color: STATUS_COLORS[b.status] || "#666" }}>
                      {b.status.replace("_", " ")}
                    </span>
                    {b.lot_ref && <span className="text-[10px]" style={{ color: "rgba(224,216,192,0.5)" }}>Ref: {b.lot_ref}</span>}
                    <span className="text-[10px]" style={{ color: "rgba(224,216,192,0.4)" }}>{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[12px]" style={{ color: "#e0d8c0" }}>
                    {expanded === b.id ? b.description : b.description.slice(0, 120)}
                    {b.description.length > 120 && (
                      <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="ml-1 underline" style={{ color: "#C9A84C" }}>
                        {expanded === b.id ? "Less" : "More"}
                      </button>
                    )}
                  </p>
                  {b.resolution_notes && (
                    <p className="text-[11px] mt-1 italic" style={{ color: "rgba(224,216,192,0.5)" }}>Resolution: {b.resolution_notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {b.status === "OPEN" && (
                    <>
                      <button onClick={() => updateStatus(b.id, "IN_PROGRESS")} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: "rgba(33,150,243,0.2)", color: "#2196F3", minHeight: 44 }}>IN PROGRESS</button>
                      <button onClick={() => updateStatus(b.id, "DISMISSED")} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: "rgba(102,102,102,0.2)", color: "#666", minHeight: 44 }}>DISMISS</button>
                    </>
                  )}
                  {b.status === "IN_PROGRESS" && (
                    resolvingId === b.id ? (
                      <div className="space-y-1">
                        <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Resolution notes…" rows={2} style={{ ...inputStyle, minHeight: 60, width: 180 }} />
                        <button onClick={() => updateStatus(b.id, "RESOLVED", resolutionNotes)} className="px-2 py-1.5 rounded text-[10px] font-bold w-full" style={{ background: "rgba(76,175,80,0.2)", color: "#4CAF50", minHeight: 44 }}>SAVE & RESOLVE</button>
                      </div>
                    ) : (
                      <button onClick={() => setResolvingId(b.id)} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: "rgba(76,175,80,0.2)", color: "#4CAF50", minHeight: 44 }}>RESOLVE</button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add bug modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ background: "#0D0D0B", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0" }} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-wider" style={{ color: "#C9A84C" }}>ADD BUG REPORT</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>CATEGORY *</label>
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={inputStyle}>
                {BUG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>DESCRIPTION * (min 10 chars)</label>
              <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={4} style={{ ...inputStyle, minHeight: 100 }} />
              {fError && <span className="text-[10px]" style={{ color: "#F44336" }}>{fError}</span>}
            </div>
            <div>
              <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>LOT REF (optional)</label>
              <input value={fLotRef} onChange={(e) => setFLotRef(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={handleSubmit} disabled={saving} className="w-full py-3 rounded text-[11px] font-bold tracking-wider" style={{ background: "#C9A84C", color: "#080806", minHeight: 44, opacity: saving ? 0.5 : 1 }}>
              {saving ? "SUBMITTING…" : "SUBMIT"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBugReportsTab;

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import AdminUserReportsPanel from "./UserReportsPanel";

const BUG_CATEGORIES = ["SCRAPER", "CLASSIFICATION", "UI", "DATA", "OTHER"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const;

const CAT_COLORS: Record<string, string> = {
  SCRAPER: "#2196F3", CLASSIFICATION: "#9B59B6", UI: "#1ABC9C", DATA: "#E67E22", OTHER: "#666",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "#FF9800", IN_PROGRESS: "#2196F3", RESOLVED: "#4CAF50", DISMISSED: "#666",
};
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#F44336", HIGH: "#FF9800", MEDIUM: "#FFEB3B", LOW: "#9E9E9E",
};
const SOURCE_LABELS: Record<string, string> = {
  BUG_REPORT: "AI CHATBOT", MANUAL: "MANUAL", FEATURE_REQUEST: "FEATURE REQ",
};
const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const STATUS_ORDER: Record<string, number> = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2, DISMISSED: 3 };

type SortMode = "date" | "priority" | "status";

interface BugReport {
  id: string;
  title: string | null;
  feedback_type: string | null;
  category: string;
  description: string;
  priority: string | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  session_id: string | null;
}

const AdminBugReportsTab = () => {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState<string | null>(null);
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
      const { data } = await supabase
        .from("chatbot_feedback" as any)
        .select("id, title, feedback_type, category, description, priority, status, created_at, metadata, session_id")
        .order("created_at", { ascending: false });
      setBugs((data ?? []) as unknown as BugReport[]);
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

  let filtered = bugs;
  if (catFilter !== "All") filtered = filtered.filter((b) => b.category === catFilter);
  if (statusFilter !== "All") filtered = filtered.filter((b) => b.status === statusFilter);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "priority") {
      return (PRIORITY_ORDER[a.priority || "LOW"] ?? 9) - (PRIORITY_ORDER[b.priority || "LOW"] ?? 9);
    }
    if (sortMode === "status") {
      return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleSubmit = async () => {
    if (fDesc.trim().length < 10) { setFError("Description must be at least 10 characters"); return; }
    setFError("");
    setSaving(true);
    try {
      const res = await adminWrite({ table: "bug_reports", operation: "insert", data: {
        category: fCat, description: fDesc.trim(), lot_ref: fLotRef.trim() || null,
      }});
      if (!res.success) throw new Error(res.error);
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
    const res = await adminWrite({ table: "chatbot_feedback", operation: "update", data: update, match: { column: "id", value: id } });
    if (!res.success) { toast.error("Update failed"); return; }
    toast.success(`Status updated to ${status}`);
    setResolvingId(null);
    setResolutionNotes("");
    fetchAll();
  };

  const getBugId = (index: number) => `BUG-${String(index + 1).padStart(3, "0")}`;

  const getSourceLabel = (b: BugReport) => {
    if (b.feedback_type && SOURCE_LABELS[b.feedback_type]) return SOURCE_LABELS[b.feedback_type];
    if (b.session_id) return "AI CHATBOT";
    return "MANUAL";
  };

  const getResolutionNotes = (b: BugReport): string | null => {
    const meta = b.metadata as any;
    return meta?.resolution_notes || null;
  };

  const getLotRef = (b: BugReport): string | null => {
    const meta = b.metadata as any;
    return meta?.lot_ref || null;
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, width: "100%", fontSize: 13, minHeight: 44,
  };

  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading bug reports…</p>;

  // Reverse map for sequential IDs (oldest first = BUG-001)
  const allSortedByDate = [...bugs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const bugIdMap = new Map(allSortedByDate.map((b, i) => [b.id, getBugId(i)]));

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

      {/* Filters & Sort */}
      <div className="flex flex-wrap gap-2">
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="All">All Categories</option>
          {BUG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={{ ...inputStyle, width: "auto" }}>
          <option value="date">Sort: Date (Newest)</option>
          <option value="priority">Sort: Priority (Critical first)</option>
          <option value="status">Sort: Status (Open first)</option>
        </select>
      </div>

      {/* Bug list */}
      {sorted.length === 0 ? (
        <p className="italic text-center py-8" style={{ color: "rgba(224,216,192,0.5)" }}>No bug reports match the current filters.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((b, i) => {
            const bugId = bugIdMap.get(b.id) || `BUG-${i}`;
            const resNotes = getResolutionNotes(b);
            const lotRef = getLotRef(b);
            const priorityColor = PRIORITY_COLORS[b.priority || ""] || "#9E9E9E";
            const sourceLabel = getSourceLabel(b);

            return (
              <div key={b.id} className="rounded p-3" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110", border: "1px solid rgba(201,168,76,0.1)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Bug ID */}
                      <span className="text-[11px] font-bold font-mono" style={{ color: "#C9A84C" }}>{bugId}</span>
                      {/* Category */}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${CAT_COLORS[b.category] || "#666"}33`, color: CAT_COLORS[b.category] || "#666" }}>
                        {b.category}
                      </span>
                      {/* Status */}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${STATUS_COLORS[b.status] || "#666"}20`, color: STATUS_COLORS[b.status] || "#666" }}>
                        {b.status.replace("_", " ")}
                      </span>
                      {/* Source */}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(201,168,76,0.1)", color: "rgba(224,216,192,0.6)" }}>
                        {sourceLabel}
                      </span>
                      {/* Priority */}
                      {b.priority && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${priorityColor}20`, color: priorityColor }}>
                          {b.priority}
                        </span>
                      )}
                      {/* Lot ref */}
                      {lotRef && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
                          {lotRef}
                        </span>
                      )}
                      {/* Date + time */}
                      <span className="text-[10px]" style={{ color: "rgba(224,216,192,0.4)" }}>
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                    </div>
                    {b.title && <p className="text-[12px] font-bold mb-1" style={{ color: "#e0d8c0" }}>{b.title}</p>}
                    <p className="text-[12px]" style={{ color: "#e0d8c0" }}>
                      {expanded === b.id ? b.description : (b.description ?? "").slice(0, 120)}
                      {(b.description?.length ?? 0) > 120 && (
                        <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="ml-1 underline" style={{ color: "#C9A84C" }}>
                          {expanded === b.id ? "Less" : "More"}
                        </button>
                      )}
                    </p>

                    {/* Resolution notes collapsible */}
                    {resNotes && b.status === "RESOLVED" && (
                      <div className="mt-2">
                        <button
                          onClick={() => setNotesExpanded(notesExpanded === b.id ? null : b.id)}
                          className="flex items-center gap-1 text-[10px] font-bold tracking-wider"
                          style={{ color: "#4CAF50" }}
                        >
                          {notesExpanded === b.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          RESOLUTION NOTES
                        </button>
                        {notesExpanded === b.id && (
                          <p className="mt-1 text-[11px] p-2 rounded" style={{ color: "rgba(224,216,192,0.7)", background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)" }}>
                            {resNotes}
                          </p>
                        )}
                      </div>
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
            );
          })}
        </div>
      )}

      {/* Add bug modal */}
      {modalOpen && (
        <>
          <div className="admin-modal-overlay" onClick={() => setModalOpen(false)} />
          <div className="admin-modal">
            <div className="md:hidden flex justify-center mb-2">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(201,168,76,0.4)" }} />
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm tracking-wider font-bold" style={{ color: "#C9A84C" }}>ADD BUG REPORT</span>
              <button onClick={() => setModalOpen(false)} className="text-lg" style={{ color: "#e0d8c0", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
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
          </div>
        </>
      )}
    </div>
  );
};

export default AdminBugReportsTab;

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const STATUSES = ["New", "In Progress", "Dismissed", "Resolved"] as const;
const STATUS_COLORS: Record<string, string> = {
  New: "#FF9800", "In Progress": "#2196F3", Resolved: "#4CAF50", Dismissed: "#666",
};
const SEV_COLORS: Record<string, string> = {
  Critical: "#F44336", High: "#FF9800", Medium: "#FFEB3B", Low: "#9E9E9E",
};
const SEV_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_ORDER: Record<string, number> = { New: 0, "In Progress": 1, Resolved: 2, Dismissed: 3 };

type SortMode = "date" | "severity" | "status";

interface UserReport {
  id: string;
  created_at: string;
  user_email: string;
  page_or_feature: string;
  description: string;
  severity: string;
  screenshot_url: string | null;
  status: string;
  admin_notes: string | null;
}

const AdminUserReportsPanel = () => {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase
        .from("user_bug_reports" as any)
        .select("*")
        .order("created_at", { ascending: false });
      setReports((data ?? []) as unknown as UserReport[]);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 300000); return () => clearInterval(id); }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    const res = await adminWrite({
      table: "user_bug_reports",
      operation: "update",
      data: { status },
      match: { column: "id", value: id },
    });
    if (!res.success) { toast.error("Update failed: " + (res.error || "")); return; }
    toast.success(`Status → ${status}`);
    fetchAll();
  };

  const saveNotes = async (id: string) => {
    const res = await adminWrite({
      table: "user_bug_reports",
      operation: "update",
      data: { admin_notes: notesText },
      match: { column: "id", value: id },
    });
    if (!res.success) { toast.error("Save failed"); return; }
    toast.success("Notes saved");
    setEditingNotes(null);
    setNotesText("");
    fetchAll();
  };

  let filtered = reports;
  if (statusFilter !== "All") filtered = filtered.filter((r) => r.status === statusFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "severity") return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
    if (sortMode === "status") return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const stats = {
    New: reports.filter((r) => r.status === "New").length,
    "In Progress": reports.filter((r) => r.status === "In Progress").length,
    Resolved: reports.filter((r) => r.status === "Resolved").length,
    Dismissed: reports.filter((r) => r.status === "Dismissed").length,
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, width: "100%", fontSize: 13, minHeight: 44,
  };

  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading user reports…</p>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(STATUSES as readonly string[]).map((s) => (
            <span key={s} className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: `${STATUS_COLORS[s]}20`, color: STATUS_COLORS[s], minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              {s}: {stats[s as keyof typeof stats]}
            </span>
          ))}
        </div>
        <button onClick={fetchAll} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
          <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={{ ...inputStyle, width: "auto" }}>
          <option value="date">Sort: Date (Newest)</option>
          <option value="severity">Sort: Severity (Critical first)</option>
          <option value="status">Sort: Status (New first)</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <p className="italic text-center py-8" style={{ color: "rgba(224,216,192,0.5)" }}>No user reports match the current filters.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r, i) => (
            <div key={r.id} className="rounded p-3" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110", border: "1px solid rgba(201,168,76,0.1)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* Severity */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${SEV_COLORS[r.severity] || "#9E9E9E"}20`, color: SEV_COLORS[r.severity] || "#9E9E9E" }}>
                      {r.severity.toUpperCase()}
                    </span>
                    {/* Status */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${STATUS_COLORS[r.status] || "#666"}20`, color: STATUS_COLORS[r.status] || "#666" }}>
                      {r.status.toUpperCase()}
                    </span>
                    {/* Page */}
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: "rgba(201,168,76,0.1)", color: "rgba(224,216,192,0.6)" }}>
                      {r.page_or_feature}
                    </span>
                    {/* Date */}
                    <span className="text-[10px]" style={{ color: "rgba(224,216,192,0.4)" }}>
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  {/* User email */}
                  <p className="text-[11px] font-bold mb-1" style={{ color: "#C9A84C" }}>{r.user_email}</p>
                  {/* Description */}
                  <p className="text-[12px]" style={{ color: "#e0d8c0" }}>
                    {expanded === r.id ? r.description : r.description.slice(0, 150)}
                    {r.description.length > 150 && (
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="ml-1 underline" style={{ color: "#C9A84C" }}>
                        {expanded === r.id ? "Less" : "More"}
                      </button>
                    )}
                  </p>
                  {/* Screenshot thumbnail */}
                  {r.screenshot_url && (
                    <button onClick={() => setLightbox(r.screenshot_url)} className="mt-2">
                      <img src={r.screenshot_url} alt="Bug screenshot" className="w-20 h-14 object-cover rounded" style={{ border: "1px solid rgba(201,168,76,0.2)" }} />
                    </button>
                  )}
                  {/* Admin notes */}
                  {r.admin_notes && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpanded(expanded === `notes-${r.id}` ? null : `notes-${r.id}`)}
                        className="flex items-center gap-1 text-[10px] font-bold tracking-wider"
                        style={{ color: "#4CAF50" }}
                      >
                        {expanded === `notes-${r.id}` ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        ADMIN NOTES
                      </button>
                      {expanded === `notes-${r.id}` && (
                        <p className="mt-1 text-[11px] p-2 rounded" style={{ color: "rgba(224,216,192,0.7)", background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)" }}>
                          {r.admin_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {r.status === "New" && (
                    <>
                      <button onClick={() => updateStatus(r.id, "In Progress")} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: "rgba(33,150,243,0.2)", color: "#2196F3", minHeight: 44 }}>IN PROGRESS</button>
                      <button onClick={() => updateStatus(r.id, "Dismissed")} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: "rgba(102,102,102,0.2)", color: "#666", minHeight: 44 }}>DISMISS</button>
                    </>
                  )}
                  {r.status === "In Progress" && (
                    editingNotes === r.id ? (
                      <div className="space-y-1">
                        <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="Admin notes…" rows={2} style={{ ...inputStyle, minHeight: 60, width: 180 }} />
                        <button onClick={() => { saveNotes(r.id); updateStatus(r.id, "Resolved"); }} className="px-2 py-1.5 rounded text-[10px] font-bold w-full" style={{ background: "rgba(76,175,80,0.2)", color: "#4CAF50", minHeight: 44 }}>SAVE & RESOLVE</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingNotes(r.id); setNotesText(r.admin_notes || ""); }} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: "rgba(76,175,80,0.2)", color: "#4CAF50", minHeight: 44 }}>RESOLVE</button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50" onClick={() => setLightbox(null)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="Screenshot" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUserReportsPanel;

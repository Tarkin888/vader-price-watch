import { useEffect, useState, useCallback } from "react";
import { adminRead } from "@/lib/admin-read";
import { adminWrite } from "@/lib/admin-write";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const SOURCES = ["Heritage", "Hakes", "LCG", "Vectis", "CandT"];
const STATUS_OPTIONS = ["SUCCESS", "PARTIAL", "FAILED"];
const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "#4CAF50", PARTIAL: "#FF9800", FAILED: "#F44336", RUNNING: "#2196F3",
};

interface ScraperLog {
  id: string;
  source: string;
  status: string;
  records_captured: number;
  records_skipped: number;
  error_message: string | null;
  duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

const AdminScrapersTab = () => {
  const [latestBySource, setLatestBySource] = useState<Record<string, ScraperLog>>({});
  const [recentRuns, setRecentRuns] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  // Form state
  const [fSource, setFSource] = useState(SOURCES[0]);
  const [fStatus, setFStatus] = useState("SUCCESS");
  const [fCaptured, setFCaptured] = useState("");
  const [fSkipped, setFSkipped] = useState("");
  const [fDuration, setFDuration] = useState("");
  const [fError, setFError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await adminRead({ table: "scraper_logs", order_by: "created_at", order_asc: false, limit: 100 });

      const logs = (data ?? []) as ScraperLog[];
      setRecentRuns(logs.slice(0, 30));

      const bySource: Record<string, ScraperLog> = {};
      for (const log of logs) {
        if (!bySource[log.source]) bySource[log.source] = log;
      }
      setLatestBySource(bySource);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 300000); return () => clearInterval(id); }, [fetchAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminWrite({ table: "scraper_logs", operation: "insert", data: {
        source: fSource,
        status: fStatus,
        records_captured: parseInt(fCaptured) || 0,
        records_skipped: parseInt(fSkipped) || 0,
        duration_seconds: parseFloat(fDuration) || null,
        error_message: fStatus !== "SUCCESS" ? fError || null : null,
        completed_at: new Date().toISOString(),
      }});
      if (!res.success) throw new Error(res.error);
      toast.success("Scraper run logged");
      setModalOpen(false);
      setFCaptured(""); setFSkipped(""); setFDuration(""); setFError("");
      fetchAll();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
  };

  if (loading) {
    return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading scrapers…</p>;
  }

  const inputStyle = {
    background: "#111110",
    border: "1px solid rgba(201,168,76,0.3)",
    color: "#e0d8c0",
    padding: "8px 12px",
    borderRadius: 4,
    width: "100%",
    fontSize: 13,
    minHeight: 44,
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-wider font-bold" style={{ color: "#C9A84C" }}>SCRAPER STATUS</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="text-[11px] font-bold tracking-wider px-4 py-2 rounded"
            style={{ border: "1px solid #C9A84C", color: "#C9A84C", background: "transparent", minHeight: 44 }}
          >
            LOG SCRAPER RUN
          </button>
          <button onClick={fetchAll} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
            <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SOURCES.map((src) => {
          const log = latestBySource[src];
          return (
            <div key={src} className="rounded p-3 space-y-1" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>{src}</span>
                {log ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${STATUS_COLORS[log.status] || "#666"}33`, color: STATUS_COLORS[log.status] || "#666" }}>
                    {log.status}
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(102,102,102,0.2)", color: "#666" }}>NO RUNS</span>
                )}
              </div>
              {log && (
                <>
                  <p className="text-[11px]" style={{ color: "rgba(224,216,192,0.6)" }}>Last run: {fmtDate(log.created_at)}</p>
                  <p className="text-[11px]" style={{ color: "rgba(224,216,192,0.6)" }}>Records: {log.records_captured} captured / {log.records_skipped} skipped</p>
                  {log.duration_seconds != null && (
                    <p className="text-[11px]" style={{ color: "rgba(224,216,192,0.6)" }}>Duration: {log.duration_seconds}s</p>
                  )}
                  {log.error_message && (log.status === "FAILED" || log.status === "PARTIAL") && (
                    <div>
                      <p className="text-[11px]" style={{ color: "#F44336" }}>
                        {expandedError === log.id ? log.error_message : log.error_message.slice(0, 100)}
                        {log.error_message.length > 100 && (
                          <button onClick={() => setExpandedError(expandedError === log.id ? null : log.id)} className="ml-1 underline" style={{ color: "#C9A84C" }}>
                            {expandedError === log.id ? "Less" : "More"}
                          </button>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent runs table */}
      <div>
        <h3 className="text-xs tracking-wider font-bold mb-3" style={{ color: "rgba(224,216,192,0.6)" }}>LAST 30 RUNS</h3>
        {recentRuns.length === 0 ? (
          <p className="italic text-center py-4" style={{ color: "rgba(224,216,192,0.5)" }}>No scraper runs recorded yet.</p>
        ) : (
          <div className="table-scroll-wrapper rounded" style={{ border: "1px solid rgba(201,168,76,0.2)" }}>
            <table className="w-full text-[11px]" style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
                  {["Date", "Source", "Status", "Captured", "Skipped", "Duration", "Error"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-bold tracking-wider" style={{ color: "rgba(224,216,192,0.6)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
                    <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{r.source}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${STATUS_COLORS[r.status] || "#666"}33`, color: STATUS_COLORS[r.status] || "#666" }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{r.records_captured}</td>
                    <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{r.records_skipped}</td>
                    <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{r.duration_seconds != null ? `${r.duration_seconds}s` : "—"}</td>
                    <td className="px-3 py-2" style={{ color: "#F44336", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.error_message ? r.error_message.slice(0, 80) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log modal */}
      {modalOpen && (
        <>
          <div className="admin-modal-overlay" onClick={() => setModalOpen(false)} />
          <div className="admin-modal">
            <div className="md:hidden flex justify-center mb-2">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(201,168,76,0.4)" }} />
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm tracking-wider font-bold" style={{ color: "#C9A84C" }}>LOG SCRAPER RUN</span>
              <button onClick={() => setModalOpen(false)} className="text-lg" style={{ color: "#e0d8c0", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>SOURCE</label>
                <select value={fSource} onChange={(e) => setFSource(e.target.value)} style={inputStyle}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>STATUS</label>
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={inputStyle}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>CAPTURED</label>
                  <input type="number" inputMode="numeric" value={fCaptured} onChange={(e) => setFCaptured(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>SKIPPED</label>
                  <input type="number" inputMode="numeric" value={fSkipped} onChange={(e) => setFSkipped(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>DURATION (s)</label>
                <input type="number" inputMode="decimal" value={fDuration} onChange={(e) => setFDuration(e.target.value)} style={inputStyle} />
              </div>
              {fStatus !== "SUCCESS" && (
                <div>
                  <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>ERROR MESSAGE</label>
                  <textarea value={fError} onChange={(e) => setFError(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 80 }} />
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded text-[11px] font-bold tracking-wider"
                style={{ background: "#C9A84C", color: "#080806", minHeight: 44, opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "SAVING…" : "SAVE"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminScrapersTab;

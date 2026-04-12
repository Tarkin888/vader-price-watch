import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const SOURCES = ["Heritage", "Hakes", "LCG", "Vectis", "CandT"];
const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "#4CAF50",
  PARTIAL: "#FF9800",
  FAILED: "#F44336",
};

interface ScrapeSession {
  id: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: string;
  phase1_anchors: number;
  phase1_walks: number;
  lots_visited: number;
  moc_passed: number;
  new_inserted: number;
  duplicates_skipped: number;
  errors: number;
  error_summary: string | null;
  scraper_version: string | null;
  created_at: string;
}

const fmtDate = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
};

const deriveStatus = (s: ScrapeSession): string => {
  if (s.errors > 0 && s.new_inserted === 0) return "FAILED";
  if (s.errors > 0 && s.new_inserted > 0) return "PARTIAL";
  return "SUCCESS";
};

const ScrapeHistoryPanel = () => {
  const [sessions, setSessions] = useState<ScrapeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState("ALL");

  const fetchSessions = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase
        .from("scrape_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      setSessions((data as ScrapeSession[] | null) ?? []);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const filtered = filterSource === "ALL"
    ? sessions
    : sessions.filter((s) => s.source === filterSource);

  // Summary stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = sessions.filter((s) => new Date(s.started_at) >= monthStart);
  const totalThisMonth = thisMonth.length;
  const avgInsertRate = thisMonth.length > 0
    ? (thisMonth.reduce((a, s) => a + s.new_inserted, 0) / thisMonth.length).toFixed(1)
    : "0";

  const lastSuccessful: Record<string, ScrapeSession | null> = {};
  for (const src of SOURCES) {
    lastSuccessful[src] = sessions.find((s) => s.source === src && deriveStatus(s) === "SUCCESS") ?? null;
  }

  const STALE_DAYS = 14;
  const staleThreshold = new Date(now.getTime() - STALE_DAYS * 86400000);
  const staleSources = SOURCES.filter((src) => {
    const last = lastSuccessful[src];
    return !last || new Date(last.started_at) < staleThreshold;
  });

  const inputStyle = {
    background: "#111110",
    border: "1px solid rgba(201,168,76,0.3)",
    color: "#e0d8c0",
    padding: "8px 12px",
    borderRadius: 4,
    fontSize: 13,
    minHeight: 44,
  };

  if (loading) {
    return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading scrape history…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs tracking-wider font-bold" style={{ color: "#C9A84C" }}>SCRAPE HISTORY</h3>
        <div className="flex items-center gap-2">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            style={inputStyle}
          >
            <option value="ALL">All Sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={fetchSessions} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
            <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded p-3" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "#0D0D0B" }}>
          <p className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.5)" }}>SESSIONS THIS MONTH</p>
          <p className="text-lg font-bold" style={{ color: "#C9A84C", fontFamily: "Courier New" }}>{totalThisMonth}</p>
        </div>
        <div className="rounded p-3" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "#0D0D0B" }}>
          <p className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.5)" }}>AVG INSERT RATE</p>
          <p className="text-lg font-bold" style={{ color: "#C9A84C", fontFamily: "Courier New" }}>{avgInsertRate}</p>
        </div>
        {SOURCES.map((src) => {
          const last = lastSuccessful[src];
          const isStale = staleSources.includes(src);
          return (
            <div key={src} className="rounded p-3" style={{ border: `1px solid ${isStale ? "rgba(255,152,0,0.4)" : "rgba(201,168,76,0.2)"}`, background: "#0D0D0B" }}>
              <div className="flex items-center gap-1">
                <p className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.5)" }}>{src.toUpperCase()}</p>
                {isStale && <AlertTriangle className="w-3 h-3" style={{ color: "#FF9800" }} />}
              </div>
              <p className="text-[11px]" style={{ color: isStale ? "#FF9800" : "#e0d8c0", fontFamily: "Courier New" }}>
                {last ? fmtDate(last.started_at) : "Never"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Sessions table */}
      {filtered.length === 0 ? (
        <p className="italic text-center py-4" style={{ color: "rgba(224,216,192,0.5)" }}>No scrape sessions recorded yet.</p>
      ) : (
        <div className="table-scroll-wrapper rounded" style={{ border: "1px solid rgba(201,168,76,0.2)" }}>
          <table className="w-full text-[11px]" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
                {["Date/Time", "Source", "Status", "Lots Found", "MOC Passed", "Inserted", "Errors", "Duration", "Version", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-bold tracking-wider" style={{ color: "rgba(224,216,192,0.6)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const status = deriveStatus(s);
                const statusColor = STATUS_COLORS[status] || "#666";
                const isExpanded = expandedId === s.id;
                return (
                  <>
                    <tr
                      key={s.id}
                      style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110", cursor: s.error_summary ? "pointer" : "default" }}
                      onClick={() => s.error_summary && setExpandedId(isExpanded ? null : s.id)}
                    >
                      <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{fmtDate(s.started_at)}</td>
                      <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{s.source}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${statusColor}33`, color: statusColor }}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{s.lots_visited}</td>
                      <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{s.moc_passed}</td>
                      <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{s.new_inserted}</td>
                      <td className="px-3 py-2" style={{ color: s.errors > 0 ? "#F44336" : "#e0d8c0" }}>{s.errors}</td>
                      <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{s.duration_seconds != null ? `${s.duration_seconds}s` : "—"}</td>
                      <td className="px-3 py-2" style={{ color: "rgba(224,216,192,0.5)" }}>{s.scraper_version || "—"}</td>
                      <td className="px-3 py-2">
                        {s.error_summary && (isExpanded ? <ChevronUp className="w-3 h-3" style={{ color: "#C9A84C" }} /> : <ChevronDown className="w-3 h-3" style={{ color: "#C9A84C" }} />)}
                      </td>
                    </tr>
                    {isExpanded && s.error_summary && (
                      <tr key={`${s.id}-err`} style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
                        <td colSpan={10} className="px-3 py-2">
                          <pre className="text-[10px] whitespace-pre-wrap" style={{ color: "#F44336", fontFamily: "Courier New", maxHeight: 200, overflow: "auto" }}>
                            {s.error_summary}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScrapeHistoryPanel;

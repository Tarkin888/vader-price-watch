import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  INSERT: "#4CAF50", EDIT: "#2196F3", DELETE: "#F44336", RECLASSIFY: "#C9A84C", IMPORT: "#9B59B6",
};

interface AuditEntry {
  id: string;
  lot_id: string | null;
  lot_ref: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const AdminAuditLogTab = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [actionFilter, setActionFilter] = useState("All");
  const [lotRefSearch, setLotRefSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      setEntries((data ?? []) as AuditEntry[]);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 300000); return () => clearInterval(id); }, [fetchAll]);

  const filtered = useMemo(() => entries.filter((e) => {
    if (actionFilter !== "All" && e.action !== actionFilter) return false;
    if (lotRefSearch && !(e.lot_ref || "").toLowerCase().includes(lotRefSearch.toLowerCase())) return false;
    if (dateFrom) {
      const d = new Date(e.created_at).toISOString().slice(0, 10);
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const d = new Date(e.created_at).toISOString().slice(0, 10);
      if (d > dateTo) return false;
    }
    return true;
  }), [entries, actionFilter, lotRefSearch, dateFrom, dateTo]);

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
  };

  const truncate = (s: string | null, id: string, field: string) => {
    if (!s) return "—";
    const key = `${id}-${field}`;
    if (expandedCell === key) return <span>{s} <button onClick={() => setExpandedCell(null)} className="underline" style={{ color: "#C9A84C" }}>Less</button></span>;
    if (s.length <= 60) return s;
    return <span>{s.slice(0, 60)}… <button onClick={() => setExpandedCell(key)} className="underline" style={{ color: "#C9A84C" }}>More</button></span>;
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, fontSize: 13, minHeight: 44,
  };

  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading audit log…</p>;

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-wider font-bold" style={{ color: "#C9A84C" }}>AUDIT LOG</h2>
        <button onClick={fetchAll} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
          <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="All">All Actions</option>
          {["INSERT", "EDIT", "DELETE", "RECLASSIFY", "IMPORT"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={lotRefSearch} onChange={(e) => setLotRefSearch(e.target.value)} placeholder="Search lot ref…" style={{ ...inputStyle, width: 180 }} />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="italic text-center py-8" style={{ color: "rgba(224,216,192,0.5)" }}>
          No audit log entries yet. Entries are created automatically when lots are edited, imported, deleted, or reclassified.
        </p>
      ) : (
        <div className="overflow-x-auto rounded" style={{ border: "1px solid rgba(201,168,76,0.2)" }}>
          <table className="w-full text-[11px]" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
                {["Date", "Action", "Lot Ref", "Field", "Old Value", "New Value"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-bold tracking-wider" style={{ color: "rgba(224,216,192,0.6)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
                  <td className="px-3 py-2" style={{ color: "#e0d8c0", whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${ACTION_COLORS[e.action] || "#666"}33`, color: ACTION_COLORS[e.action] || "#666" }}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{e.lot_ref || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "#e0d8c0" }}>{e.field_changed || "—"}</td>
                  <td className="px-3 py-2" style={{ color: "#e0d8c0", maxWidth: 200 }}>{truncate(e.old_value, e.id, "old")}</td>
                  <td className="px-3 py-2" style={{ color: "#e0d8c0", maxWidth: 200 }}>{truncate(e.new_value, e.id, "new")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogTab;

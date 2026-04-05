import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { useConfig } from "@/hooks/use-config";

interface ConfigRow {
  key: string;
  value: string;
  label: string | null;
  updated_at: string | null;
}

const PRICING_KEYS = [
  "usd_gbp_rate", "heritage_bp_rate", "hakes_bp_rate", "lcg_bp_rate",
  "vectis_bp_rate", "candt_bp_rate", "heritage_price_floor_usd", "notable_sales_threshold_gbp",
];

const AdminConfigTab = () => {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showPin, setShowPin] = useState(false);
  const configCtx = useConfig();

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase.from("admin_config").select("*").order("key");
      const r = (data ?? []) as ConfigRow[];
      setRows(r);
      const vals: Record<string, string> = {};
      for (const row of r) vals[row.key] = row.value;
      setEditValues(vals);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 300000); return () => clearInterval(id); }, [fetchAll]);

  const handleSave = async (key: string) => {
    const val = editValues[key];
    if (val === undefined) return;
    const { error } = await supabase.from("admin_config").update({ value: val, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) { toast.error("Save failed: " + error.message); return; }

    // Update ConfigContext by triggering re-render (force refetch)
    // The simplest approach: mutate the window to signal config update
    setSavedKeys((s) => new Set(s).add(key));
    setTimeout(() => setSavedKeys((s) => { const n = new Set(s); n.delete(key); return n; }), 2000);

    if (key === "admin_pin") {
      sessionStorage.setItem("admin_auth", "true");
    }

    // Force config context refresh by dispatching a custom event
    window.dispatchEvent(new CustomEvent("config-updated"));
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, fontSize: 13, minHeight: 44,
  };

  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading config…</p>;

  const pricingRows = rows.filter((r) => PRICING_KEYS.includes(r.key));
  const pinRow = rows.find((r) => r.key === "admin_pin");

  const isDecimal = (key: string) => ["usd_gbp_rate", "heritage_bp_rate", "hakes_bp_rate", "lcg_bp_rate", "vectis_bp_rate", "candt_bp_rate"].includes(key);

  return (
    <div className="space-y-6 relative">
      <button onClick={fetchAll} className="absolute top-0 right-0 p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
        <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
      </button>

      {/* Pricing Parameters */}
      <div>
        <h2 className="text-xs tracking-wider font-bold mb-4" style={{ color: "#C9A84C" }}>PRICING PARAMETERS</h2>
        <div className="space-y-2">
          {pricingRows.map((r, i) => (
            <div key={r.key} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
              <span className="text-[12px] sm:w-64 flex-shrink-0" style={{ color: "#e0d8c0" }}>{r.label || r.key}</span>
              <input
                type="number"
                inputMode={isDecimal(r.key) ? "decimal" : "numeric"}
                step={isDecimal(r.key) ? "0.001" : "1"}
                value={editValues[r.key] ?? ""}
                onChange={(e) => setEditValues((v) => ({ ...v, [r.key]: e.target.value }))}
                className="flex-1"
                style={inputStyle}
              />
              {savedKeys.has(r.key) ? (
                <span className="text-[11px] font-bold sm:w-20 text-center" style={{ color: "#C9A84C" }}>Saved ✓</span>
              ) : (
                <button onClick={() => handleSave(r.key)} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider sm:w-20" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
                  SAVE
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(201,168,76,0.2)" }} />

      {/* Access */}
      <div>
        <h2 className="text-xs tracking-wider font-bold mb-4" style={{ color: "#C9A84C" }}>ACCESS</h2>
        {pinRow && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded" style={{ background: "#0D0D0B" }}>
            <span className="text-[12px] sm:w-64 flex-shrink-0" style={{ color: "#e0d8c0" }}>Admin PIN</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type={showPin ? "text" : "password"}
                value={editValues["admin_pin"] ?? ""}
                onChange={(e) => setEditValues((v) => ({ ...v, admin_pin: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => setShowPin(!showPin)} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {savedKeys.has("admin_pin") ? (
              <span className="text-[11px] font-bold sm:w-20 text-center" style={{ color: "#C9A84C" }}>Saved ✓</span>
            ) : (
              <button onClick={() => handleSave("admin_pin")} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider sm:w-20" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
                SAVE
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConfigTab;

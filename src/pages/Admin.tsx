import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import AdminOverviewTab from "@/components/admin/OverviewTab";
import AdminScrapersTab from "@/components/admin/ScrapersTab";
import AdminDataTab from "@/components/admin/DataTab";
import AdminKnowledgeTab from "@/components/admin/KnowledgeTab";
import AdminBugReportsTab from "@/components/admin/BugReportsTab";
import AdminConfigTab from "@/components/admin/ConfigTab";
import AdminAuditLogTab from "@/components/admin/AuditLogTab";

const TABS = [
  { key: "overview", label: "OVERVIEW" },
  { key: "scrapers", label: "SCRAPERS" },
  { key: "data", label: "DATA" },
  { key: "knowledge-hub", label: "KNOWLEDGE HUB" },
  { key: "bug-reports", label: "BUG REPORTS" },
  { key: "config", label: "CONFIG" },
  { key: "audit-log", label: "AUDIT LOG" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const Admin = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  const getHash = (): TabKey => {
    const h = window.location.hash.replace("#", "") as TabKey;
    return TABS.some((t) => t.key === h) ? h : "overview";
  };
  const [activeTab, setActiveTab] = useState<TabKey>(getHash);

  useEffect(() => {
    const handler = () => setActiveTab(getHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const switchTab = (key: TabKey) => {
    window.location.hash = key;
    setActiveTab(key);
  };

  const handleAuth = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const { data } = await supabase
        .from("admin_config")
        .select("value")
        .eq("key", "admin_pin")
        .single();
      if (data && pin === data.value) {
        sessionStorage.setItem("admin_auth", "true");
        setAuthed(true);
      } else {
        toast.error("ACCESS DENIED — Invalid PIN");
      }
    } finally {
      setChecking(false);
    }
  }, [pin, checking]);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080806" }}>
        <div
          className="w-full max-w-sm p-8 rounded-lg"
          style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}
        >
          <h1
            className="text-center text-lg font-bold tracking-widest mb-1"
            style={{ color: "#C9A84C", fontFamily: "Aptos, sans-serif" }}
          >
            IMPERIAL PRICE TERMINAL
          </h1>
          <p className="text-center text-xs tracking-wider mb-6" style={{ color: "#e0d8c0", opacity: 0.6 }}>
            ADMIN ACCESS
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="PIN"
            className="w-full text-center text-2xl tracking-[0.5em] py-3 rounded border mb-4"
            style={{
              background: "#111110",
              border: "1px solid rgba(201,168,76,0.3)",
              color: "#C9A84C",
              fontFamily: "Aptos, sans-serif",
            }}
          />
          <button
            onClick={handleAuth}
            disabled={checking || pin.length < 4}
            className="w-full py-3 rounded text-xs font-bold tracking-widest"
            style={{
              background: "#C9A84C",
              color: "#080806",
              opacity: checking || pin.length < 4 ? 0.5 : 1,
              minHeight: 44,
            }}
          >
            {checking ? "CHECKING…" : "AUTHENTICATE"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080806", color: "#e0d8c0" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 md:px-6 h-[52px] border-b"
        style={{ borderColor: "rgba(201,168,76,0.2)" }}
      >
        <Link to="/" className="text-sm font-bold tracking-widest" style={{ color: "#C9A84C" }}>
          IMPERIAL PRICE TERMINAL
        </Link>
        <span className="text-[10px] tracking-widest" style={{ color: "#e0d8c0", opacity: 0.5 }}>
          ADMIN DASHBOARD
        </span>
      </header>

      {/* Tab bar */}
      <div
        className="flex items-center gap-0 border-b overflow-x-auto"
        style={{ borderColor: "rgba(201,168,76,0.2)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className="flex-shrink-0 px-4 py-3 text-[11px] font-bold tracking-wider transition-colors"
            style={{
              color: activeTab === t.key ? "#C9A84C" : "rgba(224,216,192,0.6)",
              borderBottom: activeTab === t.key ? "2px solid #C9A84C" : "2px solid transparent",
              minHeight: 44,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === "overview" && <AdminOverviewTab />}
        {activeTab === "scrapers" && <AdminScrapersTab />}
        {activeTab === "data" && <AdminDataTab />}
        {activeTab === "knowledge-hub" && <AdminKnowledgeTab />}
        {activeTab === "bug-reports" && <AdminBugReportsTab />}
        {activeTab === "config" && <AdminConfigTab />}
        {activeTab === "audit-log" && <AdminAuditLogTab />}
      </div>

      {/* Footer */}
      <footer
        className="text-center text-[10px] py-2 border-t tracking-widest"
        style={{ color: "rgba(224,216,192,0.4)", borderColor: "rgba(201,168,76,0.15)" }}
      >
        IMPERIAL PRICE TERMINAL v4.1 — ADMIN
      </footer>
    </div>
  );
};

export default Admin;

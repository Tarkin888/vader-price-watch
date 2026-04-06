import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import AdminOverviewTab from "@/components/admin/OverviewTab";
import AdminScrapersTab from "@/components/admin/ScrapersTab";
import AdminDataTab from "@/components/admin/DataTab";
import AdminKnowledgeTab from "@/components/admin/KnowledgeTab";
import AdminBugReportsTab from "@/components/admin/BugReportsTab";
import AdminConfigTab from "@/components/admin/ConfigTab";
import AdminAuditLogTab from "@/components/admin/AuditLogTab";
import AdminUsersTab from "@/components/admin/UsersTab";

const TABS = [
  { key: "overview", label: "OVERVIEW" },
  { key: "scrapers", label: "SCRAPERS" },
  { key: "data", label: "DATA" },
  { key: "knowledge-hub", label: "KNOWLEDGE HUB" },
  { key: "bug-reports", label: "BUG REPORTS" },
  { key: "config", label: "CONFIG" },
  { key: "audit-log", label: "AUDIT LOG" },
  { key: "users", label: "USERS" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const Admin = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [urlChecked, setUrlChecked] = useState(() => sessionStorage.getItem("admin_auth") === "true");

  // Auto-auth from URL ?pin= parameter
  useEffect(() => {
    if (authed) { setUrlChecked(true); return; }
    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get("pin");
    if (!urlPin) { setUrlChecked(true); return; }
    supabase.functions.invoke("admin-verify-pin", { body: { pin: urlPin } }).then(({ data }) => {
      if (data?.valid) {
        sessionStorage.setItem("admin_auth", "true");
        sessionStorage.setItem("admin_pin", urlPin);
        setAuthed(true);
      }
      history.replaceState(null, "", "/admin" + window.location.hash);
      setUrlChecked(true);
    });
  }, []);

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
      const { data } = await supabase.functions.invoke("admin-verify-pin", {
        body: { pin },
      });
      if (data?.valid) {
        sessionStorage.setItem("admin_auth", "true");
        sessionStorage.setItem("admin_pin", pin);
        setAuthed(true);
      } else {
        toast.error("ACCESS DENIED — Invalid PIN");
      }
    } finally {
      setChecking(false);
    }
  }, [pin, checking]);

  if (authLoading) {
    return <div className="min-h-screen" style={{ background: "#080806" }} />;
  }

  // Non-admin users see access restricted
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080806" }}>
        <div className="text-center">
          <p className="text-lg font-bold tracking-widest mb-4" style={{ color: "#C9A84C" }}>ACCESS RESTRICTED</p>
          <p className="text-sm mb-6" style={{ color: "#e0d8c0", opacity: 0.6 }}>Admin access is required to view this page.</p>
          <Link to="/" className="text-xs tracking-widest px-4 py-3 rounded" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44, display: "inline-block" }}>
            BACK TO DASHBOARD
          </Link>
        </div>
      </div>
    );
  }

  if (!urlChecked) {
    return <div className="min-h-screen" style={{ background: "#080806" }} />;
  }

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
        className="admin-tab-bar items-center gap-0 border-b"
        style={{ borderColor: "rgba(201,168,76,0.2)" }}
        ref={(el) => {
          if (el) {
            const active = el.querySelector('[data-active="true"]') as HTMLElement | null;
            if (active) active.scrollIntoView({ inline: "center", block: "nearest" });
          }
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            data-active={activeTab === t.key}
            onClick={() => switchTab(t.key)}
            className="flex-shrink-0 px-4 py-3 text-[11px] font-bold tracking-wider transition-colors whitespace-nowrap"
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
        {activeTab === "users" && <AdminUsersTab />}
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

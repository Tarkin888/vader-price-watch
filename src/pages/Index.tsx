import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllLots, fixUnknownEraCardback, type Lot } from "@/lib/db";
import Header from "@/components/Header";
import FilterBar, { type Filters } from "@/components/FilterBar";
import StatsBar from "@/components/StatsBar";
import ScatterChartPanel from "@/components/ScatterChartPanel";
import PriceTrendChart from "@/components/PriceTrendChart";
import ReferencePanel from "@/components/ReferencePanel";
import LotsTable from "@/components/LotsTable";
import ExportCSV from "@/components/ExportCSV";
import ImportCSV from "@/components/ImportCSV";
import AddLotModal from "@/components/AddLotModal";
import SessionLog from "@/components/SessionLog";
import SummaryDashboard from "@/components/SummaryDashboard";
import NotableSalesBanner from "@/components/NotableSalesBanner";
import ComparableSalesPanel from "@/components/ComparableSalesPanel";
import CardbackBenchmarkPanel from "@/components/CardbackBenchmarkPanel";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const validTabs = ["dashboard", "table", "chart", "session"] as const;
  type Tab = typeof validTabs[number];
  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "dashboard"
  );
  const changeTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [copiedRows, setCopiedRows] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [filters, setFilters] = useState<Filters>(() => ({
    source: searchParams.get("source") || null,
    era: searchParams.get("era") || null,
    cardbackCode: searchParams.get("cardback") || null,
    variantCode: searchParams.get("variant") || null,
    gradeTier: searchParams.get("grade") || null,
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : null,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : null,
    search: searchParams.get("q") || "",
    currency: (searchParams.get("currency") as "GBP" | "USD") || "GBP",
  }));

  const updateFilters = useCallback((f: Filters) => {
    setFilters(f);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const map: [string, string | null][] = [
        ["source", f.source],
        ["era", f.era],
        ["cardback", f.cardbackCode],
        ["variant", f.variantCode],
        ["grade", f.gradeTier],
        ["dateFrom", f.dateFrom ? f.dateFrom.toISOString().slice(0, 10) : null],
        ["dateTo", f.dateTo ? f.dateTo.toISOString().slice(0, 10) : null],
        ["q", f.search || null],
        ["currency", f.currency === "GBP" ? null : f.currency],
      ];
      for (const [key, val] of map) {
        if (val) next.set(key, val); else next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const loadLots = useCallback(async () => {
    try {
      
      await fixUnknownEraCardback();
      const data = await getAllLots();
      setLots(data);
    } catch (e) {
      console.error("Failed to load lots:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLots(); }, [loadLots]);

  // Cross-reference: read variant from URL params handled by initial state

  const filtered = useMemo(() => {
    return lots.filter((l) => {
      if (filters.source && l.source !== filters.source) return false;
      if (filters.era && (l as any).era !== filters.era) return false;
      if (filters.cardbackCode && (l as any).cardback_code !== filters.cardbackCode) return false;
      if (filters.variantCode && l.variant_code !== filters.variantCode) return false;
      if (filters.gradeTier && l.grade_tier_code !== filters.gradeTier) return false;
      if (filters.dateFrom && new Date(l.sale_date) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(l.sale_date) > filters.dateTo) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          l.lot_ref, l.condition_notes, l.variant_code, l.grade_tier_code,
          l.variant_grade_key, l.source, l.grade_subgrades,
          (l as any).era, (l as any).cardback_code,
        ].join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [lots, filters]);

  const lastScrape = lots.length > 0
    ? lots.reduce((latest, l) => (l.capture_date > latest ? l.capture_date : latest), lots[0].capture_date)
    : null;

  const handleCopyRow = (lot: Lot) => {
    setCopiedRows((prev) => [...prev, lot]);
  };

  const [reclassifying, setReclassifying] = useState(false);
  const handleReclassify = async () => {
    setReclassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("reclassify-unknowns");
      if (error) throw error;
      const result = data as { updated: number; total_candidates: number };
      toast.success(`Re-classified ${result.updated} of ${result.total_candidates} unknown lot(s)`);
      if (result.updated > 0) loadLots();
    } catch (e: any) {
      toast.error("Re-classify failed: " + (e.message || "Unknown error"));
    } finally {
      setReclassifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-primary text-sm tracking-widest" style={{ animation: "flicker 2s infinite" }}>
          LOADING IMPERIAL DATABASE...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header totalRecords={lots.length} lastScrapeDate={lastScrape} currency={filters.currency} onCurrencyToggle={() => updateFilters({ ...filters, currency: filters.currency === "GBP" ? "USD" : "GBP" })} />
      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <button className="text-[10px] tracking-widest px-3 py-1 text-primary border-b border-primary" aria-current="page">
          PRICE TRACKER
        </button>
        <button
          onClick={() => navigate("/knowledge")}
          className="text-[10px] tracking-widest px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          KNOWLEDGE HUB
        </button>
        <button
          onClick={() => navigate("/collection")}
          className="text-[10px] tracking-widest px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          MY COLLECTION
        </button>
        <ReferencePanel />
      </div>
      <FilterBar filters={filters} onChange={updateFilters} />
      <StatsBar lots={filtered} filters={filters} currency={filters.currency} />
      <CardbackBenchmarkPanel
        allLots={lots}
        currency={filters.currency}
        onSelectCardback={(code) => {
          updateFilters({ ...filters, cardbackCode: code });
          changeTab("table");
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }}
      />
      <PriceTrendChart lots={filtered} />
      <div ref={resultsRef} className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => changeTab("dashboard")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "dashboard" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            DASHBOARD
          </button>
          <button
            onClick={() => changeTab("table")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "table" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            RESULTS
          </button>
          <button
            onClick={() => changeTab("chart")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "chart" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            PRICE CHART
          </button>
          <button
            onClick={() => changeTab("session")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "session" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            SESSION LOG {copiedRows.length > 0 && `(${copiedRows.length})`}
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleReclassify}
            disabled={reclassifying}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary tracking-wider transition-colors px-3 py-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reclassifying ? "animate-spin" : ""}`} />
            {reclassifying ? "RE-CLASSIFYING..." : "RE-CLASSIFY UNKNOWNS"}
          </button>
          <AddLotModal onAdded={loadLots} />
          <ImportCSV onImported={loadLots} />
          <ExportCSV lots={filtered} />
        </div>
      </div>
      <div className="flex-1">
        {activeTab === "dashboard" ? (
          <SummaryDashboard lots={filtered} allLots={lots} />
        ) : activeTab === "table" ? (
          <>
            <NotableSalesBanner lots={filtered} />
            <LotsTable lots={filtered} onChanged={loadLots} onCopyRow={handleCopyRow} onSelectLot={setSelectedLot} currency={filters.currency} />
          </>
        ) : activeTab === "chart" ? (
          <ScatterChartPanel lots={lots} currency={filters.currency} />
        ) : (
          <SessionLog copiedRows={copiedRows} onClear={() => setCopiedRows([])} />
        )}
      </div>

      {selectedLot && (
        <ComparableSalesPanel
          lot={selectedLot}
          allLots={lots}
          onClose={() => setSelectedLot(null)}
        />
      )}

      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-widest">
        IMPERIAL PRICE TERMINAL v4.0 • GALACTIC EMPIRE • CLASSIFIED
      </footer>
    </div>
  );
};

export default Index;

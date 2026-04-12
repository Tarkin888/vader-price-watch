import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllLots, fixUnknownEraCardback, type Lot } from "@/lib/db";
import Header from "@/components/Header";
import FilterBar, { type Filters } from "@/components/FilterBar";
import ScatterChartPanel from "@/components/ScatterChartPanel";
import PriceTrendChart from "@/components/PriceTrendChart";

import LotsTable from "@/components/LotsTable";
import ToolsDropdown from "@/components/ToolsDropdown";

import SummaryDashboard from "@/components/SummaryDashboard";
import NotableSalesBanner from "@/components/NotableSalesBanner";

import CardbackBenchmarkPanel from "@/components/CardbackBenchmarkPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Menu, X, Camera, LayoutGrid, List } from "lucide-react";
import ScreenshotModal from "@/components/screenshot/ScreenshotModal";
import PriceTrackerTileView from "@/components/PriceTrackerTileView";
import Pagination from "@/components/Pagination";

function calcQuickStats(lots: Lot[], isUSD: boolean) {
  const priced = lots.filter((l) => (l as any).price_status !== "ESTIMATE_ONLY" && Number(l.total_paid_gbp) > 0);
  const prices = priced.map((l) => {
    const gbp = Number(l.total_paid_gbp);
    if (!isUSD) return gbp;
    const rate = Number(l.usd_to_gbp_rate);
    return rate > 0 ? Math.round(gbp / rate) : 0;
  });
  return {
    count: lots.length,
    avg: prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0,
    max: prices.length > 0 ? Math.max(...prices) : 0,
    min: prices.length > 0 ? Math.min(...prices) : 0,
  };
}

const fmtPrice = (n: number, isUSD: boolean) =>
  isUSD ? `$${Math.round(n).toLocaleString("en-US")}` : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const validTabs = ["dashboard", "table", "tile", "chart"] as const;
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
  const [highlightLotId, setHighlightLotId] = useState<string | null>(null);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showPriceTrend, setShowPriceTrend] = useState(false);
  const [quickImportOpen, setQuickImportOpen] = useState(false);
  // viewMode removed — activeTab now controls all views exclusively (dashboard | table | tile | chart)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState<Filters>(() => {
    const parseDate = (s: string | null): Date | null => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    return {
      source: searchParams.get("source") || null,
      era: searchParams.get("era") || null,
      cardbackCode: searchParams.get("cardback") || null,
      variantCode: searchParams.get("variant") || null,
      gradeTier: searchParams.get("grade") || null,
      dateFrom: parseDate(searchParams.get("dateFrom")),
      dateTo: parseDate(searchParams.get("dateTo")),
      search: searchParams.get("q") || "",
      currency: (searchParams.get("currency") as "GBP" | "USD") || "GBP",
    };
  });

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
        ["dateFrom", f.dateFrom && !isNaN(f.dateFrom.getTime()) ? f.dateFrom.toISOString().slice(0, 10) : null],
        ["dateTo", f.dateTo && !isNaN(f.dateTo.getTime()) ? f.dateTo.toISOString().slice(0, 10) : null],
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


  const filtered = useMemo(() => {
    return lots.filter((l) => {
      if (filters.source && l.source !== filters.source) return false;
      if (filters.era && (l as any).era !== filters.era) return false;
      if (filters.cardbackCode && (l as any).cardback_code !== filters.cardbackCode) return false;
      if (filters.variantCode && l.variant_code !== filters.variantCode) return false;
      if (filters.gradeTier && l.grade_tier_code !== filters.gradeTier) return false;
      if (filters.dateFrom && !isNaN(filters.dateFrom.getTime()) && new Date(l.sale_date) < filters.dateFrom) return false;
      if (filters.dateTo && !isNaN(filters.dateTo.getTime()) && new Date(l.sale_date) > filters.dateTo) return false;
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

  const isUSD = filters.currency === "USD";
  const quickStats = useMemo(() => calcQuickStats(filtered, isUSD), [filtered, isUSD]);

  // Reset to page 1 whenever filters or tab change
  useEffect(() => { setCurrentPage(1); }, [filters, activeTab]);

  // Paginated slice for Table and Tile views
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLots = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    // Scroll to top of results
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [totalPages]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-primary text-sm tracking-wider" style={{ animation: "flicker 2s infinite" }}>
          Loading Imperial Database...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header totalRecords={lots.length} lastScrapeDate={lastScrape} currency={filters.currency} onCurrencyToggle={() => updateFilters({ ...filters, currency: filters.currency === "GBP" ? "USD" : "GBP" })} />
      <div className="hidden md:flex items-center gap-1 border-b border-border px-6 py-2">
        <button className="text-[10px] tracking-wider px-3 py-1 text-primary border-b border-primary" aria-current="page">
          Price Tracker
        </button>
        <button
          onClick={() => navigate("/knowledge")}
          className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          Knowledge Hub
        </button>
        <button
          onClick={() => navigate("/collection")}
          className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          My Collection
        </button>
      </div>
      {/* Mobile hamburger */}
      <div className="md:hidden flex items-center justify-between border-b border-border px-4 py-2">
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="text-muted-foreground hover:text-primary transition-colors">
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {mobileNavOpen && (
        <div className="md:hidden border-b border-border bg-secondary/50 px-4 py-2 flex flex-col gap-1">
          <button className="text-[11px] tracking-wider px-3 py-2 text-primary text-left" aria-current="page">Price Tracker</button>
          <button onClick={() => { setMobileNavOpen(false); navigate("/knowledge"); }} className="text-[11px] tracking-wider px-3 py-2 text-muted-foreground hover:text-primary text-left transition-colors">Knowledge Hub</button>
          <button onClick={() => { setMobileNavOpen(false); navigate("/collection"); }} className="text-[11px] tracking-wider px-3 py-2 text-muted-foreground hover:text-primary text-left transition-colors">My Collection</button>
        </div>
      )}
      <FilterBar filters={filters} onChange={updateFilters} />

      {/* Tab bar with inline stats */}
      <div ref={resultsRef} className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border px-4 md:px-6 py-2 gap-1 md:gap-0">
        <div className="flex flex-col md:flex-row md:items-center gap-1">
          <span className="text-[11px] text-muted-foreground tracking-wider md:mr-3">
            {quickStats.count} records
            <span className="ml-2">Avg <span className="text-primary font-bold">{fmtPrice(quickStats.avg, isUSD)}</span></span>
            <span className="ml-2">Low <span className="text-primary font-bold">{fmtPrice(quickStats.min, isUSD)}</span></span>
            <span className="ml-2">High <span className="text-primary font-bold">{fmtPrice(quickStats.max, isUSD)}</span></span>
          </span>
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => changeTab("dashboard")}
              className={`text-[10px] tracking-wider px-3 py-1 transition-colors whitespace-nowrap ${activeTab === "dashboard" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => changeTab("chart")}
              className={`text-[10px] tracking-wider px-3 py-1 transition-colors whitespace-nowrap ${activeTab === "chart" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              Price Chart
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => changeTab("table")}
              title="Table view"
              className="flex items-center justify-center w-8 h-8 transition-colors"
              style={{
                background: activeTab === "table" ? "rgba(201,168,76,0.15)" : "transparent",
                color: activeTab === "table" ? "#C9A84C" : "rgba(224,216,192,0.4)",
              }}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => changeTab("tile")}
              title="Tile view"
              className="flex items-center justify-center w-8 h-8 transition-colors"
              style={{
                background: activeTab === "tile" ? "rgba(201,168,76,0.15)" : "transparent",
                color: activeTab === "tile" ? "#C9A84C" : "rgba(224,216,192,0.4)",
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setQuickImportOpen(true)}
            title="Quick Import"
            className="flex items-center gap-1.5 text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors border border-border rounded"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <ToolsDropdown
            onReclassify={handleReclassify}
            reclassifying={reclassifying}
            onAdded={loadLots}
            onImported={loadLots}
            filteredLots={filtered}
            onShowBenchmark={() => setShowBenchmark(true)}
            onShowPriceTrend={() => setShowPriceTrend(true)}
          />
        </div>
      </div>
      <div className="flex-1">
        {activeTab === "dashboard" && (
          <>
            <SummaryDashboard
              lots={filtered}
              allLots={lots}
              currency={filters.currency}
            />
            <NotableSalesBanner lots={filtered} currency={filters.currency} />
          </>
        )}
        {activeTab === "table" && (
          <>
            <LotsTable lots={paginatedLots} allLots={lots} onChanged={loadLots} currency={filters.currency} highlightLotId={highlightLotId} />
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalRecords={filtered.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
        {activeTab === "tile" && (
          <>
            <PriceTrackerTileView lots={paginatedLots} currency={filters.currency} />
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalRecords={filtered.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
        {activeTab === "chart" && (
          <ScatterChartPanel lots={lots} currency={filters.currency} />
        )}
      </div>


      {/* Benchmark Panel slide-in */}
      <Sheet open={showBenchmark} onOpenChange={setShowBenchmark}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-background border-border p-0">
          <SheetHeader className="px-6 pt-4 pb-2">
            <SheetTitle className="text-primary text-sm tracking-wider font-medium">Benchmark Panel</SheetTitle>
          </SheetHeader>
          <CardbackBenchmarkPanel
            allLots={lots}
            currency={filters.currency}
            alwaysExpanded
            onSelectCardback={(code) => {
              updateFilters({ ...filters, cardbackCode: code });
              changeTab("dashboard");
              setShowBenchmark(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Price Trend slide-in */}
      <Sheet open={showPriceTrend} onOpenChange={setShowPriceTrend}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-background border-border p-0">
          <SheetHeader className="px-6 pt-4 pb-2">
            <SheetTitle className="text-primary text-sm tracking-wider font-medium">Price Trend</SheetTitle>
          </SheetHeader>
          <PriceTrendChart lots={filtered} alwaysExpanded currency={filters.currency} />
        </SheetContent>
      </Sheet>

      <ScreenshotModal open={quickImportOpen} onOpenChange={setQuickImportOpen} onSaved={loadLots} />

      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-wider">
        IMPERIAL PRICE TERMINAL v4.1 · Galactic Empire · Classified
      </footer>
    </div>
  );
};

export default Index;
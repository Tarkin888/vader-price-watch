import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllLots, seedIfEmpty, type Lot } from "@/lib/db";
import Header from "@/components/Header";
import FilterBar, { type Filters } from "@/components/FilterBar";
import StatsBar from "@/components/StatsBar";
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

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "table" | "session">("dashboard");
  const [copiedRows, setCopiedRows] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [filters, setFilters] = useState<Filters>({
    source: null,
    era: null,
    cardbackCode: null,
    variantCode: null,
    gradeTier: null,
    dateFrom: null,
    dateTo: null,
    search: "",
  });

  const loadLots = useCallback(async () => {
    try {
      await seedIfEmpty();
      const data = await getAllLots();
      setLots(data);
    } catch (e) {
      console.error("Failed to load lots:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLots(); }, [loadLots]);

  // Cross-reference: read variant from URL params
  useEffect(() => {
    const variant = searchParams.get("variant");
    if (variant) {
      setFilters((f) => ({ ...f, variantCode: variant }));
      setActiveTab("table");
    }
  }, [searchParams]);

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
      <Header totalRecords={lots.length} lastScrapeDate={lastScrape} />
      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <button className="text-[10px] tracking-widest px-3 py-1 text-primary border-b border-primary">
          PRICE TRACKER
        </button>
        <button
          onClick={() => navigate("/collection")}
          className="text-[10px] tracking-widest px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          MY COLLECTION
        </button>
      </div>
      <ReferencePanel />
      <FilterBar filters={filters} onChange={setFilters} />
      <StatsBar lots={filtered} filters={filters} />
      <PriceTrendChart lots={filtered} />
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "dashboard" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            DASHBOARD
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "table" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            RESULTS
          </button>
          <button
            onClick={() => setActiveTab("session")}
            className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${activeTab === "session" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            SESSION LOG {copiedRows.length > 0 && `(${copiedRows.length})`}
          </button>
        </div>
        <div className="flex gap-2">
          <AddLotModal onAdded={loadLots} />
          <ImportCSV onImported={loadLots} />
          <ExportCSV lots={filtered} />
        </div>
      </div>
      <div className="flex-1">
        {activeTab === "dashboard" ? (
          <SummaryDashboard lots={filtered} />
        ) : activeTab === "table" ? (
          <>
            <NotableSalesBanner lots={filtered} />
            <LotsTable lots={filtered} onChanged={loadLots} onCopyRow={handleCopyRow} onSelectLot={setSelectedLot} />
          </>
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
        IMPERIAL PRICE TERMINAL v3.0 • GALACTIC EMPIRE • CLASSIFIED
      </footer>
    </div>
  );
};

export default Index;

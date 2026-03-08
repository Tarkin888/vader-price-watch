import { useEffect, useState, useMemo, useCallback } from "react";
import { getAllLots, seedIfEmpty, type Lot } from "@/lib/db";
import Header from "@/components/Header";
import FilterBar, { type Filters } from "@/components/FilterBar";
import StatsBar from "@/components/StatsBar";
import PriceTrendChart from "@/components/PriceTrendChart";
import LotsTable from "@/components/LotsTable";
import ExportCSV from "@/components/ExportCSV";
import AddLotModal from "@/components/AddLotModal";

const Index = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    source: null,
    variantCode: null,
    gradeTier: null,
    dateFrom: null,
    dateTo: null,
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

  const filtered = useMemo(() => {
    return lots.filter((l) => {
      if (filters.source && l.source !== filters.source) return false;
      if (filters.variantCode && l.variant_code !== filters.variantCode) return false;
      if (filters.gradeTier && l.grade_tier_code !== filters.gradeTier) return false;
      if (filters.dateFrom && new Date(l.sale_date) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(l.sale_date) > filters.dateTo) return false;
      return true;
    });
  }, [lots, filters]);

  const lastScrape = lots.length > 0
    ? lots.reduce((latest, l) => (l.capture_date > latest ? l.capture_date : latest), lots[0].capture_date)
    : null;

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
      <FilterBar filters={filters} onChange={setFilters} />
      <StatsBar lots={filtered} />
      <div className="flex justify-end border-b border-border">
        <ExportCSV lots={filtered} />
      </div>
      <div className="flex-1">
        <LotsTable lots={filtered} />
      </div>
      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-widest">
        IMPERIAL PRICE TERMINAL v3.0 • GALACTIC EMPIRE • CLASSIFIED
      </footer>
    </div>
  );
};

export default Index;

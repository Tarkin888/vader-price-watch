import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAllCollectionItems, deleteCollectionItem, CATEGORIES, GRADINGS, type CollectionItem } from "@/lib/collection-db";
import CollectionFormModal from "@/components/CollectionFormModal";
import CollectionAnalytics from "@/components/CollectionAnalytics";
import CollectionPhotoGallery from "@/components/CollectionPhotoGallery";
import { Pencil, Trash2, Plus, Search, ArrowRight, Eye, EyeOff, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import ImageDropCell from "@/components/ImageDropCell";
import EstimatedValueCell from "@/components/EstimatedValueCell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CollectionFilters {
  category: string | null;
  grading: string | null;
  search: string;
}

const Collection = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CollectionFilters>({ category: null, grading: null, search: "" });
  const [editItem, setEditItem] = useState<CollectionItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CollectionItem | null>(null);
  const [subTab, setSubTab] = useState<"inventory" | "analytics" | "gallery">("inventory");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [bulkCalcing, setBulkCalcing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAllCollectionItems();
      setItems(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filters.category && i.category !== filters.category) return false;
      if (filters.grading && i.grading !== filters.grading) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (![i.description, i.notes, i.item_id, i.purchase_source].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filters]);

  const totalCost = items.reduce((s, i) => s + Number(i.purchase_price), 0);
  const portfolioValue = items.reduce((s, i) => s + Number(i.current_estimated_value ?? i.purchase_price), 0);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteCollectionItem(deleteItem.id);
      toast.success("Item deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setDeleteItem(null);
  };

  const getPnl = (item: CollectionItem) => {
    if (item.current_estimated_value == null) return null;
    return Number(item.current_estimated_value) - Number(item.purchase_price);
  };

  const getPnlColor = (pnl: number | null, item: CollectionItem) => {
    if (pnl == null) return "text-muted-foreground";
    const cost = Number(item.purchase_price);
    if (pnl > cost * 0.1) return "text-green-500";
    if (pnl >= -cost * 0.1) return "text-amber-500";
    return "text-red-500";
  };

  const handleFindComps = (item: CollectionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // Map collection category/grading to price tracker filter values
    const variantMap: Record<string, string> = {
      "12 BACK": "12A", // Default to 12A; user can adjust
    };
    const variant = variantMap[item.category] || null;
    // Navigate to price tracker with pre-set filters
    const params = new URLSearchParams();
    if (variant) params.set("variant", variant);
    navigate(`/?${params.toString()}`);
  };

  // Stats
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => { map[i.category] = (map[i.category] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const gradingBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => { map[i.grading] = (map[i.grading] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const mostExpensive = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((max, i) => Number(i.purchase_price) > Number(max.purchase_price) ? i : max, items[0]);
  }, [items]);

  const mostRecent = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((latest, i) => i.purchase_date > latest.purchase_date ? i : latest, items[0]);
  }, [items]);

  const CATEGORY_TO_VARIANTS: Record<string, string[]> = {
    "12 BACK": ["SW-12", "SW-12A", "SW-12B", "SW-12C", "SW-12A-DT", "SW-12B-DT", "12A", "12B", "12C", "12A-DT", "12B-DT"],
    "20 BACK": ["SW-20"],
    "21 BACK": ["SW-21"],
    "ESB": ["ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48"],
    "ROTJ": ["ROTJ-48", "ROTJ-65", "ROTJ-65-VP", "ROTJ-77", "ROTJ-79"],
    "SECRET OFFER": ["SW-20", "SW-21"],
    "FETT STICKER": ["SW-20", "SW-21"],
    "TRILOGO": ["ROTJ-65", "ROTJ-77"],
    "OTHER": [],
  };
  const CATEGORY_TO_ERA: Record<string, string> = {
    "12 BACK": "SW", "20 BACK": "SW", "21 BACK": "SW",
    "ESB": "ESB", "ROTJ": "ROTJ",
    "SECRET OFFER": "SW", "FETT STICKER": "SW",
    "TRILOGO": "ROTJ", "OTHER": "",
  };

  const handleBulkAutoCalc = async () => {
    setBulkCalcing(true);
    let updated = 0;
    let failed = 0;
    try {
      for (const item of items) {
        const variants = CATEGORY_TO_VARIANTS[item.category] || [];
        const fallbackEra = CATEGORY_TO_ERA[item.category] || "";
        if (variants.length === 0 && !fallbackEra) { failed++; continue; }

        const windows = [1, 2, 3, 0];
        let data: any[] | null = null;

        for (const years of windows) {
          if (variants.length === 0) break;
          let query = supabase.from("lots").select("total_paid_gbp").in("variant_code", variants as any);
          if (years > 0) {
            const cutoff = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - years);
            query = query.gte("sale_date", cutoff.toISOString().slice(0, 10));
          }
          const { data: result } = await query;
          if (result && result.length > 0) { data = result; break; }
        }

        if ((!data || data.length === 0) && fallbackEra) {
          for (const years of windows) {
            let query = supabase.from("lots").select("total_paid_gbp").eq("era", fallbackEra as any);
            if (years > 0) {
              const cutoff = new Date();
              cutoff.setFullYear(cutoff.getFullYear() - years);
              query = query.gte("sale_date", cutoff.toISOString().slice(0, 10));
            }
            const { data: result } = await query;
            if (result && result.length > 0) { data = result; break; }
          }
        }

        if (!data || data.length === 0) { failed++; continue; }
        const avg = Math.round(data.reduce((s: number, r: any) => s + Number(r.total_paid_gbp), 0) / data.length);
        const { error } = await supabase.from("collection").update({ current_estimated_value: avg } as any).eq("id", item.id);
        if (!error) updated++; else failed++;
      }
      toast.success(`Updated ${updated} item(s)${failed > 0 ? `, ${failed} could not be calculated` : ""}`);
      load();
    } catch (e: any) {
      toast.error("Bulk calculation failed: " + e.message);
    } finally {
      setBulkCalcing(false);
    }
  };

  const selectClass = "bg-secondary border border-border text-foreground text-xs px-2 py-1.5 tracking-wider focus:outline-none focus:ring-1 focus:ring-primary";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-primary text-sm tracking-widest" style={{ animation: "flicker 2s infinite" }}>
          LOADING COLLECTION...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-wider">
              My Collection — Personal Inventory
            </h1>
            <div className="mt-1 flex gap-6 text-xs text-muted-foreground tracking-wider">
              <span>TOTAL ITEMS: <span className="text-primary">{items.length}</span></span>
              <span>TOTAL COST: <span className="text-primary">£{totalCost.toLocaleString("en-GB")}</span></span>
              <span>PORTFOLIO VALUE: <span className="text-primary">£{portfolioValue.toLocaleString("en-GB")}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              size="sm"
              className="text-xs tracking-wider"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> ADD ITEM
            </Button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <button onClick={() => navigate("/")} className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors">Price Tracker</button>
        <button onClick={() => navigate("/knowledge")} className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors">Knowledge Hub</button>
        <button className="text-[10px] tracking-wider px-3 py-1 text-primary border-b border-primary">My Collection</button>
        <span className="text-muted-foreground/30 mx-2">|</span>
        <button onClick={() => setSubTab("inventory")} className={`text-[10px] tracking-wider px-3 py-1 transition-colors ${subTab === "inventory" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}>Inventory</button>
        <button onClick={() => setSubTab("analytics")} className={`text-[10px] tracking-wider px-3 py-1 transition-colors ${subTab === "analytics" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}>Analytics</button>
        <button onClick={() => setSubTab("gallery")} className={`text-[10px] tracking-wider px-3 py-1 transition-colors ${subTab === "gallery" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}>Photo Gallery</button>
      </div>

      {subTab === "analytics" ? (
        <CollectionAnalytics items={items} />
      ) : subTab === "gallery" ? (
        <CollectionPhotoGallery />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 px-6 py-3 border-b border-border">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search items..."
                  className="bg-secondary border-border text-xs tracking-wider pl-7 h-8 w-44"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Category</label>
              <select className={selectClass} value={filters.category ?? ""} onChange={(e) => setFilters({ ...filters, category: e.target.value || null })}>
                <option value="">ALL</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Grading</label>
              <select className={selectClass} value={filters.grading ?? ""} onChange={(e) => setFilters({ ...filters, grading: e.target.value || null })}>
                <option value="">ALL</option>
                {GRADINGS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <Button
              variant={privacyMode ? "default" : "outline"}
              size="sm"
              className="text-[10px] tracking-wider h-8"
              onClick={() => setPrivacyMode(!privacyMode)}
            >
              {privacyMode ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              PRIVACY {privacyMode ? "ON" : "OFF"}
            </Button>
            {!privacyMode && (
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] tracking-wider h-8"
                onClick={handleBulkAutoCalc}
                disabled={bulkCalcing || items.length === 0}
              >
                <Calculator className="w-3 h-3 mr-1" />
                {bulkCalcing ? "CALCULATING..." : "1-YR AVG ALL"}
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground tracking-wider text-left">
                  <th className="px-1.5 py-2">Item ID</th>
                  <th className="px-1.5 py-2">Front</th>
                  <th className="px-1.5 py-2">Back</th>
                  <th className="px-1.5 py-2">Description</th>
                  <th className="px-1.5 py-2">Category</th>
                  <th className="px-1.5 py-2">Grading</th>
                  {!privacyMode && <th className="px-1.5 py-2 text-right">Price (£)</th>}
                  <th className="px-1.5 py-2">Date</th>
                  <th className="px-1.5 py-2">Source</th>
                  {!privacyMode && <th className="px-1.5 py-2 text-right">Est. Value (£)</th>}
                  {!privacyMode && <th className="px-1.5 py-2 text-right">P&L (£)</th>}
                  <th className="px-1.5 py-2">Notes</th>
                  <th className="px-1.5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const pnl = getPnl(item);
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors" style={{ height: "7rem" }}>
                      <td className="px-1.5 py-2 text-muted-foreground whitespace-nowrap align-middle">{item.item_id}</td>
                      <td className="px-1.5 py-2 align-middle">
                        <ImageDropCell
                          imageUrl={item.front_image_url || ""}
                          itemId={item.id}
                          field="front_image_url"
                          onUpdated={load}
                        />
                      </td>
                      <td className="px-1.5 py-2 align-middle">
                        <ImageDropCell
                          imageUrl={item.back_image_url || ""}
                          itemId={item.id}
                          field="back_image_url"
                          onUpdated={load}
                        />
                      </td>
                      <td className="px-1.5 py-2 text-primary font-bold max-w-[200px] truncate align-middle" title={item.description}>{item.description}</td>
                      <td className="px-1.5 py-2 whitespace-nowrap align-middle">{item.category}</td>
                      <td className="px-1.5 py-2 whitespace-nowrap align-middle">{item.grading}</td>
                      {!privacyMode && <td className="px-1.5 py-2 text-right align-middle text-foreground">£{Number(item.purchase_price).toLocaleString("en-GB")}</td>}
                      <td className="px-1.5 py-2 whitespace-nowrap align-middle text-foreground">{item.purchase_date}</td>
                      <td className="px-1.5 py-2 align-middle text-foreground">{item.purchase_source}</td>
                      {!privacyMode && (
                        <td className="px-1.5 py-2 text-right align-middle">
                          <EstimatedValueCell item={item} onUpdated={load} />
                        </td>
                      )}
                      {!privacyMode && (
                        <td className={`px-1.5 py-2 text-right font-bold align-middle ${getPnlColor(pnl, item)}`}>
                          {pnl != null ? `${pnl >= 0 ? "+" : ""}£${pnl.toLocaleString("en-GB")}` : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      <td className="px-1.5 py-2 align-middle max-w-[120px] truncate text-muted-foreground" title={item.notes || ""}>
                        {item.notes || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-1.5 py-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditItem(item)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteItem(item)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {item.category === "12 BACK" && (
                            <button onClick={(e) => handleFindComps(item, e)} className="text-muted-foreground hover:text-primary transition-colors" title="Find Comps">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-muted-foreground text-sm tracking-wider">
                NO ITEMS MATCH CURRENT FILTERS
              </div>
            )}
          </div>

          {/* Stats Panel */}
          <div className="border-t border-border px-6 py-4">
            <h2 className="text-[10px] text-muted-foreground tracking-wider mb-3">Collection Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-wider mb-1">By Category</h3>
                {categoryBreakdown.map(([cat, count]) => (
                  <div key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span className="text-primary">{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-wider mb-1">By Grading</h3>
                {gradingBreakdown.map(([grade, count]) => (
                  <div key={grade} className="flex justify-between">
                    <span>{grade}</span>
                    <span className="text-primary">{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-wider mb-1">Most Expensive</h3>
                {mostExpensive && (
                  <div>
                    <div className="text-primary font-bold">{mostExpensive.description}</div>
                    <div className="text-muted-foreground">£{Number(mostExpensive.purchase_price).toLocaleString("en-GB")}</div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-wider mb-1">Most Recent</h3>
                {mostRecent && (
                  <div>
                    <div className="text-primary font-bold">{mostRecent.description}</div>
                    <div className="text-muted-foreground">{mostRecent.purchase_date}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-wider">
        IMPERIAL PRICE TERMINAL v4.0 · Galactic Empire · Classified
      </footer>

      {/* Modals */}
      <CollectionFormModal
        open={addOpen || !!editItem}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditItem(null); } }}
        onSaved={load}
        editItem={editItem}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => { if (!o) setDeleteItem(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary tracking-wider text-sm">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs tracking-wider">
              Delete <span className="text-primary font-bold">{deleteItem?.item_id}</span> — {deleteItem?.description}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs tracking-wider">CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground text-xs tracking-wider hover:bg-destructive/90">
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Collection;

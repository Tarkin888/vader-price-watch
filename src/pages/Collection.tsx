import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAllCollectionItems, deleteCollectionItem, CATEGORIES, GRADINGS, type CollectionItem } from "@/lib/collection-db";
import CollectionFormModal from "@/components/CollectionFormModal";
import CollectionAnalytics from "@/components/CollectionAnalytics";
import { Pencil, Trash2, Plus, Search, ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
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
  const [subTab, setSubTab] = useState<"inventory" | "analytics">("inventory");

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
          <Button
            size="sm"
            className="text-xs tracking-wider"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> ADD ITEM
          </Button>
        </div>
      </header>

      {/* Nav */}
      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <button
          onClick={() => navigate("/")}
          className="text-[10px] tracking-widest px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          PRICE TRACKER
        </button>
        <button
          onClick={() => navigate("/knowledge")}
          className="text-[10px] tracking-widest px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          KNOWLEDGE HUB
        </button>
        <button
          className="text-[10px] tracking-widest px-3 py-1 text-primary border-b border-primary"
        >
          MY COLLECTION
        </button>
        <span className="text-muted-foreground/30 mx-2">|</span>
        <button
          onClick={() => setSubTab("inventory")}
          className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${subTab === "inventory" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          INVENTORY
        </button>
        <button
          onClick={() => setSubTab("analytics")}
          className={`text-[10px] tracking-widest px-3 py-1 transition-colors ${subTab === "analytics" ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          ANALYTICS
        </button>
      </div>

      {subTab === "analytics" ? (
        <CollectionAnalytics items={items} />
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
          </div>

          {/* Table */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground tracking-widest text-left">
                  <th className="px-3 py-2">ITEM ID</th>
                  <th className="px-3 py-2">DESCRIPTION</th>
                  <th className="px-3 py-2">CATEGORY</th>
                  <th className="px-3 py-2">GRADING</th>
                  <th className="px-3 py-2 text-right">PRICE (£)</th>
                  <th className="px-3 py-2">DATE</th>
                  <th className="px-3 py-2">SOURCE</th>
                  <th className="px-3 py-2 text-right">EST. VALUE (£)</th>
                  <th className="px-3 py-2 text-right">P&L (£)</th>
                  <th className="px-3 py-2">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const pnl = getPnl(item);
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{item.item_id}</td>
                      <td className="px-3 py-2 text-primary font-bold max-w-[250px] truncate" title={item.description}>{item.description}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.category}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.grading}</td>
                      <td className="px-3 py-2 text-right">£{Number(item.purchase_price).toLocaleString("en-GB")}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.purchase_date}</td>
                      <td className="px-3 py-2">{item.purchase_source}</td>
                      <td className="px-3 py-2 text-right">
                        {item.current_estimated_value != null
                          ? `£${Number(item.current_estimated_value).toLocaleString("en-GB")}`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${getPnlColor(pnl, item)}`}>
                        {pnl != null ? `${pnl >= 0 ? "+" : ""}£${pnl.toLocaleString("en-GB")}` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2">
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
            <h2 className="text-[10px] text-muted-foreground tracking-widest uppercase mb-3">COLLECTION STATS</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-widest mb-1">BY CATEGORY</h3>
                {categoryBreakdown.map(([cat, count]) => (
                  <div key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span className="text-primary">{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-widest mb-1">BY GRADING</h3>
                {gradingBreakdown.map(([grade, count]) => (
                  <div key={grade} className="flex justify-between">
                    <span>{grade}</span>
                    <span className="text-primary">{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-widest mb-1">MOST EXPENSIVE</h3>
                {mostExpensive && (
                  <div>
                    <div className="text-primary font-bold">{mostExpensive.description}</div>
                    <div className="text-muted-foreground">£{Number(mostExpensive.purchase_price).toLocaleString("en-GB")}</div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[10px] text-muted-foreground tracking-widest mb-1">MOST RECENT</h3>
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

      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-widest">
        IMPERIAL PRICE TERMINAL v3.0 • GALACTIC EMPIRE • CLASSIFIED
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
            <AlertDialogTitle className="text-primary tracking-wider text-sm">CONFIRM DELETION</AlertDialogTitle>
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

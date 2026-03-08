import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Calculator, Check, X } from "lucide-react";
import type { CollectionItem } from "@/lib/collection-db";

interface Props {
  item: CollectionItem;
  onUpdated: () => void;
}

/**
 * Map collection category → array of variant_code values to query from the lots table.
 * This is a best-effort mapping; users can always manually override.
 */
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

const EstimatedValueCell = ({ item, onUpdated }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [calculating, setCalculating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const saveValue = async (value: number | null) => {
    try {
      const { error } = await supabase
        .from("collection")
        .update({ current_estimated_value: value } as any)
        .eq("id", item.id);
      if (error) throw error;
      onUpdated();
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    }
  };

  const handleManualSave = async () => {
    const val = parseFloat(manualValue);
    if (isNaN(val)) {
      toast.error("Enter a valid number");
      return;
    }
    await saveValue(val);
    setEditing(false);
    setMenuOpen(false);
    toast.success(`Value set to £${val.toLocaleString("en-GB")}`);
  };

  const handleAutoCalc = async () => {
    setCalculating(true);
    try {
      const variants = CATEGORY_TO_VARIANTS[item.category] || [];
      if (variants.length === 0) {
        toast.error("No price tracker mapping for category: " + item.category);
        setCalculating(false);
        return;
      }

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoff = oneYearAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("lots")
        .select("total_paid_gbp")
        .in("variant_code", variants)
        .gte("sale_date", cutoff);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("No sales found in the last 12 months for this category");
        setCalculating(false);
        return;
      }

      const avg = Math.round(data.reduce((s, r) => s + Number(r.total_paid_gbp), 0) / data.length);
      await saveValue(avg);
      setMenuOpen(false);
      toast.success(`1-year avg from ${data.length} sales: £${avg.toLocaleString("en-GB")}`);
    } catch (e: any) {
      toast.error("Calculation failed: " + e.message);
    } finally {
      setCalculating(false);
    }
  };

  const displayValue = item.current_estimated_value != null
    ? `£${Number(item.current_estimated_value).toLocaleString("en-GB")}`
    : null;

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center justify-end gap-1.5">
        <span className={displayValue ? "" : "text-muted-foreground"}>
          {displayValue ?? "—"}
        </span>
        <button
          onClick={() => { setMenuOpen(!menuOpen); setEditing(false); }}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="Set estimated value"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded shadow-lg min-w-[220px]">
          {!editing ? (
            <div className="flex flex-col">
              <button
                onClick={() => { setEditing(true); setManualValue(item.current_estimated_value != null ? String(item.current_estimated_value) : ""); }}
                className="flex items-center gap-2 px-3 py-2 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors text-left"
              >
                <Pencil className="w-3 h-3 text-primary" />
                MANUAL INPUT
              </button>
              <button
                onClick={handleAutoCalc}
                disabled={calculating}
                className="flex items-center gap-2 px-3 py-2 text-xs tracking-wider text-foreground hover:bg-secondary transition-colors text-left disabled:opacity-50"
              >
                <Calculator className="w-3 h-3 text-primary" />
                {calculating ? "CALCULATING..." : "1-YEAR AVG (PRICE TRACKER)"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 p-2">
              <span className="text-xs text-muted-foreground">£</span>
              <input
                ref={inputRef}
                type="number"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualSave(); if (e.key === "Escape") { setEditing(false); setMenuOpen(false); } }}
                className="flex-1 bg-secondary border border-border text-xs px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-28"
              />
              <button onClick={handleManualSave} className="text-primary hover:text-foreground transition-colors" title="Save">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditing(false); setMenuOpen(false); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstimatedValueCell;

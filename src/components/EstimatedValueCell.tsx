import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Calculator, Check, X } from "lucide-react";
import type { CollectionItem } from "@/lib/collection-db";

interface Props {
  item: CollectionItem;
  onUpdated: () => void;
}

const GRADE_PREMIUM: Record<string, number> = {
  "RAW-NM": 1.0, "RAW-EX": 0.6, "RAW-VG": 0.35,
  "AFA-40": 0.5, "AFA-50": 0.7, "AFA-60": 0.85, "AFA-70": 1.0, "AFA-75": 1.3, "AFA-80": 1.65, "AFA-85": 2.15, "AFA-90+": 3.25,
  "UKG-70": 0.85, "UKG-75": 1.15, "UKG-80": 1.65, "UKG-85": 2.15, "UKG-90": 2.75,
  "CAS-70": 1.0, "CAS-75": 1.15, "CAS-80": 1.65, "CAS-85": 2.15,
  "GRADED-UNKNOWN": 1.0, "UNKNOWN": 1.0,
};

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function calculateEstimatedValue(
  category: string,
  grading: string
): Promise<{ value: number | null; tier: "Exact" | "Est." | null }> {
  if (category === "UNKNOWN") return { value: null, tier: null };

  // Tier 1: Exact match (cardback + grade)
  const { data: exactData, error: e1 } = await supabase
    .from("lots")
    .select("total_paid_gbp")
    .eq("variant_code", category as any)
    .eq("grade_tier_code", grading as any);
  if (e1) throw e1;

  const exactPrices = (exactData ?? [])
    .map((r: any) => Number(r.total_paid_gbp))
    .filter((v: number) => v > 0);

  if (exactPrices.length >= 2) {
    return { value: Math.round(median(exactPrices)), tier: "Exact" };
  }

  // Tier 2: Grade-adjusted estimate (all grades for that cardback)
  const { data: allData, error: e2 } = await supabase
    .from("lots")
    .select("total_paid_gbp")
    .eq("variant_code", category as any);
  if (e2) throw e2;

  const allPrices = (allData ?? [])
    .map((r: any) => Number(r.total_paid_gbp))
    .filter((v: number) => v > 0);

  if (allPrices.length === 0) {
    return { value: null, tier: null }; // Tier 3: no data
  }

  const baseMedian = median(allPrices);
  const factor = GRADE_PREMIUM[grading] ?? 1.0;
  return { value: Math.round(baseMedian * factor), tier: "Est." };
}

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

  const saveValue = async (value: number | null, tier: string | null) => {
    try {
      const { error } = await supabase
        .from("collection")
        .update({ current_estimated_value: value, estimation_tier: tier } as any)
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
    await saveValue(val, null);
    setEditing(false);
    setMenuOpen(false);
    toast.success(`Value set to £${val.toLocaleString("en-GB")}`);
  };

  const handleAutoCalc = async () => {
    setCalculating(true);
    try {
      const result = await calculateEstimatedValue(item.category, item.grading);
      if (result.value == null) {
        toast.error("No sales data found for this cardback");
        setCalculating(false);
        return;
      }
      await saveValue(result.value, result.tier);
      setMenuOpen(false);
      const label = result.tier === "Exact"
        ? `Exact median from matched sales: £${result.value.toLocaleString("en-GB")}`
        : `Grade-adjusted estimate: £${result.value.toLocaleString("en-GB")}`;
      toast.success(label);
    } catch (e: any) {
      toast.error("Calculation failed: " + e.message);
    } finally {
      setCalculating(false);
    }
  };

  const displayValue = item.current_estimated_value != null
    ? `£${Number(item.current_estimated_value).toLocaleString("en-GB")}`
    : null;

  const tierLabel = (item as any).estimation_tier as string | null;

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center justify-end gap-1.5">
        <span className={displayValue ? "" : "text-muted-foreground"}>
          {displayValue ?? "—"}
          {displayValue && tierLabel && (
            <span className="ml-1 text-muted-foreground" style={{ fontSize: "10px", opacity: 0.6 }}>
              {tierLabel}
            </span>
          )}
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
                {calculating ? "CALCULATING..." : "AUTO-CALCULATE"}
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

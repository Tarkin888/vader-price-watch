import { useState, useRef } from "react";
import { Wrench, RefreshCw, Plus, Upload, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LotFormModal from "@/components/LotFormModal";
import type { Lot } from "@/lib/db";
import type { LotInsert } from "@/lib/db";
import { classifyLot, deriveFromVariantCode } from "@/lib/classify-lot";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onReclassify: () => void;
  reclassifying: boolean;
  onAdded: () => void;
  onImported: () => void;
  filteredLots: Lot[];
}

const ToolsDropdown = ({ onReclassify, reclassifying, onAdded, onImported, filteredLots }: Props) => {
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const headers = [
      "captureDate", "saleDate", "source", "era", "cardbackCode", "lotRef",
      "variantCode", "gradeTierCode", "variantGradeKey", "hammerPriceGBP",
      "buyersPremiumGBP", "totalPaidGBP", "usdToGbpRate", "conditionNotes",
    ];
    const rows = filteredLots.map((l) => [
      l.capture_date, l.sale_date, l.source, (l as any).era ?? "", (l as any).cardback_code ?? "",
      l.lot_ref, l.variant_code, l.grade_tier_code, l.variant_grade_key,
      l.hammer_price_gbp, l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate,
      `"${(l.condition_notes ?? "").replace(/"/g, '""')}"`,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vader-prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split("\n");
    let start = 0;
    if (lines[0]?.toLowerCase().includes("capturedate") || lines[0]?.toLowerCase().includes("capture_date")) {
      start = 1;
    }
    const rows: LotInsert[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 8) continue;
      const raw: Partial<LotInsert> = {
        capture_date: cols[0],
        sale_date: cols[1],
        source: cols[2] as any,
        lot_ref: cols[5],
        variant_code: cols[6] as any,
        grade_tier_code: cols[7] as any,
        hammer_price_gbp: cols[9] ? Number(cols[9]) : null,
        buyers_premium_gbp: cols[10] ? Number(cols[10]) : null,
        total_paid_gbp: cols[11] ? Number(cols[11]) : null,
        usd_to_gbp_rate: cols[12] ? Number(cols[12]) : 1,
        condition_notes: cols[13] ?? "",
      };
      const classified = classifyLot(raw);
      rows.push(classified as LotInsert);
    }
    if (rows.length === 0) { toast.error("No valid rows found"); return; }
    const { error } = await supabase.from("lots").insert(rows);
    if (error) { toast.error("Import failed: " + error.message); return; }
    toast.success(`Imported ${rows.length} lot(s)`);
    onImported();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 text-[10px] tracking-widest px-3 py-1 text-muted-foreground hover:text-primary transition-colors border border-border rounded">
            <Wrench className="w-3.5 h-3.5" />
            TOOLS
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border min-w-[180px]">
          <DropdownMenuItem
            onClick={onReclassify}
            disabled={reclassifying}
            className="text-xs tracking-wider gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reclassifying ? "animate-spin" : ""}`} />
            {reclassifying ? "RE-CLASSIFYING..." : "RE-CLASSIFY UNKNOWNS"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setAddOpen(true)}
            className="text-xs tracking-wider gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            ADD LOT
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleImportClick}
            className="text-xs tracking-wider gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            IMPORT CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExport}
            className="text-xs tracking-wider gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT CSV ({filteredLots.length})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <LotFormModal open={addOpen} onOpenChange={setAddOpen} onSaved={onAdded} />
    </>
  );
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

export default ToolsDropdown;
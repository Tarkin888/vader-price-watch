import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LotInsert } from "@/lib/db";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onImported: () => void;
}

const CSV_HEADERS = [
  "captureDate", "saleDate", "source", "lotRef", "variantCode",
  "gradeTierCode", "variantGradeKey", "hammerPriceGBP",
  "buyersPremiumGBP", "totalPaidGBP", "usdToGbpRate", "conditionNotes",
];

const ImportCSV = ({ onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split("\n");

    // Skip header if present
    let start = 0;
    if (lines[0]?.toLowerCase().includes("capturedate") || lines[0]?.toLowerCase().includes("capture_date")) {
      start = 1;
    }

    const rows: LotInsert[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 12) continue;

      rows.push({
        capture_date: cols[0],
        sale_date: cols[1],
        source: cols[2] as any,
        lot_ref: cols[3],
        variant_code: cols[4] as any,
        grade_tier_code: cols[5] as any,
        // variantGradeKey (cols[6]) is auto-computed by trigger
        hammer_price_gbp: parseFloat(cols[7]) || 0,
        buyers_premium_gbp: parseFloat(cols[8]) || 0,
        total_paid_gbp: parseFloat(cols[9]) || 0,
        usd_to_gbp_rate: parseFloat(cols[10]) || 1,
        condition_notes: cols[11] || "",
      });
    }

    if (rows.length === 0) {
      toast.error("No valid rows found in CSV");
      return;
    }

    // Fetch existing lot_ref+source combos to skip duplicates
    const { data: existing } = await supabase
      .from("lots")
      .select("lot_ref, source");

    const existingKeys = new Set(
      (existing ?? []).map((e) => `${e.lot_ref}|||${e.source}`)
    );

    const toInsert = rows.filter((r) => !existingKeys.has(`${r.lot_ref}|||${r.source}`));

    if (toInsert.length === 0) {
      toast.info("All rows already exist (matched by lot ref + source)");
      return;
    }

    const { error } = await supabase.from("lots").insert(toInsert);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      toast.success(`Imported ${toInsert.length} rows (${rows.length - toInsert.length} duplicates skipped)`);
      onImported();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onChange} />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary tracking-wider transition-colors px-3 py-2"
      >
        <Upload className="w-3.5 h-3.5" />
        IMPORT CSV
      </button>
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

export default ImportCSV;

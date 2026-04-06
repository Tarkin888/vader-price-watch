import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import type { LotInsert } from "@/lib/db";
import { classifyLot, deriveFromVariantCode } from "@/lib/classify-lot";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onImported: () => void;
}

const ImportCSV = ({ onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (cols.length < 12) continue;

      // Build a title string from available fields for classification
      const titleText = [cols[3], cols[4], cols[5], cols[11]].join(" ");
      const classified = classifyLot(titleText);

      // If classifyLot couldn't determine era/cardback, derive from variant_code
      let era = classified.era;
      let cardback_code = classified.cardback_code;
      const variantCode = classified.variant_code;
      if (era === "UNKNOWN" || cardback_code === "UNKNOWN") {
        const derived = deriveFromVariantCode(variantCode);
        if (era === "UNKNOWN" && derived.era !== "UNKNOWN") era = derived.era;
        if (cardback_code === "UNKNOWN" && derived.cardback_code !== "UNKNOWN") cardback_code = derived.cardback_code;
      }

      rows.push({
        capture_date: cols[0],
        sale_date: cols[1],
        source: cols[2] as any,
        lot_ref: cols[3],
        era: era as any,
        cardback_code: cardback_code,
        variant_code: variantCode as any,
        grade_tier_code: classified.grade_tier_code as any,
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

    const res = await adminWrite({ table: "lots", operation: "insert", data: toInsert });
    if (!res.success) {
      toast.error("Import failed: " + res.error);
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

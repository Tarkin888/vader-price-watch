import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, GRADINGS, PURCHASE_SOURCES, ERAS } from "@/lib/collection-db";

export const CSV_HEADERS = [
  "character", "figureId", "era", "cardbackCode", "variantCode",
  "gradeTierCode", "variantGradeKey", "totalPaidGBP", "hammerPriceGBP",
  "buyersPremiumGBP", "usdToGbpRate", "saleDate", "source", "lotRef",
  "lotUrl", "conditionNotes", "imageUrls", "currentEstimatedValueGBP",
  "description",
] as const;

const SAMPLE_ROW = {
  character: "VADER", figureId: "VADER", era: "SW",
  cardbackCode: "SW-12A", variantCode: "SW-12A",
  gradeTierCode: "AFA-85", variantGradeKey: "SW-12A-AFA-85",
  totalPaidGBP: "2928", hammerPriceGBP: "2400", buyersPremiumGBP: "528",
  usdToGbpRate: "", saleDate: "2025-09-14", source: "Heritage",
  lotRef: "12345-6789", lotUrl: "https://ha.com/lot/...",
  conditionNotes: "Crisp corners, unpunched, strong bubble",
  imageUrls: "https://img1.jpg;https://img2.jpg",
  currentEstimatedValueGBP: "3200",
  description: "Personal favourite",
};

const COMMENT_ROW = `# Valid era: SW|ESB|ROTJ|POTF. gradeTierCode: ${GRADINGS.join(",")}. source: ${PURCHASE_SOURCES.join("|")}. saleDate: ISO YYYY-MM-DD. imageUrls: semicolon-separated. character/figureId optional, default VADER.`;

export function downloadTemplate() {
  const csv = Papa.unparse({
    fields: [...CSV_HEADERS],
    data: [
      CSV_HEADERS.map((h) => (SAMPLE_ROW as any)[h] ?? ""),
      [COMMENT_ROW, ...Array(CSV_HEADERS.length - 1).fill("")],
    ],
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedRow {
  rowNumber: number; // 1-based, including header
  raw: Record<string, string>;
  mapped?: any;
  errors: CsvRowError[];
}

export interface ParseResult {
  rows: ParsedRow[];
  validRows: ParsedRow[];
  errorRows: ParsedRow[];
}

const VALID_ERAS = new Set(ERAS.filter((e) => e !== "UNKNOWN"));
const VALID_GRADES = new Set(GRADINGS as readonly string[]);
const VALID_SOURCES = new Set(PURCHASE_SOURCES as readonly string[]);

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (isNaN(d.getTime())) return false;
  return d <= new Date();
}

function num(v: string): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function validateRow(row: Record<string, string>, rowNumber: number): ParsedRow {
  const errors: CsvRowError[] = [];
  const get = (k: string) => (row[k] ?? "").trim();

  const era = get("era");
  const cardbackCode = get("cardbackCode");
  const variantCodeRaw = get("variantCode");
  const variantCode = variantCodeRaw || cardbackCode;
  const gradeTierCode = get("gradeTierCode");
  const saleDate = get("saleDate");
  const totalPaidGBPRaw = get("totalPaidGBP");
  const source = get("source") || "Other";

  if (!era) errors.push({ row: rowNumber, field: "era", message: "Required" });
  else if (!VALID_ERAS.has(era as any)) errors.push({ row: rowNumber, field: "era", message: `Must be one of ${[...VALID_ERAS].join("|")}` });

  if (!cardbackCode) errors.push({ row: rowNumber, field: "cardbackCode", message: "Required" });

  if (!gradeTierCode) errors.push({ row: rowNumber, field: "gradeTierCode", message: "Required" });
  else if (!VALID_GRADES.has(gradeTierCode)) errors.push({ row: rowNumber, field: "gradeTierCode", message: "Not a valid grade tier" });

  if (!saleDate) errors.push({ row: rowNumber, field: "saleDate", message: "Required" });
  else if (!isValidIsoDate(saleDate)) errors.push({ row: rowNumber, field: "saleDate", message: "Must be ISO YYYY-MM-DD and not in the future" });

  const totalPaidGBP = num(totalPaidGBPRaw);
  if (totalPaidGBPRaw === "") errors.push({ row: rowNumber, field: "totalPaidGBP", message: "Required" });
  else if (totalPaidGBP == null) errors.push({ row: rowNumber, field: "totalPaidGBP", message: "Must be a number" });

  if (source && !VALID_SOURCES.has(source)) errors.push({ row: rowNumber, field: "source", message: `Must be one of ${[...VALID_SOURCES].join("|")}` });

  // numeric optional fields
  for (const f of ["hammerPriceGBP", "buyersPremiumGBP", "usdToGbpRate", "currentEstimatedValueGBP"]) {
    const v = get(f);
    if (v !== "" && num(v) == null) errors.push({ row: rowNumber, field: f, message: "Must be a number" });
  }

  // variantGradeKey auto-compute / cross-check
  const providedKey = get("variantGradeKey");
  const computedKey = `${variantCode}-${gradeTierCode}`;
  if (providedKey && providedKey !== computedKey) {
    errors.push({ row: rowNumber, field: "variantGradeKey", message: `Should equal ${computedKey}` });
  }

  const character = get("character") || "VADER";
  const figureId = get("figureId") || "VADER";
  const conditionNotes = get("conditionNotes");
  const description = get("description");
  const lotRef = get("lotRef") || null;
  const lotUrl = get("lotUrl") || null;
  const imageUrlsArr = get("imageUrls").split(";").map((s) => s.trim()).filter(Boolean);
  const currentEstimated = num(get("currentEstimatedValueGBP"));

  const mapped = errors.length === 0 ? {
    era,
    cardback_code: cardbackCode,
    variant_code: variantCode,
    grade_tier_code: gradeTierCode,
    // variant_grade_key is computed by trigger; safe to omit
    lot_ref: lotRef,
    lot_url: lotUrl,
    character,
    figure_id: figureId,
    purchase_price: totalPaidGBP ?? 0,
    purchase_date: saleDate,
    purchase_source: source,
    notes: conditionNotes,
    description,
    current_estimated_value: currentEstimated,
    category: cardbackCode, // mirror to legacy
    grading: gradeTierCode,  // mirror to legacy
    image_urls: imageUrlsArr,
    front_image_url: imageUrlsArr[0] ?? "",
    back_image_url: imageUrlsArr[1] ?? "",
  } : undefined;

  return { rowNumber, raw: row, mapped, errors };
}

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const rows: ParsedRow[] = [];
        res.data.forEach((row, idx) => {
          // skip blank rows
          const allBlank = Object.values(row).every((v) => !v || String(v).trim() === "");
          if (allBlank) return;
          // skip comment rows: first column starts with #
          const firstVal = String(row[CSV_HEADERS[0]] ?? "").trim();
          if (firstVal.startsWith("#")) return;
          rows.push(validateRow(row, idx + 2)); // +2 = 1 for header, 1 for 1-based
        });
        const validRows = rows.filter((r) => r.errors.length === 0);
        const errorRows = rows.filter((r) => r.errors.length > 0);
        resolve({ rows, validRows, errorRows });
      },
      error: (err) => reject(err),
    });
  });
}

export interface DuplicateInfo {
  rowNumber: number;
  lotRef: string;
  source: string;
}

export async function findDuplicates(rows: ParsedRow[], userId: string): Promise<Set<number>> {
  const lotRefs = rows
    .map((r) => r.mapped?.lot_ref)
    .filter((v): v is string => !!v);
  if (lotRefs.length === 0) return new Set();
  const { data, error } = await supabase
    .from("collection")
    .select("lot_ref, purchase_source")
    .eq("user_id", userId)
    .in("lot_ref", lotRefs);
  if (error || !data) return new Set();
  const existingKeys = new Set(data.map((d: any) => `${d.lot_ref}|||${d.purchase_source}`));
  const dupRowNumbers = new Set<number>();
  rows.forEach((r) => {
    const key = `${r.mapped?.lot_ref}|||${r.mapped?.purchase_source}`;
    if (r.mapped?.lot_ref && existingKeys.has(key)) dupRowNumbers.add(r.rowNumber);
  });
  return dupRowNumbers;
}

export function downloadErrorReport(errorRows: ParsedRow[]) {
  const records = errorRows.flatMap((r) =>
    r.errors.map((err) => ({
      row_number: r.rowNumber,
      field: err.field,
      error_reason: err.message,
      ...r.raw,
    }))
  );
  if (records.length === 0) return;
  const csv = Papa.unparse(records);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-import-errors.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function getNextItemIdBatch(start: number, count: number): Promise<string[]> {
  // Fetch latest item_id once and generate sequentially
  const { data } = await supabase
    .from("collection")
    .select("item_id")
    .order("item_id", { ascending: false })
    .limit(1);
  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].item_id;
    const num = parseInt(last.replace("VADER", ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return Array.from({ length: count }, (_, i) => `VADER${String(next + i).padStart(3, "0")}`);
}

export async function importRows(rowsToInsert: ParsedRow[], userId: string): Promise<{ inserted: number; failed: number; firstError?: string }> {
  if (rowsToInsert.length === 0) return { inserted: 0, failed: 0 };
  const itemIds = await getNextItemIdBatch(0, rowsToInsert.length);
  const payload = rowsToInsert.map((r, i) => ({
    ...r.mapped,
    item_id: itemIds[i],
    user_id: userId,
  }));
  const { error, data } = await supabase.from("collection").insert(payload).select("id");
  if (error) {
    return { inserted: 0, failed: rowsToInsert.length, firstError: error.message };
  }
  return { inserted: data?.length ?? rowsToInsert.length, failed: 0 };
}

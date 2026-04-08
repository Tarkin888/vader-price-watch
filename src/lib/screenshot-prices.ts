/**
 * Price calculation logic for screenshot-extracted auction data.
 * Converts currencies, applies buyer's premiums, and derives GBP totals.
 */

export interface ExtractedData {
  source: string | null;
  lotRef: string | null;
  lotUrl: string | null;
  saleDate: string | null;
  era: string | null;
  cardbackCode: string | null;
  variantCode: string | null;
  gradeTierCode: string | null;
  hammerPriceRaw: number | null;
  hammerCurrency: string | null;
  buyersPremiumRate: number | null;
  totalPaidRaw: number | null;
  totalPaidCurrency: string | null;
  conditionNotes: string | null;
  imageUrls: string[] | null;
  title: string | null;
}

export interface CalculatedPrices {
  hammerPriceGBP: number;
  buyersPremiumGBP: number;
  totalPaidGBP: number;
  usdToGbpRate: number;
  priceStatus: string;
}

const DEFAULT_BP_RATES: Record<string, number> = {
  Heritage: 0.20,
  Hakes: 0.20,
  LCG: 0.22,
  Vectis: 0.225,
  CandT: 0.264,
  eBay: 0.00,
  Facebook: 0.00,
  Other: 0.00,
};

const DEFAULT_USD_TO_GBP = 0.79;

export function calculatePrices(
  extracted: ExtractedData,
  configRate?: number
): CalculatedPrices {
  const usdToGbpRate = configRate ?? DEFAULT_USD_TO_GBP;
  const source = extracted.source ?? "Other";
  const bpRate = extracted.buyersPremiumRate ?? DEFAULT_BP_RATES[source] ?? 0;

  const isEbay = source === "eBay";
  const isFacebook = source === "Facebook";

  const hammerRaw = extracted.hammerPriceRaw ?? null;
  const totalRaw = extracted.totalPaidRaw ?? null;
  const hammerCur = extracted.hammerCurrency ?? "GBP";
  const totalCur = extracted.totalPaidCurrency ?? hammerCur;

  const toGBP = (val: number, cur: string) =>
    cur === "USD" ? Math.round(val * usdToGbpRate * 100) / 100 : val;

  let hammerGBP = 0;
  let totalGBP = 0;
  let bpGBP = 0;

  if (isEbay || isFacebook) {
    // Single price, no BP
    const price = totalRaw ?? hammerRaw ?? 0;
    const cur = totalRaw ? totalCur : hammerCur;
    totalGBP = toGBP(price, cur);
    hammerGBP = totalGBP;
    bpGBP = 0;
  } else if (hammerRaw != null && totalRaw != null) {
    hammerGBP = toGBP(hammerRaw, hammerCur);
    totalGBP = toGBP(totalRaw, totalCur);
    bpGBP = Math.round((totalGBP - hammerGBP) * 100) / 100;
  } else if (hammerRaw != null) {
    hammerGBP = toGBP(hammerRaw, hammerCur);
    totalGBP = Math.round(hammerGBP * (1 + bpRate) * 100) / 100;
    bpGBP = Math.round((totalGBP - hammerGBP) * 100) / 100;
  } else if (totalRaw != null) {
    totalGBP = toGBP(totalRaw, totalCur);
    hammerGBP = Math.round((totalGBP / (1 + bpRate)) * 100) / 100;
    bpGBP = Math.round((totalGBP - hammerGBP) * 100) / 100;
  }

  // Facebook price_status logic
  let priceStatus = "CONFIRMED";
  if (isFacebook && extracted.conditionNotes) {
    const notes = extracted.conditionNotes.toUpperCase();
    if (notes.includes("SPF") || notes.includes("SALE AGREED")) {
      priceStatus = "ESTIMATE_ONLY";
    }
  }

  return {
    hammerPriceGBP: hammerGBP,
    buyersPremiumGBP: bpGBP,
    totalPaidGBP: totalGBP,
    usdToGbpRate,
    priceStatus,
  };
}

/** Auto-generate a Facebook lot reference if none was extracted. */
export function generateFbLotRef(saleDate: string | null, title: string | null): string {
  const date = saleDate ?? new Date().toISOString().slice(0, 10);
  const slug = (title ?? "unknown").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `FB-${date}-${slug}`;
}

/** Detect source from a URL domain. */
export function detectSourceFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("ha.com") || lower.includes("historicalauctions.com")) return "Heritage";
  if (lower.includes("hakes.com")) return "Hakes";
  if (lower.includes("lcgauctions.com") || lower.includes("lovecollecting.com")) return "LCG";
  if (lower.includes("vectis.co.uk")) return "Vectis";
  if (lower.includes("candtauctions.co.uk")) return "CandT";
  if (lower.includes("ebay.com") || lower.includes("ebay.co.uk")) return "eBay";
  if (lower.includes("facebook.com")) return "Facebook";
  return "Other";
}

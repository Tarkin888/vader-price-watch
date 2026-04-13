export const SOURCES = ["Heritage", "Hakes", "Vectis", "LCG"] as const;
export type Source = typeof SOURCES[number];

export const VARIANT_CODES = [
  "12A", "12B", "12C", "12A-DT", "12B-DT", "CAN", "PAL",
] as const;
export type VariantCode = typeof VARIANT_CODES[number];

export const GRADE_TIER_CODES = [
  "RAW-NM", "RAW-EX", "RAW-VG",
  "AFA-40", "AFA-50", "AFA-60", "AFA-70", "AFA-75", "AFA-80", "AFA-85", "AFA-90+",
  "UKG-70", "UKG-75", "UKG-80", "UKG-85", "UKG-90",
  "CAS-70", "CAS-75", "CAS-80", "CAS-85",
  "GRADED-UNKNOWN",
] as const;
export type GradeTierCode = typeof GRADE_TIER_CODES[number];

export interface Lot {
  id: string;
  captureDate: string;
  saleDate: string;
  source: Source;
  lotRef: string;
  lotUrl: string;
  variantCode: VariantCode;
  gradeTierCode: GradeTierCode;
  variantGradeKey: string; // variantCode + "-" + gradeTierCode
  hammerPriceGBP: number;
  buyersPremiumGBP: number;
  totalPaidGBP: number;
  usdToGbpRate: number;
  imageUrls: string[];
  conditionNotes: string;
  gradeSubgrades: string;
}

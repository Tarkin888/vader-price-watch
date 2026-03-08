/**
 * POP (Population) Rarity Lookup Table
 * =====================================
 * 
 * This file tracks the known population counts for variant codes.
 * Edit this file manually to add or update entries.
 *
 * FORMAT:
 *   "VARIANT-CODE": { pop: <number|null>, source: "<string|null>", confidence: "<HIGH|APPROX|LOW>" }
 *
 * RULES:
 *   pop:        The known number of graded examples. Use `null` if unknown.
 *   source:     Where this data comes from (e.g. "SWCA", "Heritage AFA records"). Use `null` if no source.
 *   confidence: "HIGH"   = confirmed count from reliable source
 *               "APPROX" = population is unknown / approximate
 *               "LOW"    = rough estimate only, not confirmed
 *
 * Only variant codes listed here will show a POP badge in the results table.
 * To add a new entry, copy a line below and edit the values.
 */

export interface PopEntry {
  pop: number | null;
  source: string | null;
  confidence: "HIGH" | "APPROX" | "LOW";
}

const popCounts: Record<string, PopEntry> = {
  "SW-12A-DT":  { pop: 3,    source: "SWCA/collector consensus",  confidence: "HIGH" },
  "SW-12B-DT":  { pop: 1,    source: "SWCA",                      confidence: "HIGH" },
  "SW-12A":     { pop: null,  source: null,                        confidence: "APPROX" },
  "ROTJ-65D":   { pop: 2,    source: "Heritage AFA records",      confidence: "HIGH" },
  "ROTJ-65-VP": { pop: null,  source: "forum estimates",           confidence: "LOW" },
  "POTF-92":    { pop: null,  source: null,                        confidence: "APPROX" },
};

export default popCounts;

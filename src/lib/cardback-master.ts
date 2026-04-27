/**
 * Cardback Master Table — single source of truth for cardback codes,
 * shared by the Knowledge Hub Master Table view, the admin Research Library
 * multi-select, and the public Research Library cardback picker.
 *
 * Codes mirror the values used by the lots classification engine
 * (see src/lib/classify-lot.ts) — keep in sync.
 */

export interface MasterTableRow {
  code: string;
  era: "SW" | "ESB" | "ROTJ" | "POTF";
  cardback: string;
  year: string;
  features: string;
  rarity: string;
  notes: string;
}

export const MASTER_TABLE: MasterTableRow[] = [
  { code: "SW-12A", era: "SW", cardback: "12-Back A", year: "1977–78", features: "Action Display Stand offer; DT saber instructions; earliest release", rarity: "★★★★★", notes: "15–25% premium over SW-12C" },
  { code: "SW-12A-DT", era: "SW", cardback: "12-Back A Double-Telescoping", year: "1977–78", features: "Double-telescoping saber; extreme rarity", rarity: "★★★★★ (EXTREME)", notes: "See DT Variant Spotlight for details" },
  { code: "SW-12B", era: "SW", cardback: "12-Back B", year: "1978", features: "POP cut-out for second Display Stand; minor text variation", rarity: "★★★★☆", notes: "5–10% premium over SW-12C" },
  { code: "SW-12B-DT", era: "SW", cardback: "12-Back B Double-Telescoping", year: "1978", features: "DT saber on 12B card; single documented carded example", rarity: "★★★★★ (EXTREME)", notes: "See DT Variant Spotlight for details" },
  { code: "SW-12C", era: "SW", cardback: "12-Back C", year: "1978", features: "Shortened saber instruction text vs 12B; most common 12-back", rarity: "★★★☆☆", notes: "Baseline value for 12-back Vader" },
  { code: "SW-20", era: "SW", cardback: "20-Back", year: "1978–79", features: "Boba Fett mail-away offer on some variants; 20-figure grid", rarity: "★★★☆☆", notes: "Two sub-variants A and B; Boba Fett offer adds premium" },
  { code: "SW-21", era: "SW", cardback: "21-Back", year: "1979", features: "Adds Luke X-Wing Pilot to grid; multiple sub-variants A–G", rarity: "★★★☆☆", notes: "Sub-variants differ by offer and factory COO stamps" },
  { code: "ESB-31", era: "ESB", cardback: "31-Back", year: "1980", features: "First ESB cardback; 31-figure grid; Yoda and Lando added", rarity: "★★★★☆", notes: "Canada ESB 31-backs have bilingual text" },
  { code: "ESB-32", era: "ESB", cardback: "32-Back", year: "1980", features: "Adds 2-1B to the grid; short-run transition card", rarity: "★★★★☆", notes: "Scarcer than ESB-41" },
  { code: "ESB-41", era: "ESB", cardback: "41-Back", year: "1980–81", features: "Full wave 1–2 ESB figures on back; most common ESB card", rarity: "★★★☆☆", notes: "Multiple offer variants; collector-case rebate documented" },
  { code: "ESB-45", era: "ESB", cardback: "45-Back", year: "1981", features: "Imperial Commander added; transitional wave", rarity: "★★★★☆", notes: "Scarcer than ESB-41" },
  { code: "ESB-47", era: "ESB", cardback: "47-Back", year: "1982", features: "4-LOM and others added; near-complete ESB roster", rarity: "★★★☆☆", notes: "AFA examples well documented at Heritage and Hake's" },
  { code: "ESB-48", era: "ESB", cardback: "48-Back", year: "1982", features: "Final ESB back; bridges ESB and ROTJ transition", rarity: "★★★☆☆", notes: "Check title carefully; overlap with ROTJ-48 packaging" },
  { code: "ROTJ-48", era: "ROTJ", cardback: "48-Back ROTJ", year: "1983", features: "ROTJ branding; 48-figure grid; transitional from ESB-48", rarity: "★★★☆☆", notes: "Vader uses standard lightsaber pose" },
  { code: "ROTJ-65A", era: "ROTJ", cardback: "65-Back A", year: "1983", features: "Standard ROTJ front photo (lightsaber raised)", rarity: "★★★☆☆", notes: "Most common ROTJ Vader card; multiple sub-variants A–D" },
  { code: "ROTJ-65B", era: "ROTJ", cardback: "65-Back B", year: "1983", features: "Minor offer and back text differences vs 65A", rarity: "★★★☆☆", notes: "Check back text and offer details to distinguish" },
  { code: "ROTJ-65C", era: "ROTJ", cardback: "65-Back C", year: "1983–84", features: "Further back text variation", rarity: "★★★★☆", notes: "Less common than 65A" },
  { code: "ROTJ-65D", era: "ROTJ", cardback: "65-Back D — Made in Mexico", year: "1984", features: "Lili Ledy; Made in Mexico", rarity: "★★★★★", notes: "See Mexico / Lili Ledy Spotlight for details" },
  { code: "ROTJ-65-VP", era: "ROTJ", cardback: "65-Back Vader Pointing", year: "1983–84", features: "Alternate front photo: Vader pointing", rarity: "★★★★☆", notes: "See Vader Pointing Spotlight for details" },
  { code: "ROTJ-77", era: "ROTJ", cardback: "77-Back", year: "1984", features: "Expanded figure grid; Canadian 77-backs documented", rarity: "★★★☆☆", notes: "Multiple sub-variants documented" },
  { code: "ROTJ-79A", era: "ROTJ", cardback: "79-Back A", year: "1984", features: "Near-complete ROTJ roster; standard Vader pose", rarity: "★★★☆☆", notes: "AFA 80 examples documented at Brian's Toys and Heritage" },
  { code: "ROTJ-79B", era: "ROTJ", cardback: "79-Back B", year: "1984", features: "Minor variation from 79A; check back text", rarity: "★★★★☆", notes: "Less common than 79A" },
  { code: "POTF-92", era: "POTF", cardback: "92-Back", year: "1985", features: "Coin included; final vintage line", rarity: "★★★★☆", notes: "See POTF Coin Spotlight for details" },
  { code: "ROTJ-70", era: "ROTJ", cardback: "70-Back (Tri-Logo / Palitoy)", year: "1984–85", features: "70-figure grid on reverse; Palitoy or Tri-Logo branding; international market (primarily UK/Europe)", rarity: "★★★★☆", notes: "Not a U.S. Kenner cardback. Most examples are PAL-TL variant; some are PAL. Strong at Vectis, Hake's, and Heritage." },
];

export const MASTER_TABLE_CODES: string[] = MASTER_TABLE.map((r) => r.code);

/** Lookup helper — returns the row for a given code, or undefined. */
export const getMasterRow = (code: string): MasterTableRow | undefined =>
  MASTER_TABLE.find((r) => r.code === code);

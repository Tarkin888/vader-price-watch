/**
 * Auto-classification for Darth Vader cardback lots.
 * Applied on scrape/import to derive era, cardbackCode, variantCode, gradeTierCode, variantGradeKey.
 */

export interface ClassifiedFields {
  era: string;
  cardback_code: string;
  variant_code: string;
  grade_tier_code: string;
  variant_grade_key: string;
}

/** Derive era and cardback_code directly from a variant_code string */
export function deriveFromVariantCode(variantCode: string): { era: string; cardback_code: string } {
  const vc = variantCode.toUpperCase();
  if (vc.startsWith("POTF-")) return { era: "POTF", cardback_code: vc.replace(/-DT$/, "") };
  if (vc.startsWith("ROTJ-")) return { era: "ROTJ", cardback_code: vc.replace(/-VP$/, "").replace(/-DT$/, "") };
  if (vc.startsWith("ESB-")) return { era: "ESB", cardback_code: vc.replace(/-DT$/, "") };
  if (vc.startsWith("SW-")) return { era: "SW", cardback_code: vc.replace(/-DT$/, "") };
  if (/^12[ABC]/.test(vc)) return { era: "SW", cardback_code: `SW-${vc.replace(/-DT$/, "")}` };
  if (vc === "CAN") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "PAL") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "MEX") return { era: "ROTJ", cardback_code: "ROTJ-65" };
  if (vc === "VP") return { era: "ROTJ", cardback_code: "ROTJ-65" };
  return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
}

export function classifyLot(title: string, conditionNotes?: string): ClassifiedFields {
  const text = `${title} ${conditionNotes ?? ""}`.toLowerCase();

  // --- ERA ---
  let era = "UNKNOWN";
  if (/power\s*of\s*the\s*force|potf/i.test(text)) era = "POTF";
  else if (/return\s*of\s*the\s*jedi|rotj/i.test(text)) era = "ROTJ";
  else if (/empire\s*strikes\s*back|esb/i.test(text)) era = "ESB";
  else if (/star\s*wars|\bsw\b/i.test(text)) era = "SW";

  // --- CARDBACK CODE ---
  let cardbackCode = "UNKNOWN";
  if (/92[\s-]?back|potf/i.test(text)) cardbackCode = "POTF-92";
  else if (/79[\s-]?a?\s*-?back|79a\b|\brotj[\s-]?79\b|79[\s-]?figure/i.test(text)) cardbackCode = "ROTJ-79";
  else if (/77[\s-]?a?\s*-?back|77a\b|\brotj[\s-]?77\b/i.test(text)) cardbackCode = "ROTJ-77";
  else if (/70[\s-]?back|70b\b|70[\s-]?figure/i.test(text)) cardbackCode = "ROTJ-70";
  else if (/65[\s-]?a?\s*-?back|65a\b|\brotj[\s-]?65\b/i.test(text)) cardbackCode = "ROTJ-65";
  else if (/48[\s-]?a?\s*-?back|48a\b/i.test(text) && era === "ROTJ") cardbackCode = "ROTJ-48";
  else if (/48[\s-]?a?\s*-?back|48a\b/i.test(text) && era === "ESB") cardbackCode = "ESB-48";
  else if (/48[\s-]?a?\s*-?back|48a\b/i.test(text)) cardbackCode = "ESB-48";
  else if (/47[\s-]?a?\s*-?back|47a\b|\besb[\s-]?47\b/i.test(text)) cardbackCode = "ESB-47";
  else if (/45[\s-]?a?\s*-?back|45a\b|\besb[\s-]?45\b/i.test(text)) cardbackCode = "ESB-45";
  else if (/41[\s-]?a?\s*-?back|41a\b|\besb[\s-]?41\b/i.test(text)) cardbackCode = "ESB-41";
  else if (/32[\s-]?back/i.test(text)) cardbackCode = "ESB-32";
  else if (/31[\s-]?back|\besb[\s-]?31\b/i.test(text)) cardbackCode = "ESB-31";
  else if (/21[\s-]?back/i.test(text)) cardbackCode = "SW-21";
  else if (/20[\s-]?back/i.test(text)) cardbackCode = "SW-20";
  // Palitoy "12 figure A/B/C back" patterns
  else if (/12[\s-]?(?:figure\s*)?a[\s-]?back|12-?back\s*a|\b12a\b/i.test(text)) cardbackCode = "SW-12A";
  else if (/12[\s-]?(?:figure\s*)?b[\s-]?back|12-?back\s*b|\b12b\b/i.test(text)) cardbackCode = "SW-12B";
  else if (/12[\s-]?(?:figure\s*)?c[\s-]?back|12-?back\s*c|\b12c\b/i.test(text)) cardbackCode = "SW-12C";
  else if (/12[\s-]?back|12[\s-]?figure/i.test(text)) cardbackCode = "SW-12";

  // --- VARIANT SUB-CODE ---
  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) {
    variantCode = cardbackCode + "-DT";
  }
  // Tri-Logo check BEFORE Palitoy — search both title and condition_notes
  if (/tri[\s-]?logo|trilogo/i.test(text)) variantCode = "PAL-TL";
  else if (/\bcanadian\b|\bbilingual\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "CAN";
  else if (/\bpalitoy\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "PAL";
  else if (/\bmexico\b|\bmexican\b|\blili\s*ledy\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "MEX";
  else if (/vader\s*pointing|alternate\s*photo/i.test(text)) variantCode = "VP";

  // --- GRADE TIER ---
  let gradeTierCode = "UNKNOWN";
  // AFA patterns (including Y-prefix for transitional grades)
  if (/afa\s*(?:graded\s*)?u?9[0-9]|afa\s*9[0-9]|afa\s*(?:graded\s*)?u90/i.test(text)) gradeTierCode = "AFA-90+";
  else if (/afa\s*(?:graded\s*)?(?:u|y[\s-]?)?85|afa\s*85/i.test(text)) gradeTierCode = "AFA-85";
  else if (/afa\s*(?:graded\s*)?(?:u|y[\s-]?)?80|afa\s*80/i.test(text)) gradeTierCode = "AFA-80";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?75|afa\s*75/i.test(text)) gradeTierCode = "AFA-75";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?70|afa\s*70/i.test(text)) gradeTierCode = "AFA-70";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?60|afa\s*60/i.test(text)) gradeTierCode = "AFA-60";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?50|afa\s*(?:y[\s-]?)?50/i.test(text)) gradeTierCode = "AFA-50";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?40|afa\s*40/i.test(text)) gradeTierCode = "AFA-40";
  // UKG patterns
  else if (/ukg\s*(?:graded\s*)?9[0-9]?%?/i.test(text)) gradeTierCode = "UKG-90";
  else if (/ukg\s*(?:graded\s*)?85%?/i.test(text)) gradeTierCode = "UKG-85";
  else if (/ukg\s*(?:graded\s*)?80%?/i.test(text)) gradeTierCode = "UKG-80";
  else if (/ukg\s*(?:graded\s*)?75%?/i.test(text)) gradeTierCode = "UKG-75";
  else if (/ukg\s*(?:graded\s*)?70%?/i.test(text)) gradeTierCode = "UKG-70";
  // CAS patterns
  else if (/cas\s*85|cas85/i.test(text)) gradeTierCode = "CAS-85";
  else if (/cas\s*80|cas80/i.test(text)) gradeTierCode = "CAS-80";
  else if (/cas\s*75|cas75/i.test(text)) gradeTierCode = "CAS-75";
  else if (/cas\s*70|cas70/i.test(text)) gradeTierCode = "CAS-70";
  // RAW MOC
  else if (/\bmoc\b/i.test(text)) gradeTierCode = "RAW-NM";
  // Generic "Graded" with no identifiable score
  else if (/\bgraded\b/i.test(text)) gradeTierCode = "GRADED-UNKNOWN";

  const variantGradeKey = `${variantCode}-${gradeTierCode}`;

  return {
    era,
    cardback_code: cardbackCode,
    variant_code: variantCode,
    grade_tier_code: gradeTierCode,
    variant_grade_key: variantGradeKey,
  };
}

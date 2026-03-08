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
  else if (/79[\s-]?back/i.test(text)) cardbackCode = "ROTJ-79";
  else if (/77[\s-]?back/i.test(text)) cardbackCode = "ROTJ-77";
  else if (/65[\s-]?back/i.test(text)) cardbackCode = "ROTJ-65";
  else if (/48[\s-]?back/i.test(text) && era === "ROTJ") cardbackCode = "ROTJ-48";
  else if (/48[\s-]?back/i.test(text) && era === "ESB") cardbackCode = "ESB-48";
  else if (/48[\s-]?back/i.test(text)) cardbackCode = "ESB-48";
  else if (/47[\s-]?back/i.test(text)) cardbackCode = "ESB-47";
  else if (/45[\s-]?back/i.test(text)) cardbackCode = "ESB-45";
  else if (/41[\s-]?back/i.test(text)) cardbackCode = "ESB-41";
  else if (/32[\s-]?back/i.test(text)) cardbackCode = "ESB-32";
  else if (/31[\s-]?back/i.test(text)) cardbackCode = "ESB-31";
  else if (/21[\s-]?back/i.test(text)) cardbackCode = "SW-21";
  else if (/20[\s-]?back/i.test(text)) cardbackCode = "SW-20";
  else if (/12[\s-]?back\s*a|12-?back\s*a|\b12a\b/i.test(text)) cardbackCode = "SW-12A";
  else if (/12[\s-]?back\s*b|12-?back\s*b|\b12b\b/i.test(text)) cardbackCode = "SW-12B";
  else if (/12[\s-]?back\s*c|12-?back\s*c|\b12c\b/i.test(text)) cardbackCode = "SW-12C";
  else if (/12[\s-]?back/i.test(text)) cardbackCode = "SW-12";

  // --- VARIANT SUB-CODE ---
  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) {
    variantCode = cardbackCode + "-DT";
  }
  if (/canadian|bilingual/i.test(text)) variantCode = "CAN";
  else if (/palitoy/i.test(text)) variantCode = "PAL";
  else if (/mexico|mexican|lili\s*ledy/i.test(text)) variantCode = "MEX";
  else if (/vader\s*pointing|alternate\s*photo/i.test(text)) variantCode = "VP";

  // --- GRADE TIER ---
  let gradeTierCode = "UNKNOWN";
  if (/afa\s*9[0-9]|afa9[0-9]/i.test(text)) gradeTierCode = "AFA-90+";
  else if (/afa\s*85|afa85/i.test(text)) gradeTierCode = "AFA-85";
  else if (/afa\s*80|afa80/i.test(text)) gradeTierCode = "AFA-80";
  else if (/afa\s*75|afa75/i.test(text)) gradeTierCode = "AFA-75";
  else if (/afa\s*70|afa70/i.test(text)) gradeTierCode = "AFA-70";
  else if (/ukg\s*85|ukg85/i.test(text)) gradeTierCode = "UKG-85";
  else if (/ukg\s*80|ukg80/i.test(text)) gradeTierCode = "UKG-80";
  else if (/cas\s*80|cas80/i.test(text)) gradeTierCode = "CAS-80";
  else if (/\bmoc\b/i.test(text)) gradeTierCode = "RAW-NM";

  const variantGradeKey = `${variantCode}-${gradeTierCode}`;

  return {
    era,
    cardback_code: cardbackCode,
    variant_code: variantCode,
    grade_tier_code: gradeTierCode,
    variant_grade_key: variantGradeKey,
  };
}

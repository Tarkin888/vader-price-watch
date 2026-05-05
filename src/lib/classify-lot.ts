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
  if (vc === "PAL-TL") return { era: "ROTJ", cardback_code: "ROTJ-70" };
  if (vc === "PAL") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "CAN") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "MEX") return { era: "ROTJ", cardback_code: "ROTJ-65" };
  if (vc === "VP") return { era: "ROTJ", cardback_code: "ROTJ-65" };
  if (vc === "TT") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "PBP") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "HAR") return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
  if (vc === "TT-SW")   return { era: "SW",   cardback_code: "TT-SW" };
  if (vc === "TT-ESB")  return { era: "ESB",  cardback_code: "TT-ESB" };
  if (vc === "TT-ROTJ") return { era: "ROTJ", cardback_code: "TT-ROTJ" };
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

  // --- CARDBACK CODE (extract from text regardless of regional variant) ---
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
  else if (/\b21[\s-]?back\s*([A-G])\b|\b21-?back-?([A-G])\b|\bsw[\s-]?21([A-G])\b|\b21([A-G])[\s-]?back\b/i.test(text)) {
    const m = text.match(/\b21[\s-]?back\s*([A-G])\b|\b21-?back-?([A-G])\b|\bsw[\s-]?21([A-G])\b|\b21([A-G])[\s-]?back\b/i);
    const sub = (m?.[1] || m?.[2] || m?.[3] || m?.[4] || "").toUpperCase();
    cardbackCode = sub ? `SW-21${sub}` : "SW-21";
  }
  else if (/21[\s-]?back|\b21\s*card\b/i.test(text)) cardbackCode = "SW-21";
  else if (/20[\s-]?back|\b20\s*card\b/i.test(text)) cardbackCode = "SW-20";
  // Palitoy "12 figure A/B/C back" patterns
  else if (/12[\s-]?(?:figure\s*)?a[\s-]?back|12-?back\s*a|\b12a\b/i.test(text)) cardbackCode = "SW-12A";
  else if (/12[\s-]?(?:figure\s*)?b[\s-]?back|12-?back\s*b|\b12b\b/i.test(text)) cardbackCode = "SW-12B";
  else if (/12[\s-]?(?:figure\s*)?c[\s-]?back|12-?back\s*c|\b12c\b/i.test(text)) cardbackCode = "SW-12C";
  else if (/12[\s-]?back|12[\s-]?figure|\b12\s*card\b|12[\s-]card[\s-]?back/i.test(text)) cardbackCode = "SW-12";

  // POTF default: POTF-92 is the only Vader POTF cardback
  if (cardbackCode === "UNKNOWN" && era === "POTF") cardbackCode = "POTF-92";

  // --- VARIANT SUB-CODE ---
  // Detect regional/special variants independently of cardbackCode
  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) {
    variantCode = cardbackCode + "-DT";
  }

  // Tri-Logo check BEFORE Palitoy — search both title and condition_notes
  const isTriLogo = /tri[\s-]?logo|trilogo/i.test(text);
  const isPalitoy = /\bpalitoy\b/i.test(text);
  const isCanadian = /\bcanadian\b|\bbilingual\b/i.test(text);
  const isMexico = /\bmexico\b|\bmexican\b|\blili\s*ledy\b/i.test(text);
  const isTopToys = /\btop\s*toys\b/i.test(text);
  const isPBP = /\bpbp\b/i.test(text);
  const isVaderPointing = /vader\s*pointing|alternate\s*photo/i.test(text);
  const isTakara = /\btakara\b/i.test(text);
  const isHarbert = /\bharbert\b/i.test(text);
  const isClipMask = /\bclip[\s-]?mask\b/i.test(text);

  if (isTriLogo) {
    variantCode = "PAL-TL";
    // Tri-Logo is always ROTJ-70 unless a specific cardback was found
    if (cardbackCode === "UNKNOWN") cardbackCode = "ROTJ-70";
    if (era === "UNKNOWN" || era === "SW") era = "ROTJ";
  } else if (isPBP) {
    variantCode = "PBP";
  } else if (isCanadian) {
    variantCode = "CAN";
  } else if (isMexico) {
    variantCode = "MEX";
    if (cardbackCode === "UNKNOWN") cardbackCode = "ROTJ-65";
    if (era === "UNKNOWN") era = "ROTJ";
  } else if (isPalitoy) {
    variantCode = "PAL";
    // Palitoy lots with no specific cardback number — leave as found or UNKNOWN
  } else if (isTopToys) {
    variantCode = "TT";
    if (cardbackCode === "UNKNOWN" && era === "SW")   cardbackCode = "TT-SW";
    if (cardbackCode === "UNKNOWN" && era === "ESB")  cardbackCode = "TT-ESB";
    if (cardbackCode === "UNKNOWN" && era === "ROTJ") cardbackCode = "TT-ROTJ";
  } else if (isTakara) {
    variantCode = "TAK";
  } else if (isHarbert) {
    variantCode = "HAR";
  } else if (isClipMask) {
    variantCode = "CLIP";
  } else if (isVaderPointing) {
    variantCode = "VP";
    if (cardbackCode === "UNKNOWN") cardbackCode = "ROTJ-65";
    if (era === "UNKNOWN") era = "ROTJ";
  }

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
  // RAW MOC / carded / unpunched / sealed
  else if (/\bmoc\b|\bcarded\b|\bunpunched\b|\bsealed\b/i.test(text)) gradeTierCode = "RAW-NM";
  // Prose-based grade fallbacks (condition_notes)
  else if (/\bmint\b|near[\s-]?mint|\bnm\b|excellent\s*plus/i.test(text)) gradeTierCode = "RAW-NM";
  else if (/\bexcellent\b|good\s*plus|\bvg\+|very\s*good\s*plus/i.test(text)) gradeTierCode = "RAW-EX";
  else if (/\bgood\b|\bfair\b|\bpoor\b|\bplayworn\b|\bdamaged\b|\bcrushed\b/i.test(text) && !/good\s*plus|good\s*condition\s*overall/i.test(text)) gradeTierCode = "RAW-VG";
  // AFA mentioned without numeric score
  else if (/\bafa\b/i.test(text)) gradeTierCode = "GRADED-UNKNOWN";
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

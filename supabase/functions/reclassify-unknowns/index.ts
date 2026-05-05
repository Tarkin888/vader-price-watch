import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClassifiedFields {
  era: string;
  cardback_code: string;
  variant_code: string;
  grade_tier_code: string;
  variant_grade_key: string;
}

function classifyLot(title: string, conditionNotes?: string): ClassifiedFields {
  const text = `${title} ${conditionNotes ?? ""}`.toLowerCase();

  let era = "UNKNOWN";
  if (/power\s*of\s*the\s*force|potf/i.test(text)) era = "POTF";
  else if (/return\s*of\s*the\s*jedi|rotj/i.test(text)) era = "ROTJ";
  else if (/empire\s*strikes\s*back|esb/i.test(text)) era = "ESB";
  else if (/star\s*wars|\bsw\b/i.test(text)) era = "SW";

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
  else if (/21[\s-]?back|\b21\s*card\b/i.test(text)) cardbackCode = "SW-21";
  else if (/20[\s-]?back|\b20\s*card\b/i.test(text)) cardbackCode = "SW-20";
  else if (/12[\s-]?(?:figure\s*)?a[\s-]?back|12-?back\s*a|\b12a\b/i.test(text)) cardbackCode = "SW-12A";
  else if (/12[\s-]?(?:figure\s*)?b[\s-]?back|12-?back\s*b|\b12b\b/i.test(text)) cardbackCode = "SW-12B";
  else if (/12[\s-]?(?:figure\s*)?c[\s-]?back|12-?back\s*c|\b12c\b/i.test(text)) cardbackCode = "SW-12C";
  else if (/12[\s-]?back|12[\s-]?figure|\b12\s*card\b|12[\s-]card[\s-]?back/i.test(text)) cardbackCode = "SW-12";

  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) variantCode = cardbackCode + "-DT";

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

  let gradeTierCode = "UNKNOWN";
  if (/afa\s*(?:graded\s*)?u?9[0-9]|afa\s*9[0-9]|afa\s*(?:graded\s*)?u90/i.test(text)) gradeTierCode = "AFA-90+";
  else if (/afa\s*(?:graded\s*)?(?:u|y[\s-]?)?85|afa\s*85/i.test(text)) gradeTierCode = "AFA-85";
  else if (/afa\s*(?:graded\s*)?(?:u|y[\s-]?)?80|afa\s*80/i.test(text)) gradeTierCode = "AFA-80";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?75|afa\s*75/i.test(text)) gradeTierCode = "AFA-75";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?70|afa\s*70/i.test(text)) gradeTierCode = "AFA-70";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?60|afa\s*60/i.test(text)) gradeTierCode = "AFA-60";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?50|afa\s*(?:y[\s-]?)?50/i.test(text)) gradeTierCode = "AFA-50";
  else if (/afa\s*(?:graded\s*)?(?:y[\s-]?)?40|afa\s*40/i.test(text)) gradeTierCode = "AFA-40";
  else if (/ukg\s*(?:graded\s*)?9[0-9]?%?/i.test(text)) gradeTierCode = "UKG-90";
  else if (/ukg\s*(?:graded\s*)?85%?/i.test(text)) gradeTierCode = "UKG-85";
  else if (/ukg\s*(?:graded\s*)?80%?/i.test(text)) gradeTierCode = "UKG-80";
  else if (/ukg\s*(?:graded\s*)?75%?/i.test(text)) gradeTierCode = "UKG-75";
  else if (/ukg\s*(?:graded\s*)?70%?/i.test(text)) gradeTierCode = "UKG-70";
  else if (/cas\s*85|cas85/i.test(text)) gradeTierCode = "CAS-85";
  else if (/cas\s*80|cas80/i.test(text)) gradeTierCode = "CAS-80";
  else if (/cas\s*75|cas75/i.test(text)) gradeTierCode = "CAS-75";
  else if (/cas\s*70|cas70/i.test(text)) gradeTierCode = "CAS-70";
  else if (/\bmoc\b|\bcarded\b|\bunpunched\b|\bsealed\b/i.test(text)) gradeTierCode = "RAW-NM";
  else if (/\bmint\b|near[\s-]?mint|\bnm\b|excellent\s*plus/i.test(text)) gradeTierCode = "RAW-NM";
  else if (/\bexcellent\b|good\s*plus|\bvg\+|very\s*good\s*plus/i.test(text)) gradeTierCode = "RAW-EX";
  else if (/\bgood\b|\bfair\b|\bpoor\b|\bplayworn\b|\bdamaged\b|\bcrushed\b/i.test(text) && !/good\s*plus|good\s*condition\s*overall/i.test(text)) gradeTierCode = "RAW-VG";
  else if (/\bafa\b/i.test(text)) gradeTierCode = "GRADED-UNKNOWN";
  else if (/\bgraded\b/i.test(text)) gradeTierCode = "GRADED-UNKNOWN";

  const variantGradeKey = `${variantCode}-${gradeTierCode}`;
  return { era, cardback_code: cardbackCode, variant_code: variantCode, grade_tier_code: gradeTierCode, variant_grade_key: variantGradeKey };
}

function deriveFromVariantCode(variantCode: string): { era: string; cardback_code: string } {
  const vc = variantCode.toUpperCase();
  if (vc.startsWith("POTF-")) return { era: "POTF", cardback_code: vc.replace(/-DT$/, "") };
  if (vc.startsWith("ROTJ-")) return { era: "ROTJ", cardback_code: vc.replace(/-VP$/, "").replace(/-DT$/, "") };
  if (vc.startsWith("ESB-")) return { era: "ESB", cardback_code: vc.replace(/-DT$/, "") };
  if (vc.startsWith("SW-")) return { era: "SW", cardback_code: vc.replace(/-DT$/, "") };
  if (/^12[ABC]/.test(vc)) return { era: "SW", cardback_code: `SW-${vc.replace(/-DT$/, "")}` };
  if (vc === "PAL-TL") return { era: "ROTJ", cardback_code: "ROTJ-70" };
  if (vc === "MEX") return { era: "ROTJ", cardback_code: "ROTJ-65" };
  if (vc === "VP") return { era: "ROTJ", cardback_code: "ROTJ-65" };
  if (vc === "TT-SW")   return { era: "SW",   cardback_code: "TT-SW" };
  if (vc === "TT-ESB")  return { era: "ESB",  cardback_code: "TT-ESB" };
  if (vc === "TT-ROTJ") return { era: "ROTJ", cardback_code: "TT-ROTJ" };
  return { era: "UNKNOWN", cardback_code: "UNKNOWN" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch lots with any UNKNOWN field, PAL variant, or GRADED-UNKNOWN grade
    const { data: lots, error: fetchErr } = await supabase
      .from("lots")
      .select("id, lot_ref, condition_notes, variant_code, grade_tier_code, era, cardback_code")
      .or("variant_code.eq.UNKNOWN,grade_tier_code.eq.UNKNOWN,cardback_code.eq.UNKNOWN,era.eq.UNKNOWN,variant_code.eq.PAL,grade_tier_code.eq.GRADED-UNKNOWN");

    if (fetchErr) throw fetchErr;
    if (!lots || lots.length === 0) {
      return new Response(JSON.stringify({ updated: 0, total_candidates: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedCount = 0;
    const details: string[] = [];

    for (const lot of lots) {
      const classified = classifyLot(lot.lot_ref || "", lot.condition_notes || "");
      const updates: Record<string, string> = {};

      // Also try deriving from variant_code as fallback
      let finalClassifiedEra = classified.era;
      let finalClassifiedCardback = classified.cardback_code;
      if (finalClassifiedEra === "UNKNOWN" || finalClassifiedCardback === "UNKNOWN") {
        const derived = deriveFromVariantCode(lot.variant_code || classified.variant_code);
        if (finalClassifiedEra === "UNKNOWN" && derived.era !== "UNKNOWN") finalClassifiedEra = derived.era;
        if (finalClassifiedCardback === "UNKNOWN" && derived.cardback_code !== "UNKNOWN") finalClassifiedCardback = derived.cardback_code;
      }

      if (lot.variant_code === "UNKNOWN" && classified.variant_code !== "UNKNOWN") {
        updates.variant_code = classified.variant_code;
      }
      if (lot.variant_code === "PAL" && classified.variant_code === "PAL-TL") {
        updates.variant_code = "PAL-TL";
      }
      if (lot.grade_tier_code === "UNKNOWN" && classified.grade_tier_code !== "UNKNOWN") {
        updates.grade_tier_code = classified.grade_tier_code;
      }
      if (lot.grade_tier_code === "GRADED-UNKNOWN" && classified.grade_tier_code !== "UNKNOWN" && classified.grade_tier_code !== "GRADED-UNKNOWN") {
        updates.grade_tier_code = classified.grade_tier_code;
      }
      if (lot.era === "UNKNOWN" && finalClassifiedEra !== "UNKNOWN") {
        updates.era = finalClassifiedEra;
      }
      if (lot.cardback_code === "UNKNOWN" && finalClassifiedCardback !== "UNKNOWN") {
        updates.cardback_code = finalClassifiedCardback;
      }

      if (Object.keys(updates).length > 0) {
        const finalVariant = updates.variant_code || lot.variant_code;
        const finalGrade = updates.grade_tier_code || lot.grade_tier_code;
        updates.variant_grade_key = `${finalVariant}-${finalGrade}`;

        const { error: updateErr } = await supabase
          .from("lots")
          .update(updates)
          .eq("id", lot.id);

        if (!updateErr) {
          updatedCount++;
          details.push(`${lot.lot_ref}: ${JSON.stringify(updates)}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ updated: updatedCount, total_candidates: lots.length, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

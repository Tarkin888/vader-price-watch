/**
 * Vectis Refresh — Re-scrape records with bad/missing condition_notes
 *
 * Finds all Vectis records where condition_notes contains "cookies",
 * is empty, or is null, then re-visits each lot page to extract the
 * correct description and re-classify.
 *
 * Usage:
 *   node scripts/scrape-vectis-refresh.js
 */

const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Classification (mirrors src/lib/classify-lot.ts) ─────────
function classifyLot(title, conditionNotes = "") {
  const text = `${title} ${conditionNotes}`.toLowerCase();

  let era = "UNKNOWN";
  if (/power\s*of\s*the\s*force|potf/i.test(text)) era = "POTF";
  else if (/return\s*of\s*the\s*jedi|rotj/i.test(text)) era = "ROTJ";
  else if (/empire\s*strikes\s*back|esb/i.test(text)) era = "ESB";
  else if (/star\s*wars|\bsw\b/i.test(text)) era = "SW";

  let cardbackCode = "UNKNOWN";
  if (/92[\s-]?back|potf/i.test(text)) cardbackCode = "POTF-92";
  else if (/79[\s-]?a?\s*-?back|79a\b|\brotj[\s-]?79\b/i.test(text)) cardbackCode = "ROTJ-79";
  else if (/77[\s-]?a?\s*-?back|77a\b|\brotj[\s-]?77\b/i.test(text)) cardbackCode = "ROTJ-77";
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
  else if (/12[\s-]?a[\s-]?back|12-?back\s*a|\b12a\b/i.test(text)) cardbackCode = "SW-12A";
  else if (/12[\s-]?b[\s-]?back|12-?back\s*b|\b12b\b/i.test(text)) cardbackCode = "SW-12B";
  else if (/12[\s-]?c[\s-]?back|12-?back\s*c|\b12c\b/i.test(text)) cardbackCode = "SW-12C";
  else if (/12[\s-]?back/i.test(text)) cardbackCode = "SW-12";

  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) variantCode = cardbackCode + "-DT";
  if (/canadian|bilingual/i.test(text)) variantCode = "CAN";
  else if (/palitoy/i.test(text)) variantCode = "PAL";
  else if (/mexico|mexican|lili\s*ledy/i.test(text)) variantCode = "MEX";
  else if (/vader\s*pointing|alternate\s*photo/i.test(text)) variantCode = "VP";

  let gradeTierCode = "UNKNOWN";
  if (/afa\s*(?:graded\s*)?u?9[0-9]|afa\s*9[0-9]|afa\s*(?:graded\s*)?u90/i.test(text)) gradeTierCode = "AFA-90+";
  else if (/afa\s*(?:graded\s*)?u?85|afa\s*85/i.test(text)) gradeTierCode = "AFA-85";
  else if (/afa\s*(?:graded\s*)?u?80|afa\s*80/i.test(text)) gradeTierCode = "AFA-80";
  else if (/afa\s*(?:graded\s*)?75|afa\s*75/i.test(text)) gradeTierCode = "AFA-75";
  else if (/afa\s*(?:graded\s*)?70|afa\s*70/i.test(text)) gradeTierCode = "AFA-70";
  else if (/ukg\s*(?:graded\s*)?9[0-9]?%?/i.test(text)) gradeTierCode = "UKG-90";
  else if (/ukg\s*(?:graded\s*)?85%?/i.test(text)) gradeTierCode = "UKG-85";
  else if (/ukg\s*(?:graded\s*)?80%?/i.test(text)) gradeTierCode = "UKG-80";
  else if (/ukg\s*(?:graded\s*)?70%?/i.test(text)) gradeTierCode = "UKG-70";
  else if (/cas\s*80|cas80/i.test(text)) gradeTierCode = "CAS-80";
  else if (/\bmoc\b/i.test(text)) gradeTierCode = "RAW-NM";
  else if (/\bgraded\b/i.test(text)) gradeTierCode = "GRADED-UNKNOWN";

  return {
    era,
    cardback_code: cardbackCode,
    variant_code: variantCode,
    grade_tier_code: gradeTierCode,
    variant_grade_key: `${variantCode}-${gradeTierCode}`,
  };
}

function extractSubgrades(text) {
  const patterns = [
    /card\s*\d+\s*bubble\s*\d+\s*figure\s*\d+/i,
    /figure\s*\d+\s*paint\s*\d+\s*cape\s*\d+/i,
    /(?:nm\s+)?card\s*\d+\s*bubble\s*\d+\s*figure\s*\d+/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Page extraction (same logic as fixed scraper) ────────────
async function extractConditionNotes(page) {
  return page.evaluate(() => {
    const REJECT = [
      "cookies", "payment", "buyer", "endeavoured", "sold as is",
      "bidding", "privacy", "credit or debit", "bank transfer", "consent",
    ];

    function stripDisclaimer(t) {
      const DISCLAIMERS = ["We have endeavoured", "SOLD AS IS", "Buyer's Premium", "bidding on any lot"];
      for (const d of DISCLAIMERS) {
        const idx = t.indexOf(d);
        if (idx > -1) t = t.substring(0, idx).trim();
      }
      return t;
    }

    // Step 1: Find "Full Lot Description" heading and take next sibling
    const allHeadings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, b"));
    for (const h of allHeadings) {
      if (/full\s*lot\s*description/i.test(h.textContent || "")) {
        let sibling = h.nextElementSibling;
        if (!sibling && h.parentElement) sibling = h.parentElement.nextElementSibling;
        if (sibling) {
          const text = stripDisclaimer(sibling.textContent?.trim() || "");
          if (text.length > 10) return text;
        }
      }
    }

    // Step 2: Fallback — first <p> starting with known keywords
    const allP = Array.from(document.querySelectorAll("p"));
    for (const p of allP) {
      const raw = p.textContent?.trim() || "";
      const text = stripDisclaimer(raw);
      if (text.length < 40) continue;
      const lower = text.toLowerCase();
      if (REJECT.some((r) => lower.includes(r))) continue;
      if (/^(kenner|palitoy|star wars)/i.test(text)) return text;
    }

    // Step 3: Empty — do not store garbage
    return "";
  }).catch(() => "");
}

// ─── Main ─────────────────────────────────────────────────────
async function refreshVectis() {
  console.log("Fetching Vectis records with bad/missing condition_notes...\n");

  // Fetch records needing refresh
  const { data: records, error } = await supabase
    .from("lots")
    .select("id, lot_ref, lot_url, condition_notes")
    .eq("source", "Vectis")
    .or("condition_notes.ilike.%cookie%,condition_notes.eq.,condition_notes.is.null");

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${records.length} records to refresh\n`);
  if (records.length === 0) return;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  let updated = 0;
  let failed = 0;

  for (const record of records) {
    if (!record.lot_url) {
      console.warn(`  ⚠ No URL for lot_ref ${record.lot_ref}, skipping`);
      failed++;
      continue;
    }

    await sleep(2000 + Math.random() * 1000);

    try {
      await page.goto(record.lot_url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.warn(`  ⚠ Failed to load ${record.lot_ref}: ${e.message}`);
      failed++;
      continue;
    }

    const conditionNotes = await extractConditionNotes(page);

    // Get title for classification
    const fullTitle = await page.evaluate(() => {
      const h = document.querySelector("h1, h2, .lot-title, [class*='lot-title']");
      return h?.textContent?.trim() || "";
    }).catch(() => "");

    const classification = classifyLot(fullTitle, conditionNotes);
    const subgrades = extractSubgrades(conditionNotes);

    const { error: updateErr } = await supabase
      .from("lots")
      .update({
        condition_notes: conditionNotes.substring(0, 1000),
        era: classification.era,
        cardback_code: classification.cardback_code,
        variant_code: classification.variant_code,
        grade_tier_code: classification.grade_tier_code,
        variant_grade_key: classification.variant_grade_key,
        grade_subgrades: subgrades,
      })
      .eq("id", record.id);

    if (updateErr) {
      console.warn(`  ✗ Update failed for ${record.lot_ref}: ${updateErr.message}`);
      failed++;
    } else {
      updated++;
      console.log(`  ✓ Updated: ${classification.variant_code} | ${record.lot_ref}`);
    }
  }

  await browser.close();

  console.log(`\n═══════════════════════════════════════`);
  console.log(`REFRESH COMPLETE`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`═══════════════════════════════════════\n`);
}

refreshVectis().catch(console.error);

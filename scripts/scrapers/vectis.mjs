/**
 * Vectis Scraper — Standalone Node.js script using Playwright
 *
 * Prerequisites:
 *   npm install playwright @supabase/supabase-js
 *   npx playwright install chromium
 *
 * Usage:
 *   SUPABASE_URL=https://rdtwgrznjkigghbwstqz.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *   node scripts/scrapers/vectis.mjs
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL =
  "https://www.vectis.co.uk/catalog?query=darth+vader+kenner+carded&timeframe=archived&per_page=96";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Title filter ──────────────────────────────────────────────
const KEEP_KEYWORDS = [
  "carded", "on card", "moc", "afa", "ukg", "cas",
  "12 back", "20 back", "21 back",
  "31 back", "32 back", "41 back", "45 back", "47 back", "48 back",
  "65 back", "77 back", "79 back", "92 back",
  "potf", "power of the force",
];

const DISCARD_KEYWORDS = [
  '12"', "12 inch", "tie fighter", "collector case", "carry case",
  "playset", "loose", "inflatable", "transfer sheet",
];

function shouldKeep(title) {
  const t = title.toLowerCase();
  if (DISCARD_KEYWORDS.some((kw) => t.includes(kw))) return false;
  return KEEP_KEYWORDS.some((kw) => t.includes(kw));
}

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

  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) variantCode = cardbackCode + "-DT";
  if (/canadian|bilingual/i.test(text)) variantCode = "CAN";
  else if (/palitoy/i.test(text)) variantCode = "PAL";
  else if (/mexico|mexican|lili\s*ledy/i.test(text)) variantCode = "MEX";
  else if (/vader\s*pointing|alternate\s*photo/i.test(text)) variantCode = "VP";

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

  return { era, cardback_code: cardbackCode, variant_code: variantCode, grade_tier_code: gradeTierCode, variant_grade_key: `${variantCode}-${gradeTierCode}` };
}

// ─── Helpers ───────────────────────────────────────────────────
function sleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((r) => setTimeout(r, ms));
}

function parseDate(dateStr) {
  // e.g. "Wednesday 26 April 2023"
  try {
    const d = new Date(dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, ""));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
}

function parseEstimate(text) {
  // e.g. "£100 - £200" or "Estimate: £100 - £200"
  const nums = [...text.matchAll(/£([\d,]+)/g)].map((m) => parseInt(m[1].replace(/,/g, ""), 10));
  return { low: nums[0] ?? null, high: nums[1] ?? nums[0] ?? null };
}

// ─── Main scraper ──────────────────────────────────────────────
export async function scrapeVectis() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  let inserted = 0;
  let skipped = 0;

  try {
    // Page 1 to get total count
    console.log("Loading search results page 1...");
    await page.goto(`${BASE_URL}&page=1`, { waitUntil: "networkidle" });

    // Get total count from "Showing 96 of N lots"
    const showingText = await page.textContent("body");
    const totalMatch = showingText.match(/showing\s+\d+\s+of\s+([\d,]+)\s+lots/i);
    const totalLots = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : 96;
    const totalPages = Math.ceil(totalLots / 96);
    console.log(`Total: ${totalLots} lots, ${totalPages} pages`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) {
        console.log(`\nNavigating to page ${pageNum}/${totalPages}...`);
        await page.goto(`${BASE_URL}&page=${pageNum}`, { waitUntil: "networkidle" });
      }

      // Extract lot cards from listing
      const cards = await page.$$eval(".lot-card, .catalog-item, [class*='lot']", (els) => {
        return els.map((el) => {
          const heading = el.querySelector("h3, h4, h2");
          const link = el.querySelector('a[href*="/lot/"], a[href*="el="]');
          const img = el.querySelector("img");
          const lotLabel = el.textContent?.match(/lot\s+(\d+)/i);
          return {
            title: heading?.textContent?.trim() ?? "",
            url: link?.href ?? "",
            imageUrl: img?.src ?? "",
            lotNumber: lotLabel?.[1] ?? "",
          };
        }).filter((c) => c.title && c.url);
      });

      console.log(`Page ${pageNum}: found ${cards.length} cards`);

      for (const card of cards) {
        if (!shouldKeep(card.title)) {
          skipped++;
          continue;
        }

        // Extract lotRef from URL
        const urlObj = new URL(card.url, "https://www.vectis.co.uk");
        const lotRef = urlObj.searchParams.get("el") ?? card.lotNumber ?? card.url;

        // Check for duplicate
        const { data: existing } = await supabase
          .from("lots")
          .select("id")
          .eq("lot_ref", lotRef)
          .eq("source", "Vectis")
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        // Visit individual lot page
        await sleep(2000, 4000);
        console.log(`  Visiting: ${card.title.substring(0, 60)}...`);

        try {
          await page.goto(card.url, { waitUntil: "networkidle", timeout: 30000 });
        } catch (e) {
          console.warn(`  Failed to load lot page: ${e.message}`);
          continue;
        }

        // Extract lot details
        const fullTitle = await page.$eval("h2, h1", (el) => el.textContent?.trim() ?? "").catch(() => card.title);

        const conditionNotes = await page.$$eval("p, .description, .lot-description", (els) => {
          const texts = els.map((el) => el.textContent?.trim() ?? "");
          const disclaimer = "We have endeavoured";
          const joined = texts.join("\n");
          const idx = joined.indexOf(disclaimer);
          return idx > -1 ? joined.substring(0, idx).trim() : joined.trim();
        }).catch(() => "");

        const auctionName = await page.$eval(
          ".sale-name, .auction-title, [class*='auction'], [class*='sale']",
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        // Parse sale date from auction name
        const dateMatch = auctionName.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        const saleDate = dateMatch ? parseDate(dateMatch[1]) : new Date().toISOString().split("T")[0];

        // Parse estimates
        const estimateText = await page.$eval(
          ".estimate, [class*='estimate'], [class*='price']",
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");
        const { low: estimateLowGBP, high: estimateHighGBP } = parseEstimate(estimateText);

        // Large image URL
        const imageUrls = card.imageUrl
          ? [card.imageUrl.replace("/medium/", "/large/")]
          : [];

        // Classify
        const classification = classifyLot(fullTitle, conditionNotes);

        const record = {
          capture_date: new Date().toISOString().split("T")[0],
          sale_date: saleDate,
          source: "Vectis",
          lot_ref: lotRef,
          lot_url: card.url,
          variant_code: classification.variant_code,
          grade_tier_code: classification.grade_tier_code,
          era: classification.era,
          cardback_code: classification.cardback_code,
          hammer_price_gbp: 0,
          buyers_premium_gbp: 0,
          total_paid_gbp: 0,
          usd_to_gbp_rate: 1.0,
          image_urls: imageUrls,
          condition_notes: conditionNotes.substring(0, 500),
          estimate_low_gbp: estimateLowGBP,
          estimate_high_gbp: estimateHighGBP,
          price_status: "ESTIMATE_ONLY",
        };

        const { error } = await supabase.from("lots").insert(record);
        if (error) {
          console.warn(`  Insert failed: ${error.message}`);
        } else {
          inserted++;
          console.log(`  ✓ Inserted: ${classification.variant_code} | ${lotRef}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  return { inserted, skipped };
}

// Run if called directly
scrapeVectis().catch(console.error);

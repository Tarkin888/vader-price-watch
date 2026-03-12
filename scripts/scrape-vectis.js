/**
 * Vectis Scraper — Phase 1: Estimate Collection
 * 
 * Scrapes archived Vectis auction listings for Darth Vader carded figures.
 * Extracts estimates only (actual hammer prices require login - see Phase 2).
 * 
 * Prerequisites:
 *   npm install playwright @supabase/supabase-js dotenv
 *   npx playwright install chromium
 * 
 * Create a .env file with:
 *   SUPABASE_URL=https://rdtwgrznjkigghbwstqz.supabase.co
 *   SUPABASE_ANON_KEY=your-anon-key
 * 
 * Usage:
 *   node scrape-vectis.js
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL =
  "https://www.vectis.co.uk/catalog?query=darth+vader+kenner&timeframe=archived&per_page=96";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Title filter ──────────────────────────────────────────────
const KEEP_KEYWORDS = [
  "carded", "on card", "moc", "afa", "ukg", "cas",
  "12 back", "12-back", "20 back", "21 back",
  "31 back", "32 back", "41 back", "45 back", "47 back", "48 back",
  "65 back", "77 back", "79 back", "92 back",
  "potf", "power of the force",
  "punched", "unpunched", "sealed", "mint on card",
  "on original card", "original card", "blister",
];

const DISCARD_KEYWORDS = [
  '12"', "12 inch", "tie fighter", "tie-fighter", "collector case",
  "carry case", "playset", "loose", "inflatable", "transfer sheet",
  "job lot", "quantity of", "quantity", "collection of", "group of",
  "power of the force 2", "power of the force ii", "potf2", "potf ii",
  "black series", "vintage collection", "episode i", "episode ii",
  "episode iii", "modern",
  "carded pair", "figures a carded",
  "takara", "hasbro", "kenner/hasbro",
  "cinema cast", "cinemacast", "collectors case", "collector case",
  "collector's case", "action figure case", "die-cast", "diecast",
  "landspeeder", "signed", "insert proof", "2-pack", "diorama", "statue",
  "no coo", "loose figure",
  "baggie", "in baggie", "ssp", "van",
  "sote", "x twenty", "x ten", "x 20", "x 10",
  "figures x", "vehicles x",
];

// Keywords that trigger discard ONLY when no grading keyword is present
const CONDITIONAL_DISCARD = ["hong kong", "taiwan"];
const GRADING_KEYWORDS = ["afa", "ukg", "cas"];

// Graded lots are assumed carded UNLESS they contain a loose indicator
const LOOSE_INDICATORS = [
  "loose", "unpackaged", "removed from card",
  "out of packaging", "baggie", "in baggie",
];

// Carded indicators — used for ungraded lot filtering
const CARDED_INDICATORS = [
  "on card", "on original card", "carded", "back card",
  "back", "moc", "sealed card", "unpunched", "punched",
  "12 b-back", "12 a-back", "12 c-back",
  "31back", "41back", "47back", "65back", "77back",
  "79back", "92back", "potf",
  "blister", "blister pack", "backing card", "backing",
  "original backing", "within good", "within fair",
  "within excellent", "within near mint", "within mint",
  "card back", "cardback",
  "return of the jedi", "empire strikes back",
  "power of the force", "star wars card",
];

function shouldKeep(title) {
  const t = title.toLowerCase();
  // Must contain "Darth Vader"
  if (!t.includes("darth vader")) return false;
  // Discard if any exclusion keyword matches
  if (DISCARD_KEYWORDS.some((kw) => t.includes(kw))) return false;
  // Conditional discard: "hong kong" / "taiwan" unless graded
  const hasGrading = GRADING_KEYWORDS.some((kw) => t.includes(kw));
  if (!hasGrading && CONDITIONAL_DISCARD.some((kw) => t.includes(kw))) return false;
  // Graded lots must also have a carded indicator — otherwise it's a graded loose figure
  if (hasGrading && !CARDED_INDICATORS.some((kw) => t.includes(kw))) return false;
  // Discard ungraded loose figures: "3 3/4" or "vintage figure" with no cardback keyword
  const hasCardback = CARDED_INDICATORS.some((kw) => t.includes(kw));
  if (!hasGrading && !hasCardback) {
    if (/darth\s+vader\s+\d/.test(t) || t.includes("vintage figure")) return false;
  }
  // Must contain at least one MOC/cardback keyword
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
  const isMex = /\bmexico\b|\bmexican\b|\blili\s*ledy\b/i.test(text);
  if (/\bcanadian\b|\bbilingual\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "CAN";
  else if (/\bpalitoy\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "PAL";
  else if (isMex && cardbackCode === "UNKNOWN") variantCode = "MEX";
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

  return {
    era,
    cardback_code: cardbackCode,
    variant_code: variantCode,
    grade_tier_code: gradeTierCode,
    variant_grade_key: `${variantCode}-${gradeTierCode}`,
  };
}

// ─── Helpers ───────────────────────────────────────────────────
function sleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((r) => setTimeout(r, ms));
}

function parseDate(dateStr) {
  // e.g. "Wednesday 26 April 2023"
  try {
    const cleaned = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, "");
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
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

function parseEstimate(text) {
  // e.g. "£100 - £200" or "Estimate: £100 - £200"
  const nums = [...text.matchAll(/£([\d,]+)/g)].map((m) =>
    parseInt(m[1].replace(/,/g, ""), 10)
  );
  return { low: nums[0] ?? null, high: nums[1] ?? nums[0] ?? null };
}

// ─── Main scraper ──────────────────────────────────────────────
async function scrapeVectis() {
  console.log("Starting Vectis scraper...\n");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  let inserted = 0;
  let skipped = 0;
  let filtered = 0;

  try {
    // Page 1 to get total count
    console.log("Loading search results page 1...");
    await page.goto(`${BASE_URL}&page=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);

    // Get total count from "Showing 96 of N lots"
    const bodyText = await page.textContent("body");
    const totalMatch = bodyText.match(/showing\s+\d+\s+of\s+([\d,]+)\s+lots/i);
    const totalLots = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : 96;
    const totalPages = Math.ceil(totalLots / 96);
    console.log(`Found ${totalLots} lots across ${totalPages} pages\n`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) {
        console.log(`\n─── Page ${pageNum}/${totalPages} ───`);
        await page.goto(`${BASE_URL}&page=${pageNum}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(3000);
      }

      // Extract lot cards from listing
      const cards = await page.evaluate(() => {
        const foundCards = [];
        const seenLotRefs = new Set();

        const findCardContainer = (element) => {
          let current = element;
          while (current && current !== document.body) {
            const hasImg = current.querySelector("img");
            const hasHeading = current.querySelector("h2, h3, h4");
            if (hasImg && hasHeading) return current;
            current = current.parentElement;
          }
          return null;
        };

        const selectors = ['a[href*="-lot-"]', 'a[href*="el="]'];
        for (const selector of selectors) {
          const links = Array.from(document.querySelectorAll(selector));
          for (const link of links) {
            const href = link.getAttribute("href");
            if (!href) continue;

            const lotRefMatch = href.match(/el=(\d+)/);
            if (!lotRefMatch) continue;
            const lotRef = lotRefMatch[1];

            if (seenLotRefs.has(lotRef)) continue;
            seenLotRefs.add(lotRef);

            const container = findCardContainer(link);
            if (!container) continue;

            const heading = container.querySelector("h2, h3, h4");
            const title = heading ? heading.textContent.trim() : "";
            const img = container.querySelector("img");
            const imageUrl = img ? img.getAttribute("src") || "" : "";
            const lotNumberMatch = container.textContent.match(/lot\s+(\d+)/i);

            foundCards.push({
              title,
              url: href.startsWith("http") ? href : `https://www.vectis.co.uk${href}`,
              imageUrl,
              lotNumber: lotNumberMatch ? lotNumberMatch[1] : "",
              lotRef,
            });
          }
        }
        return foundCards;
      });

      if (pageNum === 1 && cards.length > 0) {
        console.log("First card extracted:", JSON.stringify(cards[0], null, 2));
      }
      console.log(`Page ${pageNum}: found ${cards.length} lot cards`);

      for (const card of cards) {
        // Apply MOC title filter
        if (!shouldKeep(card.title)) {
          filtered++;
          continue;
        }

        // Use pre-extracted lotRef from card
        const lotRef = card.lotRef;

        // Check for duplicate in Supabase
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

        // Random delay before visiting lot page
        await sleep(2000, 4000);
        console.log(`  Visiting: ${card.title.substring(0, 55)}...`);

        try {
          await page.goto(card.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(3000);
        } catch (e) {
          console.warn(`  ⚠ Failed to load: ${e.message}`);
          continue;
        }

        // Extract lot details
        const fullTitle = await page
          .evaluate(() => {
            const h = document.querySelector("h1, h2, .lot-title, [class*='lot-title']");
            return h?.textContent?.trim() || "";
          })
          .catch(() => card.title);

        const conditionNotes = await page
          .evaluate(() => {
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
          })
          .catch(() => "");

        const auctionName = await page
          .evaluate(() => {
            const sel = document.querySelector(
              ".sale-name, .auction-title, [class*='auction'], [class*='sale-info']"
            );
            return sel?.textContent?.trim() || "";
          })
          .catch(() => "");

        // Parse sale date from auction name
        const dateMatch = auctionName.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        const saleDate = dateMatch ? parseDate(dateMatch[1]) : new Date().toISOString().split("T")[0];

        // Parse estimates
        const estimateText = await page
          .evaluate(() => {
            const est = document.querySelector(
              ".estimate, [class*='estimate'], .price-estimate"
            );
            return est?.textContent?.trim() || "";
          })
          .catch(() => "");
        const { low: estimateLowGBP, high: estimateHighGBP } = parseEstimate(estimateText);

        // Get large image URL
        const imageUrls = card.imageUrl
          ? [card.imageUrl.replace("/medium/", "/large/").replace("/thumb/", "/large/")]
          : [];

        // Auto-classify
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
          hammer_price_gbp: null,
          buyers_premium_gbp: null,
          total_paid_gbp: null,
          usd_to_gbp_rate: 1.0,
          image_urls: imageUrls,
          condition_notes: conditionNotes.substring(0, 1000),
          grade_subgrades: extractSubgrades(conditionNotes),
          estimate_low_gbp: estimateLowGBP,
          estimate_high_gbp: estimateHighGBP,
          price_status: "ESTIMATE_ONLY",
        };

        // Discard lots with zero/null estimates (failed page load or non-standard lot)
        if ((!record.estimate_low_gbp || record.estimate_low_gbp === 0) &&
            (!record.estimate_high_gbp || record.estimate_high_gbp === 0)) {
          filtered++;
          console.log(`  ✗ Skipped (no estimate): ${card.title.substring(0, 55)}...`);
          continue;
        }

        const { error } = await supabase.from("lots").insert(record);
        if (error) {
          console.warn(`  ✗ Insert failed: ${error.message}`);
        } else {
          inserted++;
          console.log(`  ✓ Inserted: ${classification.variant_code} | ${lotRef}`);
        }
      }
    }
  } catch (e) {
    console.error("Scraper error:", e);
  } finally {
    await browser.close();
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`COMPLETE`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (duplicates): ${skipped}`);
  console.log(`  Filtered (non-MOC): ${filtered}`);
  console.log(`═══════════════════════════════════════\n`);
  
  return { inserted, skipped, filtered };
}

// Run
scrapeVectis().catch(console.error);

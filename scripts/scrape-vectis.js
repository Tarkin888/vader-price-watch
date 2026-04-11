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
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 * 
 * Usage:
 *   node scrape-vectis.js
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SEARCH_QUERIES = [
  "darth vader kenner",
  "darth vader palitoy",
  "darth vader tri-logo",
  "darth vader carded",
  "darth vader MOC",
  "darth vader 12 back",
  "darth vader 20 back",
  "darth vader 21 back",
  "darth vader 31 back",
  "darth vader 32 back",
  "darth vader 41 back",
  "darth vader 45 back",
  "darth vader 47 back",
  "darth vader 48 back",
  "darth vader 65 back",
  "darth vader 70 back",
  "darth vader 77 back",
  "darth vader 79 back",
  "darth vader 92 back",
  "darth vader POTF",
  "darth vader AFA",
  "darth vader UKG",
  "darth vader CAS",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── MOC Filter ───────────────────────────────────────────────
const CARDBACK_INDICATORS = [
  "carded", "moc", "on card", "mint on card",
  "unpunched", "punched", "cardback", "back card",
  "factory sealed", "bubble",
];
// Also match any "NN back" or "NN-back" pattern (e.g. "12 back", "65-back")
const CARDBACK_BACK_RE = /\d{2}[\s-]?back/i;

const GRADING_INDICATORS_RE = /\b(afa|ukg|cas)\s*\d{2}\b|\b(afa|ukg|cas)\s+graded\b/i;
const GRADING_KEYWORDS = ["afa", "ukg", "cas"];

const MOC_REJECT_PATTERNS = [
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
  "hong kong", "taiwan",
  // New reject patterns
  "figures including", "x three", "x four", "x five", "x six",
  "vader & emperor", "vader & obi-wan",
  "collectors coins", "crystal", "don post", "gentle giant",
  "jumbo", "doll", "roller skate", "bed head",
];
// Reject titles ending with "(N)" — bulk/multi-figure lots
const TRAILING_COUNT_RE = /\(\d+\)\s*$/;

function hasCardbackEvidence(text) {
  const t = text.toLowerCase();
  if (CARDBACK_INDICATORS.some((kw) => t.includes(kw))) return true;
  if (CARDBACK_BACK_RE.test(t)) return true;
  return false;
}

function isMocLot(title, description = "") {
  const combined = `${title} ${description}`.toLowerCase();

  // 1. Must contain "Darth Vader"
  if (!combined.includes("darth vader")) return false;

  // 2. Reject if any exclusion pattern matches
  if (MOC_REJECT_PATTERNS.some((kw) => combined.includes(kw))) return false;

  // 3. Reject trailing "(N)" pattern (bulk lots)
  if (TRAILING_COUNT_RE.test(title.trim())) return false;

  // 4. Graded lots: require cardback evidence, otherwise reject (graded loose)
  const hasGrading = GRADING_KEYWORDS.some((kw) => combined.includes(kw));
  if (hasGrading && !hasCardbackEvidence(combined)) return false;

  // 5. Must have cardback evidence OR grading to qualify as MOC
  if (!hasCardbackEvidence(combined) && !hasGrading) return false;

  return true;
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
  else if (/12[\s-]?(?:figure\s*)?a[\s-]?back|12-?back\s*a|\b12a\b/i.test(text)) cardbackCode = "SW-12A";
  else if (/12[\s-]?(?:figure\s*)?b[\s-]?back|12-?back\s*b|\b12b\b/i.test(text)) cardbackCode = "SW-12B";
  else if (/12[\s-]?(?:figure\s*)?c[\s-]?back|12-?back\s*c|\b12c\b/i.test(text)) cardbackCode = "SW-12C";
  else if (/12[\s-]?back|12[\s-]?figure/i.test(text)) cardbackCode = "SW-12";

  let variantCode = cardbackCode;
  const isDT = /double\s*telescoping|\bdt\b/i.test(text);
  if (isDT) variantCode = cardbackCode + "-DT";
  if (/tri[\s-]?logo|trilogo/i.test(text)) variantCode = "PAL-TL";
  else if (/\bcanadian\b|\bbilingual\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "CAN";
  else if (/\bpalitoy\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "PAL";
  else if (/\bmexico\b|\bmexican\b|\blili\s*ledy\b/i.test(text) && cardbackCode === "UNKNOWN") variantCode = "MEX";
  else if (/vader\s*pointing|alternate\s*photo/i.test(text)) variantCode = "VP";

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

// ─── Phase 1: Collect all lot URLs from all queries ───────────
async function collectLotUrls(page) {
  const allLots = new Map(); // lotRef -> { title, url, imageUrl, lotRef }

  for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
    const query = SEARCH_QUERIES[qi];
    const encoded = query.replace(/ /g, "+");
    const baseUrl = `https://www.vectis.co.uk/catalog?query=${encoded}&timeframe=archived&per_page=96`;

    console.log(`\n── Query ${qi + 1}/${SEARCH_QUERIES.length}: "${query}" ──`);

    await page.goto(`${baseUrl}&page=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent("body");
    const totalMatch = bodyText.match(/showing\s+\d+\s+of\s+([\d,]+)\s+lots/i);
    const totalLots = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : 0;
    const totalPages = Math.max(1, Math.ceil(totalLots / 96));
    console.log(`  Found ${totalLots} results across ${totalPages} pages`);

    if (totalLots === 0) continue;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) {
        await sleep(2000, 4000);
        await page.goto(`${baseUrl}&page=${pageNum}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(3000);
      }

      const cards = await page.evaluate(() => {
        const foundCards = [];
        const seenRefs = new Set();

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

            if (seenRefs.has(lotRef)) continue;
            seenRefs.add(lotRef);

            const container = findCardContainer(link);
            if (!container) continue;

            const heading = container.querySelector("h2, h3, h4");
            const title = heading ? heading.textContent.trim() : "";
            const img = container.querySelector("img");
            const imageUrl = img ? img.getAttribute("src") || "" : "";

            foundCards.push({
              title,
              url: href.startsWith("http") ? href : `https://www.vectis.co.uk${href}`,
              imageUrl,
              lotRef,
            });
          }
        }
        return foundCards;
      });

      for (const card of cards) {
        if (!allLots.has(card.lotRef)) {
          allLots.set(card.lotRef, card);
        }
      }

      console.log(`  Page ${pageNum}/${totalPages}: ${cards.length} cards (unique total: ${allLots.size})`);
    }
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`Total unique lot URLs discovered: ${allLots.size}`);
  console.log(`══════════════════════════════════════════\n`);

  return Array.from(allLots.values());
}

// ─── Phase 2: Visit each unique lot and process ───────────────
async function processLots(page, lots, stats) {
  for (const card of lots) {
    // Apply MOC title filter
    if (!isMocLot(card.title)) {
      stats.filtered++;
      continue;
    }

    const lotRef = card.lotRef;

    // Check for duplicate in Supabase
    const { data: existing } = await supabase
      .from("lots")
      .select("id")
      .eq("lot_ref", lotRef)
      .eq("source", "Vectis")
      .limit(1);

    if (existing && existing.length > 0) {
      stats.skipped++;
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

        const allP = Array.from(document.querySelectorAll("p"));
        for (const p of allP) {
          const raw = p.textContent?.trim() || "";
          const text = stripDisclaimer(raw);
          if (text.length < 40) continue;
          const lower = text.toLowerCase();
          if (REJECT.some((r) => lower.includes(r))) continue;
          if (/^(kenner|palitoy|star wars)/i.test(text)) return text;
        }

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

    const dateMatch = auctionName.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    const saleDate = dateMatch ? parseDate(dateMatch[1]) : new Date().toISOString().split("T")[0];

    const estimateText = await page
      .evaluate(() => {
        const est = document.querySelector(
          ".estimate, [class*='estimate'], .price-estimate"
        );
        return est?.textContent?.trim() || "";
      })
      .catch(() => "");
    const { low: estimateLowGBP, high: estimateHighGBP } = parseEstimate(estimateText);

    const imageUrls = card.imageUrl
      ? [card.imageUrl.replace("/medium/", "/large/").replace("/thumb/", "/large/")]
      : [];

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

    if ((!record.estimate_low_gbp || record.estimate_low_gbp === 0) &&
        (!record.estimate_high_gbp || record.estimate_high_gbp === 0)) {
      stats.filtered++;
      console.log(`  ✗ Skipped (no estimate): ${card.title.substring(0, 55)}...`);
      continue;
    }

    const { error } = await supabase.from("lots").insert(record);
    if (error) {
      console.warn(`  ✗ Insert failed: ${error.message}`);
    } else {
      stats.inserted++;
      console.log(`  ✓ Inserted: ${classification.variant_code} | ${lotRef}`);
    }
  }
}

// ─── Main scraper ──────────────────────────────────────────────
async function scrapeVectis() {
  console.log("Starting Vectis scraper...\n");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const stats = { inserted: 0, skipped: 0, filtered: 0 };

  try {
    // Phase 1: Collect all unique lot URLs
    const uniqueLots = await collectLotUrls(page);

    // Phase 2: Visit and process each lot
    console.log(`Processing ${uniqueLots.length} unique lots...\n`);
    await processLots(page, uniqueLots, stats);
  } catch (e) {
    console.error("Scraper error:", e);
  } finally {
    await browser.close();
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`COMPLETE`);
  console.log(`  Inserted: ${stats.inserted}`);
  console.log(`  Skipped (duplicates): ${stats.skipped}`);
  console.log(`  Filtered (non-MOC): ${stats.filtered}`);
  console.log(`═══════════════════════════════════════\n`);
  
  return stats;
}

// Run
scrapeVectis().catch(console.error);

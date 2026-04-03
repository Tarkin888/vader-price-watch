/**
 * C&T Auctions Scraper
 *
 * Dynamically discovers relevant catalogue IDs from the auction listing pages
 * at bid.candtauctions.co.uk, then searches each catalogue for Darth Vader
 * MOC lots, extracting prices, images, and condition notes.
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
 *   node scripts/scrape-candt.js
 */

const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
require("dotenv/config");

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = "https://bid.candtauctions.co.uk";
const BUYER_PREMIUM_RATE = 0.264; // 22% + 20% VAT on premium

// Hardcoded fallback catalogue IDs (known Star Wars / toy auctions)
const FALLBACK_CATALOGUE_IDS = [205, 199, 216, 215, 210, 206, 200, 188, 183, 178, 170, 159, 144, 134, 129, 122, 118, 116, 115, 107];

// Title patterns to match relevant catalogues
const RELEVANT_TITLE_RE = /star\s*wars|collectib?le\s*toy|vintage.*toy|toy.*collectib|retro.*toy|tv.*film.*toy/i;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── MOC Filter (mirrors Vectis scraper) ──────────────────────
const CARDBACK_INDICATORS = [
  "carded", "moc", "on card", "mint on card",
  "unpunched", "punched", "cardback", "back card",
  "factory sealed", "bubble",
];
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
  "figures including", "x three", "x four", "x five", "x six",
  "vader & emperor", "vader & obi-wan",
  "collectors coins", "crystal", "don post", "gentle giant",
  "jumbo", "doll", "roller skate", "bed head",
];
const TRAILING_COUNT_RE = /\(\d+\)\s*$/;

function hasCardbackEvidence(text) {
  const t = text.toLowerCase();
  if (CARDBACK_INDICATORS.some((kw) => t.includes(kw))) return true;
  if (CARDBACK_BACK_RE.test(t)) return true;
  return false;
}

function isMocLot(title, description = "") {
  const combined = `${title} ${description}`.toLowerCase();
  if (!combined.includes("darth vader")) return false;
  if (MOC_REJECT_PATTERNS.some((kw) => combined.includes(kw))) return false;
  if (TRAILING_COUNT_RE.test(title.trim())) return false;
  const hasGrading = GRADING_KEYWORDS.some((kw) => combined.includes(kw));
  if (hasGrading && !hasCardbackEvidence(combined)) return false;
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
  else if (/\bmoc\b|carded|unpunched|sealed/i.test(text)) gradeTierCode = "RAW-NM";
  else if (/mint|near[\s-]?mint|\bnm\b|excellent\s*plus/i.test(text)) gradeTierCode = "RAW-NM";
  else if (/excellent|good\s*plus|vg\+|very\s*good\s*plus/i.test(text)) gradeTierCode = "RAW-EX";
  else if (/good|fair|poor|playworn|damaged|crushed/i.test(text) && !/good\s*plus|good\s*condition\s*overall/i.test(text)) gradeTierCode = "RAW-VG";
  else if (/\bafa\b|\bgraded\b/i.test(text)) gradeTierCode = "GRADED-UNKNOWN";

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

function extractSubgrades(text) {
  const patterns = [
    /card\s*\d+\s*bubble\s*\d+\s*figure\s*\d+/i,
    /figure\s*\d+\s*paint\s*\d+\s*cape\s*\d+/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return "";
}

// ─── Phase 1: Discover catalogue IDs ──────────────────────────
async function discoverCatalogueIds(page) {
  const discovered = new Map(); // id -> title
  const auctionListUrl = `${BASE}/auctions`;

  for (let pageNum = 1; pageNum <= 3; pageNum++) {
    const url = pageNum === 1 ? auctionListUrl : `${auctionListUrl}?page=${pageNum}`;
    console.log(`\n── Scanning auction list page ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      console.warn(`  ⚠ Failed to load auction list page ${pageNum}: ${e.message}`);
      continue;
    }

    const auctions = await page.evaluate(() => {
      const results = [];
      // Find all auction entries — they have info links with /id/ pattern
      const links = document.querySelectorAll('a[href*="/auctions/info/id/"]');
      const seen = new Set();

      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const idMatch = href.match(/\/id\/(\d+)/);
        if (!idMatch) continue;
        const id = parseInt(idMatch[1], 10);
        if (seen.has(id)) continue;
        seen.add(id);

        // Find the title — walk up to find the container with h6 or img alt
        let container = link.closest("li") || link.parentElement;
        let title = "";
        if (container) {
          const h6 = container.querySelector("h6");
          if (h6) title = h6.textContent?.trim() || "";
          if (!title) {
            const img = container.querySelector("img");
            if (img) title = img.getAttribute("alt") || "";
          }
        }
        if (!title) title = link.textContent?.trim() || "";

        // Check if auction is closed
        const text = container?.textContent || "";
        const isClosed = /auction\s*closed|closed/i.test(text);

        results.push({ id, title, isClosed });
      }
      return results;
    });

    for (const a of auctions) {
      if (!discovered.has(a.id)) {
        discovered.set(a.id, a);
      }
    }

    console.log(`  Found ${auctions.length} auctions on page ${pageNum}`);
  }

  // Filter to relevant catalogues (Star Wars, Collectible Toys, etc.)
  const relevant = [];
  for (const [id, auction] of discovered) {
    if (RELEVANT_TITLE_RE.test(auction.title)) {
      relevant.push(id);
      console.log(`  ✓ Relevant: [${id}] ${auction.title}${auction.isClosed ? " (closed)" : ""}`);
    }
  }

  // Merge with fallback IDs
  const fallbackSet = new Set(FALLBACK_CATALOGUE_IDS);
  const merged = new Set([...relevant, ...FALLBACK_CATALOGUE_IDS]);
  const newlyDiscovered = relevant.filter((id) => !fallbackSet.has(id));

  console.log(`\n══════════════════════════════════════════`);
  console.log(`Discovered ${relevant.length} relevant catalogues`);
  console.log(`Fallback baseline: ${FALLBACK_CATALOGUE_IDS.length} catalogues`);
  console.log(`Newly discovered: ${newlyDiscovered.length} (${newlyDiscovered.join(", ")})`);
  console.log(`Total unique catalogues to scrape: ${merged.size}`);
  console.log(`══════════════════════════════════════════\n`);

  return [...merged].sort((a, b) => b - a); // newest first
}

// ─── Phase 2: Scrape lots from a single catalogue ─────────────
async function scrapeCatalogue(page, catalogueId, stats) {
  const searchUrl = `${BASE}/auctions/catalog/id/${catalogueId}?q=darth+vader`;
  console.log(`\n── Catalogue ${catalogueId}: ${searchUrl}`);

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.warn(`  ⚠ Failed to load catalogue ${catalogueId}: ${e.message}`);
    return;
  }

  // Extract auction date from header
  const auctionDate = await page.evaluate(() => {
    const header = document.querySelector("h3, .auction-header, [class*='auction']");
    const text = header?.textContent || "";
    // Format: "07/05/25 10:30 AM" or "07/05/2025"
    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (dateMatch) {
      const day = dateMatch[1];
      const month = dateMatch[2];
      let year = dateMatch[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
    return null;
  }).catch(() => null);

  const saleDate = auctionDate || new Date().toISOString().split("T")[0];
  console.log(`  Sale date: ${saleDate}`);

  // Paginate through all search results
  let pageNum = 1;
  let hasMore = true;

  while (hasMore) {
    if (pageNum > 1) {
      const pageUrl = `${BASE}/auctions/catalog/id/${catalogueId}?q=darth+vader&page=${pageNum}`;
      try {
        await sleep(1500, 3000);
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        console.warn(`  ⚠ Failed to load page ${pageNum}: ${e.message}`);
        break;
      }
    }

    // Extract lots from current page
    const lots = await page.evaluate((base) => {
      const results = [];
      // Each lot is in a list item with an image and h2 title
      const lotLinks = document.querySelectorAll('a[href*="/lot-details/"]');
      const seen = new Set();

      for (const link of lotLinks) {
        const href = link.getAttribute("href") || "";
        // Extract lot ID from URL: /lot-details/index/catalog/205/lot/66892/...
        const lotMatch = href.match(/\/lot\/(\d+)\//);
        if (!lotMatch) continue;
        const lotRef = lotMatch[1];
        if (seen.has(lotRef)) continue;
        seen.add(lotRef);

        // Find the container
        const container = link.closest("li") || link.parentElement?.parentElement;
        if (!container) continue;

        // Title from h2
        const h2 = container.querySelector("h2");
        const title = h2?.textContent?.trim() || link.textContent?.trim() || "";

        // Image — get the _m.jpg from the img tag
        const img = container.querySelector("img[src*='/images/lot/']");
        let imageUrl = "";
        if (img) {
          imageUrl = img.getAttribute("src") || "";
          // Ensure absolute URL
          if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = base + imageUrl;
          }
        }

        // Winning bid
        let winningBid = null;
        const bidEl = container.querySelector("li");
        const allLis = container.querySelectorAll("li");
        for (const li of allLis) {
          const t = li.textContent || "";
          const bidMatch = t.match(/Winning\s*Bid\s*£([\d,]+(?:\.\d+)?)/i);
          if (bidMatch) {
            winningBid = parseFloat(bidMatch[1].replace(/,/g, ""));
            break;
          }
        }

        // Estimate
        let estimateLow = null;
        let estimateHigh = null;
        for (const li of allLis) {
          const t = li.textContent || "";
          const estMatch = t.match(/Estimate\s*£([\d,]+)\s*-\s*£([\d,]+)/i);
          if (estMatch) {
            estimateLow = parseFloat(estMatch[1].replace(/,/g, ""));
            estimateHigh = parseFloat(estMatch[2].replace(/,/g, ""));
            break;
          }
        }

        // Status
        let status = "";
        for (const li of allLis) {
          const t = li.textContent || "";
          if (/Status/i.test(t)) {
            status = t.replace(/Status/i, "").trim();
            break;
          }
        }

        // Lot URL
        const lotUrl = href.startsWith("http") ? href : base + href;
        // Strip the ?url= query param for cleaner URLs
        const cleanUrl = lotUrl.split("?url=")[0];

        results.push({
          lotRef,
          title,
          imageUrl,
          winningBid,
          estimateLow,
          estimateHigh,
          status,
          lotUrl: cleanUrl,
        });
      }
      return results;
    }, BASE);

    console.log(`  Page ${pageNum}: ${lots.length} lots found`);

    if (lots.length === 0) {
      hasMore = false;
      break;
    }

    // Process each lot
    for (const lot of lots) {
      // Log first image URL per lot for verification
      if (lot.imageUrl) {
        console.log(`  📸 First image: ${lot.imageUrl}`);
      }

      // MOC filter
      if (!isMocLot(lot.title)) {
        stats.filtered++;
        continue;
      }

      // Skip unsold lots
      if (lot.status && /unsold|passed|withdrawn/i.test(lot.status)) {
        stats.filtered++;
        continue;
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from("lots")
        .select("id")
        .eq("lot_ref", lot.lotRef)
        .eq("source", "CandT")
        .limit(1);

      if (existing && existing.length > 0) {
        stats.skipped++;
        continue;
      }

      // Visit lot detail page for condition notes and better images
      let conditionNotes = "";
      let detailImages = [];

      try {
        await sleep(1500, 3000);
        await page.goto(lot.lotUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1000);

        let detail = null;
        try {
          detail = await page.evaluate((base) => {
            // Extract condition text — look for description paragraphs
            let notes = "";
            const paras = document.querySelectorAll("p, .description, [class*='description']");
            for (const p of paras) {
              const text = p.textContent?.trim() || "";
              if (text.length < 20) continue;
              const lower = text.toLowerCase();
              // Skip boilerplate
              if (/cookies|payment|buyer.*premium|privacy|terms|bidding/i.test(lower)) continue;
              if (/endeavoured|sold as is/i.test(lower)) continue;
              if (text.length > notes.length) notes = text;
            }

            // Extract lot images — only actual lot photos
            const images = [];
            const imgEls = document.querySelectorAll('img[src*="/images/lot/"]');
            for (const img of imgEls) {
              let src = img.getAttribute("src") || "";
              if (!src || /spinner|settings/i.test(src)) continue;
              if (!src.startsWith("http")) src = base + src;
              // Prefer large versions
              src = src.replace(/_s\.jpg/, "_l.jpg").replace(/_m\.jpg/, "_l.jpg");
              if (!images.includes(src)) images.push(src);
            }

            // Also check linked images (xl versions)
            const imgLinks = document.querySelectorAll('a[href*="/images/lot/"]');
            for (const link of imgLinks) {
              let href = link.getAttribute("href") || "";
              if (!href.startsWith("http")) href = base + href;
              if (/_xl\.jpg/.test(href) && !images.includes(href)) {
                images.unshift(href); // xl goes first
              }
            }

            return { notes, images };
          }, BASE);
        } catch (evalErr) {
          const msg = evalErr.message || "";
          if (/execution context was destroyed|navigating/i.test(msg)) {
            console.warn(`    ⚠ Context destroyed for lot ${lot.lotRef}, skipping detail extraction`);
          } else {
            console.warn(`    ⚠ Evaluate failed for lot ${lot.lotRef}: ${msg}`);
          }
        }

        if (detail) {
          conditionNotes = detail.notes;
          detailImages = detail.images;
        }
      } catch (e) {
        console.warn(`    ⚠ Failed to load detail page for lot ${lot.lotRef}: ${e.message}`);
      }

      // Navigate back to search results
      const searchPageUrl = `${BASE}/auctions/catalog/id/${catalogueId}?q=darth+vader&page=${pageNum}`;
      try {
        await page.goto(searchPageUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        // If we can't get back, just continue — worst case we re-scrape from top
      }

      // Build image array — prefer detail page images, fallback to listing image
      let imageUrls = detailImages.length > 0 ? detailImages : [];
      if (imageUrls.length === 0 && lot.imageUrl) {
        // Convert _m.jpg to _l.jpg for better quality
        const largeUrl = lot.imageUrl.replace(/_m\.jpg/, "_l.jpg");
        imageUrls = [largeUrl];
      }
      // Filter out junk images
      imageUrls = imageUrls.filter(
        (u) => /images\/lot\//i.test(u) && !/spinner|settings|data:image/i.test(u)
      );

      const classification = classifyLot(lot.title, conditionNotes);

      // Calculate prices
      const hammerPrice = lot.winningBid || null;
      const buyersPremium = hammerPrice ? Math.round(hammerPrice * BUYER_PREMIUM_RATE * 100) / 100 : null;
      const totalPaid = hammerPrice ? Math.round((hammerPrice + buyersPremium) * 100) / 100 : null;

      const record = {
        capture_date: new Date().toISOString().split("T")[0],
        sale_date: saleDate,
        source: "CandT",
        lot_ref: lot.lotRef,
        lot_url: lot.lotUrl,
        variant_code: classification.variant_code,
        grade_tier_code: classification.grade_tier_code,
        era: classification.era,
        cardback_code: classification.cardback_code,
        hammer_price_gbp: hammerPrice,
        buyers_premium_gbp: buyersPremium,
        total_paid_gbp: totalPaid,
        usd_to_gbp_rate: 1.0,
        image_urls: imageUrls,
        condition_notes: conditionNotes.substring(0, 1000),
        grade_subgrades: extractSubgrades(conditionNotes),
        estimate_low_gbp: lot.estimateLow,
        estimate_high_gbp: lot.estimateHigh,
        price_status: hammerPrice ? "SOLD" : "ESTIMATE_ONLY",
      };

      const { error } = await supabase.from("lots").insert(record);
      if (error) {
        console.warn(`  ✗ Insert failed for lot ${lot.lotRef}: ${error.message}`);
      } else {
        stats.inserted++;
        console.log(`  ✓ Inserted: ${classification.variant_code} | ${lot.lotRef} | ${lot.title.substring(0, 50)}... | £${totalPaid || "N/A"}`);
      }
    }

    // Check if there's a next page
    const nextExists = await page.evaluate(() => {
      const nextLink = document.querySelector('a[href*="page="]');
      const allLinks = document.querySelectorAll('a');
      for (const a of allLinks) {
        if (a.textContent?.trim() === "Next") return true;
      }
      return false;
    }).catch(() => false);

    if (nextExists && lots.length >= 10) {
      pageNum++;
    } else {
      hasMore = false;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function scrapeCandT() {
  console.log("Starting C&T Auctions scraper...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const stats = { inserted: 0, skipped: 0, filtered: 0 };

  try {
    // Phase 1: Discover catalogue IDs
    const catalogueIds = await discoverCatalogueIds(page);

    // Phase 2: Scrape each catalogue
    for (const catId of catalogueIds) {
      await scrapeCatalogue(page, catId, stats);
      await sleep(2000, 4000); // Polite delay between catalogues
    }
  } catch (e) {
    console.error("Scraper error:", e);
  } finally {
    await browser.close();
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`C&T SCRAPE COMPLETE`);
  console.log(`  Inserted: ${stats.inserted}`);
  console.log(`  Skipped (duplicates): ${stats.skipped}`);
  console.log(`  Filtered (non-MOC / unsold): ${stats.filtered}`);
  console.log(`═══════════════════════════════════════\n`);

  return stats;
}

// Run
scrapeCandT().catch(console.error);

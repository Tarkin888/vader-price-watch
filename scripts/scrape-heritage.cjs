/**
 * scrape-heritage.cjs — Heritage Auctions scraper v3.7
 * Imperial Price Terminal — Kenner Darth Vader MOC
 *
 * Changes in v3.7:
 *   - BUG FIX (MOC filter): HERITAGE_CARDBACK_PATTERN now accepts a space as
 *     the separator between the number and "back" (e.g. "21 Back", "65 Back").
 *     v3.6 only matched hyphen/dot ("21-back"), causing ~4 valid Vader MOC lots
 *     per run to be silently rejected.
 *   - BUG FIX (search queries): Removed "+moc" from the 5 queries that were
 *     returning 0 results. Heritage does not index "MOC" as a title keyword.
 *     This restores coverage for SW-12-back, SW-20-back, ESB broad, ROTJ broad,
 *     and Palitoy/Tri-logo lots — which were completely absent from every scrape.
 *   - BUG FIX (network recovery): Added safeGoto() helper that catches
 *     ERR_NETWORK_IO_SUSPENDED and timeout errors, closes the stale page, opens
 *     a fresh one from the same context, and retries (up to 2 attempts with a
 *     30 s gap). Also added a 45 s cooling pause after every 10 lots to reduce
 *     Heritage's anti-bot throttling.
 *   - BUG FIX (images): Added networkidle wait + broad fallback img scan before
 *     giving up. Also logs the raw og:image URL found so allowlist misses are
 *     visible in the console output.
 *
 * Changes in v3.6 (retained):
 *   - IMAGE FIX: Switched from junk-blocklist to Heritage CDN allowlist.
 *     Only accepts images from ha.com/s.ha.com image domains.
 *     Profile pictures come from a generic CDN and were bypassing the blocklist.
 *   - MOC FILTER FIX: Heritage titles for graded carded figures never say
 *     "MOC" or "carded" — they say e.g. "Darth Vader 77-Back A AFA Y75+".
 *     Added Heritage-specific MOC detection: Darth Vader + cardback number
 *     + grade keyword = treat as MOC regardless of missing "carded" keyword.
 *
 * Changes in v3.5 (anti-detection, retained):
 *   - Stealth browser args, navigator.webdriver suppressed
 *   - Random delays 10–20s between queries, 5–12s between lot pages
 *   - Randomised user agent pool
 *   - Human-like mouse movement
 *   - 12 queries (reduced from 22)
 *   - Block detection with auto-wait and graceful stop
 *
 * Changes in v3.4 (image fix, superseded by v3.6 allowlist approach):
 *   - og:image meta tag extraction
 *
 * Retained from v3.3:
 *   - Manual login flow (headless: false)
 *   - OneTrust cookie auto-dismiss
 *   - Auth-wall detection
 *   - $50 price floor
 *   - BP back-calculation: hammer = displayed_total / 1.20
 *   - lotRef dedup: auctionNo-lotNo + tracking-param stripping
 *   - USD to GBP at 0.79
 */

'use strict';

require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ─── Supabase ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Constants ───────────────────────────────────────────────────────────────

const USD_TO_GBP  = 0.79;
const BP_RATE     = 1.20;
const PRICE_FLOOR = 50;
const SOURCE      = 'Heritage';

// ─── Anti-detection helpers ───────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function humanMove(page) {
  try {
    const x = 200 + Math.floor(Math.random() * 600);
    const y = 200 + Math.floor(Math.random() * 400);
    await page.mouse.move(x, y, { steps: 5 });
  } catch (_) {}
}

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1366,768',
];

// ─── Search queries ───────────────────────────────────────────────────────────

// NOTE: Do NOT add "+moc" to any query — Heritage does not index that keyword.
// The per-lot isMOC() filter handles non-carded items during scraping.
const SEARCH_QUERIES = [
  'darth+vader+12+back+kenner',          // was +moc — returned 0; now unlocks SW-12A/B/C/DT
  'darth+vader+20+back+kenner',          // was +moc — returned 0; now unlocks SW-20
  'darth+vader+21+back+kenner',
  'darth+vader+esb+kenner',              // was +moc — returned 0; broad ESB sweep
  'darth+vader+41+back+kenner',
  'darth+vader+47+back+kenner',
  'darth+vader+rotj+kenner',             // was +moc — returned 0; broad ROTJ sweep
  'darth+vader+65+back+kenner',
  'darth+vader+77+back+kenner',
  'darth+vader+79+back+kenner',
  'darth+vader+potf+92+back+kenner',
  'darth+vader+palitoy+tri-logo',        // was +moc — returned 0; now unlocks PAL-TL
];

// ─── Image extraction — ALLOWLIST approach (v3.6) ─────────────────────────────
//
// Previous approach: blocklist junk URLs (profile/avatar/user etc.)
// Problem: Heritage profile pictures are served from a generic CDN path
//          that doesn't contain those keywords, so they bypassed the filter.
//
// New approach: ONLY accept URLs from Heritage's known image CDN domains.
// Heritage lot images are served from:
//   - s.ha.com (primary image CDN)
//   - media.ha.com
//   - img.ha.com
//   - ha.com/dam/ paths
//   - ha.com/haimage/
// Profile pictures / site chrome come from different CDN paths.

const HERITAGE_IMAGE_CDN = [
  /^https?:\/\/s\.ha\.com\//i,
  /^https?:\/\/media\.ha\.com\//i,
  /^https?:\/\/img\.ha\.com\//i,
  /ha\.com\/dam\//i,
  /ha\.com\/haimage\//i,
  /ha\.com\/images\/lot\//i,
  /ha\.com\/.*\.(jpg|jpeg|png|webp)/i,
];

function isHeritageLotImage(url) {
  if (!url || !url.startsWith('http')) return false;
  return HERITAGE_IMAGE_CDN.some((p) => p.test(url));
}

async function extractImage(page) {
  // Wait for page to settle so lazy-loaded images have a chance to appear
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch (_) {}

  // Primary: og:image — server-side meta tag, present even before full JS render
  try {
    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content')
    );
    if (ogImage) {
      // Debug: log raw URL so we can spot allowlist mismatches in the console
      if (!isHeritageLotImage(ogImage)) {
        console.log(`    [img-debug] og:image found but blocked by allowlist: ${ogImage.substring(0, 80)}`);
      } else {
        return [ogImage];
      }
    }
  } catch (_) {}

  // Secondary: Twitter card image (also set server-side)
  try {
    const twitterImage = await page.$eval(
      'meta[name="twitter:image"], meta[property="twitter:image"]',
      (el) => el.getAttribute('content')
    );
    if (twitterImage && isHeritageLotImage(twitterImage)) return [twitterImage];
  } catch (_) {}

  // Tertiary: lot-specific img elements (targeted selectors)
  try {
    const imgs = await page.$$eval(
      'img.lot-image, img[itemprop="image"], .lot-main-image img, .item-image img',
      (els) => els.map((el) => el.src).filter(Boolean)
    );
    const clean = imgs.filter((u) => isHeritageLotImage(u));
    if (clean.length > 0) return [clean[0]];
  } catch (_) {}

  // Quaternary: broad scan of ALL img elements — catches any ha.com image
  try {
    const allImgs = await page.$$eval('img', (els) =>
      els.map((el) => el.src || el.getAttribute('data-src') || '').filter(Boolean)
    );
    const clean = allImgs.filter((u) => isHeritageLotImage(u));
    if (clean.length > 0) {
      console.log(`    [img-debug] Found via broad scan: ${clean[0].substring(0, 80)}`);
      return [clean[0]];
    }
    // Nothing passed allowlist — log a sample so we can diagnose
    if (allImgs.length > 0) {
      console.log(`    [img-debug] ${allImgs.length} img(s) on page, none passed allowlist. Sample: ${allImgs[0].substring(0, 80)}`);
    }
  } catch (_) {}

  // Nothing usable — return empty rather than storing anything wrong
  return [];
}

// ─── MOC filter (v3.6 — Heritage-specific override) ──────────────────────────
//
// Heritage titles for graded carded figures do NOT say "MOC" or "carded".
// A typical Heritage title is: "Star Wars ROTJ Darth Vader 77-Back A AFA Y75+"
// The MOC signal must be inferred from: Darth Vader + cardback number + grade.
//
// Logic:
// 1. Run reject patterns first (same as before).
// 2. If not rejected: check standard MOC signals (moc/carded/unpunched/on card).
// 3. If no standard signal found: check Heritage-specific pattern —
//    title contains "Darth Vader" AND a cardback back-number AND a grade code.
//    If all three present, treat as MOC.

const REJECT_PATTERNS = [
  /loose/i, /collector'?s? case/i, /carrying case/i, /playset/i,
  /vehicle/i, /job lot/i, /bulk lot/i, /baggie/i, /mail.?away/i,
  /die.?cast/i, /12.?inch/i, /large size/i, /model kit/i,
  /proof card/i, /proof sheet/i, /pre.?production/i, /prototype/i,
  /first shot/i, /hardcopy/i, /revenge of the jedi/i,
  /helmet/i, /mask/i, /costume/i, /poster/i, /comic/i,
  /lunch.?box/i, /potf ii/i, /star destroyer/i, /tie fighter/i,
  /slave i\b/i, /death star/i, /x.?wing/i, /at.?at/i,
  /one sheet/i, /three sheet/i, /20th century fox/i,
  /trading card/i, /topps/i, /wonder bread/i, /statue/i, /bust/i,
  /artfx/i, /force fx/i, /lot of \d/i, /4.?pack/i,
  /department store/i, /screenplay/i, /acetate/i, /video poster/i,
  /inflatable/i, /bop bag/i, /utility belt/i, /roleplay/i,
  /box flat/i, /transparency/i, /pair of/i, /mailer box/i,
  /baggies/i, /7".?tall/i, /15".?tall/i, /15 inch/i,
  // Multi-figure lots — Vader appears alongside other figures
  /darth vader [&,]|[&,] darth vader/i,
  /lot of \d+ figures/i,
];

const MOC_SIGNALS = [/\bmoc\b/i, /\bcarded\b/i, /unpunched/i, /on.?card/i, /mint.?on/i];

// Heritage-specific: Vader + back-number + grade = carded figure
// Pattern accepts space, hyphen, or dot as separator (e.g. "21 Back", "77-Back", "12.back")
// v3.6 only matched hyphen/dot — "21 Back A AFA 70" (space) was silently rejected.
const HERITAGE_CARDBACK_PATTERN = /\d{2}[\s.-]back|\d{2}b\b/i;
const HERITAGE_GRADE_PATTERN     = /\bafa\b|\bukg\b|\bcas\b|\bgrade\b/i;

function isMOC(title) {
  // Step 1: Hard reject
  if (REJECT_PATTERNS.some((p) => p.test(title))) return false;

  // Step 2: Standard MOC signals
  if (MOC_SIGNALS.some((p) => p.test(title))) return true;

  // Step 3: Heritage-specific inference
  // e.g. "Star Wars ROTJ Darth Vader 77-Back A AFA Y75+ (Kenner, 1984)"
  const hasDarthVader  = /darth.?vader/i.test(title);
  const hasCardback    = HERITAGE_CARDBACK_PATTERN.test(title);
  const hasGrade       = HERITAGE_GRADE_PATTERN.test(title);

  if (hasDarthVader && hasCardback && hasGrade) return true;

  // Step 4: Vader + cardback but no grade (raw carded)
  // e.g. "Star Wars Darth Vader 12-Back A (Kenner, 1978)"
  if (hasDarthVader && hasCardback) return true;

  return false;
}

// ─── Price extraction ─────────────────────────────────────────────────────────

async function extractPrice(page) {
  try {
    const raw = await page.$eval('span.opening-bid.bot-price-data', (el) => el.textContent.trim());
    const val = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (val >= PRICE_FLOOR) return val;
  } catch (_) {}

  try {
    const raw = await page.$eval('span.price-data', (el) => el.textContent.trim());
    const val = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (val >= PRICE_FLOOR) return val;
  } catch (_) {}

  try {
    const bodyText = await page.textContent('body');
    const match = bodyText.match(/sold\s+on\s+.+?for\s*:\s*\$([0-9,]+(?:\.[0-9]{2})?)/i);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (val >= PRICE_FLOOR) return val;
    }
  } catch (_) {}

  return null;
}

// ─── Classification ───────────────────────────────────────────────────────────

function classifyEra(text) {
  const t = text.toLowerCase();
  if (/power of the force|potf|92.?back/.test(t)) return 'POTF';
  if (/return of the jedi|rotj/.test(t))           return 'ROTJ';
  if (/empire strikes back|esb/.test(t))           return 'ESB';
  if (/star wars|sw/.test(t))                      return 'SW';
  return 'UNKNOWN';
}

function classifyCardback(text, era) {
  const t = text.toLowerCase();
  if (/92.?back|potf/.test(t))     return 'POTF-92';
  if (/79.?back/.test(t))           return 'ROTJ-79';
  if (/77.?back/.test(t))           return 'ROTJ-77';
  if (/70.?back|tri.?logo/.test(t)) return 'ROTJ-70';
  if (/65.?back/.test(t))           return 'ROTJ-65';
  if (/48.?back/.test(t))           return era === 'ROTJ' ? 'ROTJ-48' : 'ESB-48';
  if (/47.?back/.test(t))           return 'ESB-47';
  if (/45.?back/.test(t))           return 'ESB-45';
  if (/41.?back/.test(t))           return 'ESB-41';
  if (/32.?back/.test(t))           return 'ESB-32';
  if (/31.?back/.test(t))           return 'ESB-31';
  if (/21.?back/.test(t))           return 'SW-21';
  if (/20.?back/.test(t))           return 'SW-20';
  if (/12.?back.?a|12a/.test(t))   return 'SW-12A';
  if (/12.?back.?b|12b/.test(t))   return 'SW-12B';
  if (/12.?back.?c|12c/.test(t))   return 'SW-12C';
  if (/12.?back/.test(t))           return 'SW-12';
  return 'UNKNOWN';
}

function classifyVariant(text, cardbackCode) {
  const t = text.toLowerCase();
  if (/tri.?logo|trilogo/.test(t))                      return 'PAL-TL';
  if (/canadian|bilingual|canada/.test(t))               return 'CAN';
  if (/palitoy/.test(t))                                 return 'PAL';
  if (/mexico|mexican|lili.?ledy/.test(t))               return 'MEX';
  if (/vader.?point|pointing|alternate.?photo/.test(t))  return 'VP';
  if (/popy/.test(t))                                    return 'POPY';
  if (/takara/.test(t))                                  return 'TAK';
  if (/harbert/.test(t))                                 return 'HAR';
  if (/meccano|miro/.test(t))                            return 'MMF';
  if (/clipper/.test(t))                                 return 'CLIP';
  if (/top.?toys/.test(t))                               return 'TT';
  if (/pbp/.test(t))                                     return 'PBP';
  if (/double.?telesc|[^a-z]dt[^a-z]/.test(t))          return cardbackCode + '-DT';
  return cardbackCode;
}

function classifyGrade(text) {
  const t = text.toUpperCase();
  if (/AFA\s*Y?\s*90\+|AFA\s*Y?\s*9[05]\b/.test(t)) return 'AFA-90+';
  if (/AFA\s*Y?\s*85/.test(t))  return 'AFA-85';
  if (/AFA\s*Y?\s*80/.test(t))  return 'AFA-80';
  if (/AFA\s*Y?\s*75/.test(t))  return 'AFA-75';
  if (/AFA\s*Y?\s*70/.test(t))  return 'AFA-70';
  if (/AFA\s*Y?\s*60/.test(t))  return 'AFA-60';
  if (/AFA\s*Y?\s*50/.test(t))  return 'AFA-50';
  if (/AFA\s*Y?\s*40/.test(t))  return 'AFA-40';
  if (/CAS\s*85/.test(t))        return 'CAS-85';
  if (/CAS\s*80/.test(t))        return 'CAS-80';
  if (/CAS\s*75/.test(t))        return 'CAS-75';
  if (/CAS\s*70/.test(t))        return 'CAS-70';
  if (/UKG\s*85/.test(t))        return 'UKG-85';
  if (/UKG\s*80/.test(t))        return 'UKG-80';
  if (/UKG\s*75/.test(t))        return 'UKG-75';
  if (/GRADED/.test(t))           return 'GRADED-UNKNOWN';
  if (/MOC|CARDED|UNPUNCHED/.test(t)) return 'RAW-NM';
  return 'UNKNOWN';
}

// ─── Network recovery ─────────────────────────────────────────────────────────
//
// Heritage throttles sessions after sustained activity.  When we see a timeout
// or ERR_NETWORK_IO_SUSPENDED we close the stale page, open a fresh one from
// the same browser context (same cookies / session), wait 30 s, and retry.
// Up to MAX_GOTO_RETRIES attempts before giving up on that lot.

const MAX_GOTO_RETRIES = 2;
const NETWORK_RECOVERY_WAIT_MS = 30000;

async function safeGoto(context, pageRef, url, options = {}) {
  // pageRef is an object { page } so callers get the (possibly replaced) page back
  let lastErr;
  for (let attempt = 1; attempt <= MAX_GOTO_RETRIES; attempt++) {
    try {
      await pageRef.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000, ...options });
      return; // success
    } catch (err) {
      lastErr = err;
      const isNetworkErr = /ERR_NETWORK_IO_SUSPENDED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_RESET/i.test(err.message);
      const isTimeout    = /timeout/i.test(err.message);
      if ((isNetworkErr || isTimeout) && attempt < MAX_GOTO_RETRIES) {
        console.log(`    ⚠  Navigation error (attempt ${attempt}/${MAX_GOTO_RETRIES}): ${err.message.split('\n')[0]}`);
        console.log(`    ↻  Closing stale page and waiting ${NETWORK_RECOVERY_WAIT_MS / 1000}s before retry...`);
        try { await pageRef.page.close(); } catch (_) {}
        pageRef.page = await context.newPage();
        await randomDelay(NETWORK_RECOVERY_WAIT_MS, NETWORK_RECOVERY_WAIT_MS + 5000);
      } else {
        throw err; // exhausted retries or non-network error
      }
    }
  }
  throw lastErr;
}

// ─── Page state detection ─────────────────────────────────────────────────────

async function isBlocked(page) {
  try {
    const text = await page.textContent('body');
    return /access is temporarily restricted|unusual activity|automated.*bot/i.test(text);
  } catch (_) { return false; }
}

async function isAuthWalled(page) {
  try {
    const text = await page.textContent('body');
    return /sign.?in or join|join or sign.?in|please log in/i.test(text);
  } catch (_) { return false; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLotRef(url) {
  const match = url.match(/\/a\/(\d+)-(\d+)\.s/i) || url.match(/\/(\d+)-(\d+)\.s/i);
  if (match) return `${match[1]}-${match[2]}`;
  return url.split('/').pop().replace('.s', '');
}

async function extractSaleDate(page) {
  try {
    const text = await page.textContent('body');
    const match = text.match(/sold\s+on\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (match) {
      const d = new Date(match[1]);
      if (!isNaN(d)) return d.toISOString().split('T')[0];
    }
  } catch (_) {}
  return new Date().toISOString().split('T')[0];
}

async function getExistingLotRefs() {
  const { data, error } = await supabase
    .from('lots')
    .select('lot_ref')
    .eq('source', SOURCE);
  if (error) { console.error('Supabase error:', error.message); return new Set(); }
  return new Set(data.map((r) => r.lot_ref));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n=== Heritage Auctions Scraper v3.7 ===');
  console.log('Fixes: cardback pattern (space), search queries, network recovery, image debug\n');

  const browser = await chromium.launch({
    headless: false,
    args: STEALTH_ARGS,
  });

  const context = await browser.newContext({
    userAgent: randomAgent(),
    viewport: { width: 1366, height: 768 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // ── Step 1: Manual login ──────────────────────────────────────────────────
  console.log('Opening Heritage login page...');
  await page.goto('https://www.ha.com/c/login.zx', { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 4000);

  try {
    await page.click('#onetrust-accept-btn-handler', { timeout: 5000 });
    await randomDelay(1000, 2000);
  } catch (_) {}

  console.log('Please log in to Heritage in the browser window.');
  console.log('When fully logged in, press ENTER here to continue...\n');
  await new Promise((resolve) => process.stdin.once('data', resolve));
  console.log('Login confirmed. Starting scrape...\n');

  // ── Step 2: Collect lot URLs ──────────────────────────────────────────────
  console.log(`Running ${SEARCH_QUERIES.length} search queries (10–20s between each)...`);
  const urls = new Set();

  for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
    const query = SEARCH_QUERIES[qi];
    const searchUrl =
      `https://www.ha.com/c/search/results.zx?term=${query}` +
      `&si=2&mode=archive&ic=SiteSearch-Results-AH-Archive-071514`;

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(3000, 5000);
      await humanMove(page);

      if (await isBlocked(page)) {
        console.log(`  ⚠  BLOCKED on query ${qi + 1} — waiting 75 seconds...`);
        await randomDelay(75000, 90000);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(5000, 8000);
        if (await isBlocked(page)) {
          console.log(`  ✗  Still blocked — skipping this query`);
          continue;
        }
      }

      const links = await page.$$eval('a[href*="/itm/action-figures/"]', (els) =>
        els.map((el) => el.href)
      );
      for (const link of links) urls.add(link.split('?')[0]);

      console.log(`  [${qi + 1}/${SEARCH_QUERIES.length}] "${query}" → ${links.length} links (${urls.size} total)`);

      if (qi < SEARCH_QUERIES.length - 1) {
        const wait = Math.floor(Math.random() * 10000) + 10000;
        console.log(`  Pausing ${(wait / 1000).toFixed(0)}s...`);
        await randomDelay(wait, wait);
      }
    } catch (err) {
      console.warn(`  ✗  Query failed: ${err.message}`);
    }
  }

  console.log(`\nUnique lot URLs collected: ${urls.size}`);

  // ── Step 3: Filter to new lots only ──────────────────────────────────────
  const existingRefs = await getExistingLotRefs();
  console.log(`Existing Heritage records: ${existingRefs.size}`);

  const toProcess = [...urls].filter((url) => !existingRefs.has(parseLotRef(url)));
  console.log(`New lots to process: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('No new lots found. All done.');
    await browser.close();
    return;
  }

  // ── Step 4: Scrape each lot ───────────────────────────────────────────────
  let newRecords = 0;
  let skipped    = 0;

  // pageRef wraps the active page so safeGoto can swap it on network errors
  const pageRef = { page };

  for (let i = 0; i < toProcess.length; i++) {
    const url    = toProcess[i];
    const lotRef = parseLotRef(url);

    console.log(`[${i + 1}/${toProcess.length}] ${lotRef}`);


    // Cooling pause every 10 lots to reduce Heritage throttling
    if (i > 0 && i % 10 === 0) {
      console.log("  -- Cooling pause after " + i + " lots (45s) --");
      await randomDelay(45000, 55000);
    }

    try {
      await safeGoto(context, pageRef, url);
      await randomDelay(2000, 4000);
      await humanMove(pageRef.page);

      if (await isBlocked(pageRef.page)) {
        console.log("  WARNING: Blocked -- waiting 90 seconds...");
        await randomDelay(90000, 120000);
        await safeGoto(context, pageRef, url);
        await randomDelay(3000, 5000);
        if (await isBlocked(pageRef.page)) {
          console.log("  STOP: Persistently blocked -- stopping to protect your IP");
          break;
        }
      }

      try {
        await pageRef.page.click("#onetrust-accept-btn-handler", { timeout: 2000 });
        await randomDelay(500, 1000);
      } catch (_) {}

      if (await isAuthWalled(pageRef.page)) {
        console.log("  Auth wall -- skipping");
        skipped++;
        continue;
      }

      // Title
      let title = "";
      try {
        title = await pageRef.page.$eval("h1.lot-title, h1", (el) => el.textContent.trim());
      } catch (_) { title = await pageRef.page.title(); }

      // MOC filter (v3.7 -- Heritage-specific inference, space-aware cardback pattern)
      if ( ! isMOC(title)) {
        console.log("  Not MOC: " + title.substring(0, 70));
        skipped++;
        continue;
      }

      // Price
      const totalUSD = await extractPrice(pageRef.page);
      if ( ! totalUSD) {
        console.log("  No price -- skipping");
        skipped++;
        continue;
      }

      const hammerUSD   = totalUSD / BP_RATE;
      const hammerGBP   = hammerUSD * USD_TO_GBP;
      const bpGBP       = (totalUSD - hammerUSD) * USD_TO_GBP;
      const totalGBP    = totalUSD * USD_TO_GBP;

      let conditionNotes = "";
      try {
        conditionNotes = await pageRef.page.$eval(
          ".lot-description, .description, [itemprop=description]",
          (el) => el.textContent.trim().substring(0, 1000)
        );
      } catch (_) {}

      const saleDate        = await extractSaleDate(pageRef.page);
      const imageUrls       = await extractImage(pageRef.page);
      const combined        = title + " " + conditionNotes;
      const era             = classifyEra(combined);
      const cardbackCode    = classifyCardback(combined, era);
      const variantCode     = classifyVariant(combined, cardbackCode);
      const gradeTier       = classifyGrade(combined);
      const variantGradeKey = variantCode + "-" + gradeTier;

      let gradeSubgrades = "";
      try {
        const sgMatch = combined.match(/C(\d+)\s*B(\d+)\s*F(\d+)/i);
        if (sgMatch) gradeSubgrades = "C" + sgMatch[1] + " B" + sgMatch[2] + " F" + sgMatch[3];
      } catch (_) {}

      const record = {
        capture_date:       new Date().toISOString().split("T")[0],
        sale_date:          saleDate,
        source:             SOURCE,
        lot_ref:            lotRef,
        lot_url:            url,
        variant_code:       variantCode,
        grade_tier_code:    gradeTier,
        era,
        cardback_code:      cardbackCode,
        hammer_price_gbp:   parseFloat(hammerGBP.toFixed(2)),
        buyers_premium_gbp: parseFloat(bpGBP.toFixed(2)),
        total_paid_gbp:     parseFloat(totalGBP.toFixed(2)),
        usd_to_gbp_rate:    USD_TO_GBP,
        image_urls:         imageUrls,
        condition_notes:    conditionNotes,
        grade_subgrades:    gradeSubgrades,
        price_status:       "CONFIRMED",
        variant_grade_key:  variantGradeKey,
      };

      const { error } = await supabase.from("lots").insert(record);
      if (error) {
        console.error("  Insert error: " + error.message);
      } else {
        const imgStr = imageUrls.length ? "IMG " + imageUrls[0].substring(0, 50) : "no img";
        console.log("  OK  " + cardbackCode + " | " + gradeTier + " | GBP" + totalGBP.toFixed(0) + " | " + imgStr);
        newRecords++;
      }

      if (i < toProcess.length - 1) {
        const wait = Math.floor(Math.random() * 7000) + 5000;
        console.log("  Pausing " + (wait / 1000).toFixed(0) + "s...");
        await randomDelay(wait, wait);
      }
    } catch (err) {
      console.warn("  Error: " + err.message);
    }
  }

  await browser.close();

  console.log('\\n=======================================');
  console.log("Heritage scrape complete (v3.7)");
  console.log("  New records inserted : " + newRecords);
  console.log("  Skipped              : " + skipped);
  console.log("  Processed            : " + toProcess.length);
  console.log("=======================================" );
  console.log('\\nNOTE: Runs slowly by design (10-20 min full run).');
  console.log("To fix existing records with bad images, run:");
  console.log('  node scripts/refresh-heritage-images.cjs\n');
})();

/**
 * scrape-lcg.cjs  (v5.3 — expanded MOC filter, improved grade classifier)
 * ──────────────────────────────────────────────────────────────
 * LCG Auctions scraper for Kenner Darth Vader MOC figures.
 *
 * v5.2 — March 2026
 *   - Multi-figure lot rejections: "figure lot", "\d+ figures", "lot of (word)"
 *   - Prose-based grade classifier for RAW-NM / RAW-EX / RAW-VG
 *   - CAS-75 grade tier added
 *   - GRADED-UNKNOWN for bare "AFA" mentions without a score
 *
 * v5.1 — March 2026
 *   Fixed: condition_notes extraction was capturing "Prev/Next"
 *   navigation HTML instead of lot descriptions. Now filters out
 *   nav elements and prefers the most specific content container.
 *
 * BP: 22% back-calculated.  USD → GBP at 0.79.
 * headless: false.
 *
 * Usage:  node scripts/scrape-lcg.cjs
 * ──────────────────────────────────────────────────────────────
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USD_TO_GBP = 0.79;
const BP_RATE = 0.22;
const SOURCE = 'LCG';
const BASE_URL = 'https://auction.lcgauctions.com';
const GALLERY_URL = `${BASE_URL}/lots/gallery`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ───────────────────────────────────────────────────
function sleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}
function round2(n) { return Math.round(n * 100) / 100; }

function calcPrices(totalPaidUSD) {
  const hammerUSD = round2(totalPaidUSD / (1 + BP_RATE));
  const bpUSD = round2(totalPaidUSD - hammerUSD);
  return {
    hammerPriceGBP: round2(hammerUSD * USD_TO_GBP),
    buyersPremiumGBP: round2(bpUSD * USD_TO_GBP),
    totalPaidGBP: round2(totalPaidUSD * USD_TO_GBP),
  };
}

/**
 * Clean extracted text: collapse whitespace, strip nav elements,
 * strip payment/shipping boilerplate.
 */
function cleanDescription(raw) {
  if (!raw) return '';
  let text = raw
    .replace(/\s+/g, ' ')                     // collapse whitespace
    .replace(/Prev(ious)?\s*(Item)?/gi, '')    // strip nav text
    .replace(/Next\s*(Item)?/gi, '')
    .replace(/Back to (Gallery|Search|Results)/gi, '')
    .trim();

  // Strip common LCG boilerplate from the end
  const boilerplate = [
    /payment for lots.*/i,
    /shipping and handling.*/i,
    /terms and conditions.*/i,
    /prices shown include.*/i,
    /buyer's premium.*/i,
    /please note.*/i,
    /winning bidders?.*/i,
  ];
  for (const bp of boilerplate) {
    text = text.replace(bp, '').trim();
  }

  return text;
}

// ── MOC Filter ────────────────────────────────────────────────
function isMOC(title) {
  const t = (title || '').toLowerCase();

  // BUG-06 (v5.3): known international licensees — allow through immediately
  //   if title contains Vader (prevents false-positive reject by later rules)
  const intlLicensees = ['top toys', 'lili ledy', 'lily ledy'];
  for (const maker of intlLicensees) {
    if (t.includes(maker) && (t.includes('darth vader') || (t.includes('vader') && !t.includes('invader')))) return true;
  }

  // Hard reject: not Star Wars
  const notSW = [
    'g.i. joe', 'gi joe', 'g.i.joe', 'transformers', 'motu',
    'he-man', 'masters of the universe', 'thundercats',
    'teenage mutant', 'tmnt', 'iphone', 'ipod', 'apple',
    'cobra', 'grayskull', 'super powers', 'dc comics',
  ];
  for (const ns of notSW) { if (t.includes(ns)) return false; }

  // Reject: SW but not carded figure
  const reject = [
    'loose', 'no card', 'without card', 'card only',
    'baggie', 'bag figure', 'mailer',
    'job lot', 'bundle', 'collection of',
    'vehicle', 'playset', 'carrying case', 'collector case',
    'collectors case', 'display stand',
    'star destroyer', 'tie fighter', 'x-wing', 'millennium falcon',
    'at-at', 'at-st', 'speeder', 'scout walker', 'landspeeder',
    'slave i', 'slave 1', 'y-wing', 'b-wing', 'a-wing',
    'snowspeeder', 'cloud car', 'interceptor',
    'ewok village', 'jabba', 'rancor', 'tauntaun',
    'potf2', 'potf 2', 'power of the force 2',
    'black series', 'hasbro', '6 inch', '6"',
    'replica', 'statue', 'bust', 'helmet',
    'prototype', 'first shot', 'hardcopy',
    'coin only', 'proof card', 'uncut',
    'poster', 'artwork', 'press kit',
    'lightsaber prop', 'screen used',
    'diecast', 'die cast', 'die-cast',
    'ssp van', 'van set', '3-pack', 'giftset',
    'gift set', 'multi-pack', 'creature',
    'invader',
    // v5.1 additions
    'inflatable', 'bop bag', 'utility belt', 'roleplay',
    'box flat', 'transparency', 'pair of',
    'mailer box', 'baggies', '7" tall', '15" tall',
    'large size', 'revenge of the jedi',
    // Multi-figure lot rejections (v5.2)
    'lot of', 'figure lot', 'group of', 'set of ',
  ];
  for (const r of reject) { if (t.includes(r)) return false; }

  // Regex-based multi-figure lot rejection (v5.2 + v5.3)
  if (/\b\d+\s*figures\b/i.test(t)) return false;
  if (/\blot\s+of\s+\w+\b/i.test(t)) return false;
  // v5.3: catch comma-separated character name lists e.g. '80+ Vader DT, 80 Luke DT, 80+ Ben DT'
  if (/(?:vader|luke|han|leia|obi.wan|ben|chewbacca|chewie|threepio|r2)[^,]+,[^,]+(?:vader|luke|han|leia|obi.wan|ben|chewbacca|chewie|threepio|r2)/i.test(t)) return false;

  // Must reference Darth Vader specifically
  if (!t.includes('darth vader') &&
      !(t.includes('vader') && !t.includes('invader'))) {
    return false;
  }

  // Must have a carded indicator
  const keep = [
    'back', 'cardback', 'card back',
    'moc', 'mint on card', 'carded',
    'afa', 'ukg', 'cas',
    'potf', 'power of the force',
    'unpunched', 'punched',
    'bubble', 'blister',
  ];
  for (const k of keep) { if (t.includes(k)) return true; }
  return false;
}

// ── Auto-Classifier ───────────────────────────────────────────
function classify(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();

  let era = 'UNKNOWN';
  if (/power of the force|potf/.test(text) && !/potf2|potf 2/.test(text)) era = 'POTF';
  else if (/return of the jedi|rotj/.test(text)) era = 'ROTJ';
  else if (/empire strikes back|esb/.test(text)) era = 'ESB';
  else if (/star wars|kenner/.test(text)) era = 'SW';

  let cardbackCode = 'UNKNOWN';
  if (/92[\s-]?back|potf/.test(text) && era !== 'UNKNOWN') cardbackCode = 'POTF-92';
  else if (/79[\s-]?back/.test(text)) cardbackCode = 'ROTJ-79';
  else if (/77[\s-]?back/.test(text)) cardbackCode = 'ROTJ-77';
  else if (/70[\s-]?back|70b\b/i.test(text)) { cardbackCode = 'ROTJ-70'; era = 'ROTJ'; }
  else if (/65[\s-]?back/.test(text)) cardbackCode = 'ROTJ-65';
  else if (/48[\s-]?back/.test(text) && (era === 'ROTJ' || /rotj|return/i.test(text))) cardbackCode = 'ROTJ-48';
  else if (/48[\s-]?back/.test(text)) cardbackCode = 'ESB-48';
  else if (/47[\s-]?back/.test(text)) cardbackCode = 'ESB-47';
  else if (/45[\s-]?back/.test(text)) cardbackCode = 'ESB-45';
  else if (/41[\s-]?back/.test(text)) cardbackCode = 'ESB-41';
  else if (/32[\s-]?back/.test(text)) cardbackCode = 'ESB-32';
  else if (/31[\s-]?back/.test(text)) cardbackCode = 'ESB-31';
  else if (/21[\s-]?back/.test(text)) cardbackCode = 'SW-21';
  else if (/20[\s-]?back/.test(text)) cardbackCode = 'SW-20';
  else if (/12[\s-]?back[\s-]?a|12[\s-]?a[\s-]?back|12a\b/i.test(text)) cardbackCode = 'SW-12A';
  else if (/12[\s-]?back[\s-]?b|12[\s-]?b[\s-]?back|12b\b/i.test(text)) cardbackCode = 'SW-12B';
  else if (/12[\s-]?back[\s-]?c|12[\s-]?c[\s-]?back|12c\b/i.test(text)) cardbackCode = 'SW-12C';
  else if (/12[\s-]?back/.test(text)) cardbackCode = 'SW-12';

  if (era === 'SW' || era === 'UNKNOWN') {
    if (cardbackCode.startsWith('ESB')) era = 'ESB';
    else if (cardbackCode.startsWith('ROTJ')) era = 'ROTJ';
    else if (cardbackCode.startsWith('POTF')) era = 'POTF';
    else if (cardbackCode.startsWith('SW')) era = 'SW';
  }

  if (/double[\s-]?telescop|d\.?t\.?\s|\bdt\b/i.test(text)) {
    if (cardbackCode === 'SW-12A') cardbackCode = 'SW-12A-DT';
    else if (cardbackCode === 'SW-12B') cardbackCode = 'SW-12B-DT';
    else if (cardbackCode === 'SW-12' || cardbackCode === 'UNKNOWN') cardbackCode = 'SW-12-DT';
  }

  // Variant — check Tri-Logo BEFORE Palitoy
  // BUG-05 (v5.3): international codes now include cardback prefix
  //   e.g. ROTJ-77-MEX, ROTJ-70-PAL rather than bare MEX / PAL
  //   PAL-TL stays as its own code (Tri-Logo is a distinct product line)
  let variantCode = cardbackCode;
  if (/tri[\s-]?logo|trilogo/i.test(text)) variantCode = 'PAL-TL';
  else if (/canadian|bilingual|canada/i.test(text)) variantCode = `${cardbackCode}-CAN`;
  else if (/palitoy/i.test(text)) variantCode = `${cardbackCode}-PAL`;
  else if (/mexico|mexican|lili\s?ledy|lily\s?ledy/i.test(text)) variantCode = `${cardbackCode}-MEX`;
  else if (/vader\s*pointing|alternate\s*photo|alt\s*photo/i.test(text)) variantCode = `${cardbackCode}-VP`;

  if (cardbackCode === 'ROTJ-65') {
    const m = text.match(/65[\s-]?back[\s-]?([a-d])/i) || text.match(/65([a-d])\b/i);
    if (m) { cardbackCode = `ROTJ-65${m[1].toUpperCase()}`; if (variantCode === 'ROTJ-65') variantCode = cardbackCode; }
  }
  if (cardbackCode === 'ROTJ-79') {
    const m = text.match(/79[\s-]?back[\s-]?([a-b])/i) || text.match(/79([a-b])\b/i);
    if (m) { cardbackCode = `ROTJ-79${m[1].toUpperCase()}`; if (variantCode === 'ROTJ-79') variantCode = cardbackCode; }
  }

  let gradeTierCode = 'UNKNOWN';
  const afaMatch = text.match(/afa[\s-]?y?[\s-]?(\d{2,3})/i);
  if (afaMatch) {
    const score = parseInt(afaMatch[1]);
    if (score >= 90) gradeTierCode = 'AFA-90+';
    else if (score >= 85) gradeTierCode = 'AFA-85';
    else if (score >= 80) gradeTierCode = 'AFA-80';
    else if (score >= 75) gradeTierCode = 'AFA-75';
    else if (score >= 70) gradeTierCode = 'AFA-70';
    else if (score >= 60) gradeTierCode = 'AFA-60';
    else if (score >= 50) gradeTierCode = 'AFA-50';
    else if (score >= 40) gradeTierCode = 'AFA-40';
    else gradeTierCode = `AFA-${score}`;
  }
  else if (/ukg[\s-]?(\d{2,3})/i.test(text)) {
    const s = parseInt(text.match(/ukg[\s-]?(\d{2,3})/i)[1]);
    if (s >= 85) gradeTierCode = 'UKG-85';
    else if (s >= 80) gradeTierCode = 'UKG-80';
    else if (s >= 75) gradeTierCode = 'UKG-75';
    else gradeTierCode = `UKG-${s}`;
  }
  else if (/cas[\s-]?(\d{2,3})/i.test(text)) {
    const s = parseInt(text.match(/cas[\s-]?(\d{2,3})/i)[1]);
    if (s >= 85) gradeTierCode = 'CAS-85';
    else if (s >= 80) gradeTierCode = 'CAS-80';
    else if (s >= 75) gradeTierCode = 'CAS-75';
    else if (s >= 70) gradeTierCode = 'CAS-70';
    else gradeTierCode = `CAS-${s}`;
  }
  else if (/\bafa\b/i.test(text)) gradeTierCode = 'GRADED-UNKNOWN';
  else if (/\bmoc\b|mint on card|carded|unpunched|sealed/i.test(text)) gradeTierCode = 'RAW-NM';
  // Prose-based grade classification for ungraded lots (v5.2)
  else if (/\b(mint|near\s*mint|nm|excellent\s*plus)\b/i.test(text)) gradeTierCode = 'RAW-NM';
  else if (/\b(excellent|good\s*plus|vg\+|very\s*good\s*plus)\b/i.test(text)) gradeTierCode = 'RAW-EX';
  else if (/\b(good|fair|poor|playworn|damaged|crushed)\b/i.test(text)
           && !/good\s*(plus|condition)/i.test(text)) gradeTierCode = 'RAW-VG';

  return { era, cardbackCode, variantCode, gradeTierCode, variantGradeKey: `${variantCode}-${gradeTierCode}` };
}

// ── Extract lot cards from current gallery page ───────────────
async function extractLotCards(page) {
  return await page.evaluate((base) => {
    const found = [];
    const seen = new Set();
    const links = document.querySelectorAll('a[href*="bidplace"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/itemid=(\d+)/i);
      if (!idMatch) continue;
      const itemId = idMatch[1];
      if (seen.has(itemId)) continue;
      seen.add(itemId);

      const title = link.textContent.trim();
      if (!title || title.length < 10 || title.toUpperCase().startsWith('SOLD FOR')) continue;

      let priceText = '';
      const parent = link.closest('div, tr, li, [class*="lot"], [class*="item"]') || link.parentElement;
      if (parent) {
        const pm = parent.textContent.match(/SOLD\s+FOR\s+\$([\d,]+)/i);
        if (pm) priceText = '$' + pm[1];
      }

      let imageUrl = '';
      if (parent) {
        const img = parent.querySelector('img');
        if (img) imageUrl = img.src || img.getAttribute('data-src') || '';
      }

      // BUG-01 (v5.3): navigate to the public lot detail page, not bidplace
      // which requires an authenticated session and collapses after the first visit.
      const detailUrl = `${base}/lots/lotview.aspx?itemid=${itemId}`;
      found.push({ title, url: detailUrl, itemId, priceText, imageUrl });
    }
    return found;
  }, BASE_URL);
}

// ══════════════════════════════════════════════════════════════
//  MAIN SCRAPER — iterate each auction via <select> dropdown
// ══════════════════════════════════════════════════════════════
async function scrapeLCG() {
  console.log('Starting LCG Auctions scraper v5.1...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  let allLots = [];

  try {
    // ── Step 1: Load gallery and discover auction options ──────
    console.log('Loading gallery to discover auctions...');
    await page.goto(GALLERY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    // Find the auction <select> and extract all options
    const auctionOptions = await page.evaluate(() => {
      const options = [];
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        for (const opt of sel.options) {
          if (opt.text.trim() === 'All Auctions') {
            for (const o of sel.options) {
              const name = o.text.trim();
              const value = o.value;
              if (name !== 'All Auctions' && value !== '-1' && name.length > 3) {
                options.push({ name, value });
              }
            }
            return {
              selectId: sel.id || '',
              selectName: sel.name || '',
              options,
            };
          }
        }
      }
      return { selectId: '', selectName: '', options };
    });

    console.log(`Found auction dropdown with ${auctionOptions.options.length} auctions:`);
    for (const opt of auctionOptions.options) {
      console.log(`  • ${opt.name} (value=${opt.value})`);
    }

    if (auctionOptions.options.length === 0) {
      console.log('\nNo auction options found! Dumping all selects...');
      const selectDump = await page.evaluate(() => {
        const info = [];
        document.querySelectorAll('select').forEach((sel, i) => {
          const opts = [];
          for (const o of sel.options) {
            opts.push(`${o.value}: "${o.text.trim()}"`);
          }
          info.push({ index: i, id: sel.id, name: sel.name, options: opts });
        });
        return info;
      });
      console.log(JSON.stringify(selectDump, null, 2));
    }

    let selectSelector = 'select';
    if (auctionOptions.selectId) {
      selectSelector = `#${auctionOptions.selectId}`;
    } else if (auctionOptions.selectName) {
      selectSelector = `select[name="${auctionOptions.selectName}"]`;
    }

    // ── Step 2: For each auction, select it, search "vader" ───
    for (const auction of auctionOptions.options) {
      console.log(`\n═══ ${auction.name} ═══`);

      await page.goto(GALLERY_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      try {
        await page.selectOption(selectSelector, auction.value);
        await page.waitForTimeout(4000);
        console.log(`  Selected auction ✓`);
      } catch (e) {
        try {
          await page.evaluate(({ sel, val }) => {
            const select = document.querySelector(sel) ||
              Array.from(document.querySelectorAll('select')).find(s =>
                Array.from(s.options).some(o => o.text.trim() === 'All Auctions')
              );
            if (select) {
              select.value = val;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              if (typeof __doPostBack === 'function' && (select.name || select.id)) {
                __doPostBack(select.name || select.id, '');
              }
            }
          }, { sel: selectSelector, val: auction.value });
          await page.waitForTimeout(4000);
          console.log(`  Selected auction (fallback) ✓`);
        } catch (e2) {
          console.log(`  Failed to select auction: ${e2.message}`);
          continue;
        }
      }

      try {
        const searchInput = page.locator('input[type="text"], input[type="search"]').first();
        if (await searchInput.count() > 0) {
          await searchInput.fill('vader');
          await page.waitForTimeout(300);
          await searchInput.press('Enter');
          await page.waitForTimeout(5000);
          console.log(`  Searched "vader" ✓`);
        } else {
          console.log(`  No search input found`);
          continue;
        }
      } catch (e) {
        console.log(`  Search error: ${e.message}`);
        continue;
      }

      const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 500));
      if (bodySnippet.includes('No results found')) {
        console.log(`  No Vader lots`);
        continue;
      }

      const lots = await extractLotCards(page);
      console.log(`  Found ${lots.length} lot cards`);

      for (const lot of lots) {
        lot.auctionName = auction.name;
      }
      allLots.push(...lots);

      if (lots.length > 0) {
        console.log(`  First: ${lots[0].title.substring(0, 70)} | ${lots[0].priceText}`);
      }

      await sleep(1500, 3000);
    }

    // ── Deduplicate by itemId ─────────────────────────────────
    const deduped = [];
    const seenIds = new Set();
    for (const lot of allLots) {
      if (!seenIds.has(lot.itemId)) {
        seenIds.add(lot.itemId);
        deduped.push(lot);
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`Total unique Vader lots: ${deduped.length} (from ${allLots.length} raw across ${auctionOptions.options.length} auctions)`);
    console.log(`═══════════════════════════════════════\n`);

    // ── Step 3: Visit each lot page for full details ──────────
    let inserted = 0, skipped = 0, filtered = 0, errors = 0;

    for (let i = 0; i < deduped.length; i++) {
      const lot = deduped[i];

      if (!isMOC(lot.title)) {
        console.log(`  Filtered: ${lot.title.substring(0, 70)}`);
        filtered++;
        continue;
      }

      console.log(`[${i + 1}/${deduped.length}] ${lot.title.substring(0, 80)}...`);

      const { data: existing } = await supabase
        .from('lots').select('id').eq('source', SOURCE).eq('lot_ref', lot.itemId).limit(1);
      if (existing && existing.length > 0) {
        console.log(`  Skipped (already in DB)`);
        skipped++;
        continue;
      }

      try {
        // BUG-01 (v5.3): retry once with extended back-off before falling back
        let navigated = false;
        for (let attempt = 0; attempt < 2 && !navigated; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`  Retrying navigation (attempt 2)...`);
              await sleep(6000, 8000);
            }
            await page.goto(lot.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            navigated = true;
          } catch (navErr) {
            if (attempt === 0) {
              console.log(`  Nav failed: ${navErr.message.split('\n')[0]}`);
            } else {
              console.log(`  Nav failed after retry — using gallery card data (ESTIMATE_ONLY)`);
            }
          }
        }
        await page.waitForTimeout(navigated ? 2500 : 0);

        // ── FIXED EXTRACTION (v5.1) ───────────────────────
        // The old code grabbed the first div/span/td containing
        // keywords, which often matched the nav container
        // ("Prev / Next") wrapping the lot title. The fix:
        //   1. Collect ALL candidate text blocks
        //   2. Filter out any containing nav patterns
        //   3. Score remaining by keyword density
        //   4. Pick the best one
        // BUG-01 (v5.3): use gallery card as fallback when navigation failed
        let details = { title: '', priceText: lot.priceText || '', description: '', saleDate: '', images: lot.imageUrl ? [lot.imageUrl] : [], lotNumber: '' };
        if (navigated) details = await page.evaluate(() => {
          const body = document.body.innerText || '';

          let title = '';
          const h = document.querySelector('h1, h2, [class*="title"]');
          if (h) title = h.textContent.trim();

          // Price — "SOLD FOR $X,XXX"
          let priceText = '';
          const soldMatch = body.match(/SOLD\s+FOR\s+\$([\d,]+(?:\.\d{2})?)/i);
          if (soldMatch) priceText = '$' + soldMatch[1];
          if (!priceText) {
            const dollars = body.match(/\$([\d,]+(?:\.\d{2})?)/g) || [];
            let max = 0;
            for (const d of dollars) {
              const v = parseFloat(d.replace(/[$,]/g, ''));
              if (v > max && v > 10 && v < 500000) { max = v; priceText = d; }
            }
          }

          // ── Description extraction (FIXED v5.1) ─────────
          // Strategy: find all text-containing elements, reject
          // those that are navigation/boilerplate, then pick the
          // most relevant remaining block.
          let description = '';
          const navPatterns = /\bPrev(ious)?\b|\bNext\b|Back to Gallery|Back to Search/i;
          const keywords = ['afa', 'kenner', 'back', 'graded', 'vader', 'star wars',
                            'palitoy', 'blister', 'card', 'figure', 'mint', 'condition',
                            'unpunched', 'punched', 'bubble', 'ukg', 'cas'];

          const candidates = [];
          const allEls = document.querySelectorAll('p, td, span, div');
          for (const el of allEls) {
            const t = el.textContent.trim();

            // Skip if too short, too long, or contains nav text
            if (t.length < 40 || t.length > 5000) continue;
            if (navPatterns.test(t)) continue;

            // Skip if this is clearly a parent that contains children
            // we'll also visit (prefer leaf/smaller elements)
            if (el.tagName === 'DIV' && el.querySelectorAll('p, td, span').length > 3) continue;

            const lower = t.toLowerCase();
            let score = 0;
            for (const kw of keywords) {
              if (lower.includes(kw)) score++;
            }

            // Penalise elements that are mostly boilerplate
            if (lower.includes('payment for lots')) score -= 5;
            if (lower.includes('shipping and handling')) score -= 5;
            if (lower.includes('terms and conditions')) score -= 5;

            if (score > 0) {
              candidates.push({ text: t, score, length: t.length });
            }
          }

          // Sort by score descending, then prefer moderate length
          candidates.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            // Prefer texts between 50-500 chars (likely the lot description)
            const aMid = a.length >= 50 && a.length <= 500 ? 1 : 0;
            const bMid = b.length >= 50 && b.length <= 500 ? 1 : 0;
            return bMid - aMid;
          });

          if (candidates.length > 0) {
            description = candidates[0].text.substring(0, 2000);
          }

          // Sale date — "End: M/D/YYYY"
          let saleDate = '';
          const endMatch = body.match(/end[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
          if (endMatch) saleDate = endMatch[1];
          if (!saleDate) {
            const dm = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
            if (dm) saleDate = dm[1];
          }

          // Images
          const images = [];
          document.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src && !src.includes('logo') && !src.includes('icon') && src.length > 20) {
              images.push(src);
            }
          });

          let lotNumber = '';
          const lm = body.match(/lot\s*#?\s*:?\s*(\d+)/i);
          if (lm) lotNumber = lm[1];

          return { title, priceText, description, saleDate, images: images.slice(0, 5), lotNumber };
        });  // end page.evaluate (if navigated)

        const finalTitle = details.title || lot.title;

        // Parse price (USD, includes 22% BP)
        let totalPaidUSD = 0;
        const ps = details.priceText || lot.priceText || '';
        if (ps) totalPaidUSD = parseFloat(ps.replace(/[^0-9.]/g, '')) || 0;

        const prices = totalPaidUSD > 0
          ? calcPrices(totalPaidUSD)
          : { hammerPriceGBP: null, buyersPremiumGBP: null, totalPaidGBP: null };

        // Sale date
        let saleDate = null;
        if (details.saleDate) {
          try {
            const d = new Date(details.saleDate);
            if (!isNaN(d.getTime())) saleDate = d.toISOString().split('T')[0];
          } catch (e) {}
        }
        if (!saleDate && lot.auctionName) {
          const ym = lot.auctionName.match(/(\d{4})/);
          if (ym) {
            const map = { winter: '02', spring: '05', summer: '08', fall: '11', april: '04' };
            for (const [s, m] of Object.entries(map)) {
              if (lot.auctionName.toLowerCase().includes(s)) { saleDate = `${ym[1]}-${m}-01`; break; }
            }
          }
        }

        const cls = classify(finalTitle, details.description);

        if (!isMOC(finalTitle) && !isMOC(lot.title) && !isMOC(details.description || '')) {
          console.log(`  Filtered (secondary): ${finalTitle.substring(0, 70)}`);
          filtered++;
          continue;
        }

        // Clean condition notes
        const notes = cleanDescription(details.description);

        const priceStatus = totalPaidUSD > 0 ? 'CONFIRMED' : 'ESTIMATE_ONLY';

        const record = {
          capture_date: new Date().toISOString().split('T')[0],
          sale_date: saleDate,
          source: SOURCE,
          lot_ref: lot.itemId,
          lot_url: lot.url.toLowerCase().replace(/\/+$/, ''),
          era: cls.era,
          cardback_code: cls.cardbackCode,
          variant_code: cls.variantCode,
          grade_tier_code: cls.gradeTierCode,
          variant_grade_key: cls.variantGradeKey,
          hammer_price_gbp: prices.hammerPriceGBP,
          buyers_premium_gbp: prices.buyersPremiumGBP,
          total_paid_gbp: prices.totalPaidGBP,
          usd_to_gbp_rate: USD_TO_GBP,
          image_urls: details.images,
          condition_notes: notes.substring(0, 2000),
          price_status: priceStatus,
          grade_subgrades: (() => {
            const sgm = finalTitle.match(/(?:afa|ukg|cas)[\s-]?(?:y?[\s-]?)?(\d{2,3})-(\d{2,3}(?:-\d{2,3})*)/i);
            return sgm ? sgm[2] : '';
          })(),
        };

        const { error } = await supabase.from('lots').insert(record);
        if (error) {
          console.error(`  Insert error: ${error.message}`);
          errors++;
        } else {
          console.log(`  ✓ ${cls.variantGradeKey} | ${priceStatus} | ${prices.totalPaidGBP ? '£' + prices.totalPaidGBP : 'no price'} | ${finalTitle.substring(0, 50)}`);
          inserted++;
        }

      } catch (err) {
        console.error(`  Error: ${err.message}`);
        errors++;
      }

      await sleep(2000, 3000);
    }

    // ── Summary ─────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('LCG SCRAPE COMPLETE');
    console.log(`  Auctions searched:     ${auctionOptions.options.length}`);
    console.log(`  Inserted:              ${inserted}`);
    console.log(`  Skipped (duplicates):  ${skipped}`);
    console.log(`  Filtered (non-MOC):    ${filtered}`);
    console.log(`  Errors:                ${errors}`);
    console.log(`  Total lots found:      ${deduped.length}`);
    console.log('═══════════════════════════════════════');

  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    await browser.close();
  }
}

scrapeLCG().catch(console.error);

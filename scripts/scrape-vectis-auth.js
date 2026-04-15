/**
 * Vectis Scraper — Phase 2: Price Confirmation (Authenticated)
 *
 * Opens a browser for manual Vectis login, then retrieves
 * actual hammer prices for ESTIMATE_ONLY records.
 * Updates Supabase with confirmed prices or marks as UNSOLD.
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
 *   node scrape-vectis-auth.js
 */

const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const LOGIN_URL = "https://www.vectis.co.uk/login";
const BUYER_PREMIUM_RATE = 0.27; // 22.5% BP + 20% VAT on BP = 27% effective (vectis.co.uk/content/terms §26)

// ─── Helpers ───────────────────────────────────────────────────
function sleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((r) => setTimeout(r, ms));
}

function parseHammerPrice(text) {
  // e.g. "Hammer Price: £1,250" or "Sold for £1,250" or "£1,250"
  const match = text.match(/£([\d,]+)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

// ─── Main ──────────────────────────────────────────────────────
async function scrapeVectisAuth() {
  console.log("Starting Vectis authenticated price scraper...\n");

  // Fetch all ESTIMATE_ONLY Vectis records
  const { data: records, error: fetchError } = await supabase
    .from("lots")
    .select("id, lot_ref, lot_url, variant_code")
    .eq("source", "Vectis")
    .eq("price_status", "ESTIMATE_ONLY");

  if (fetchError) {
    console.error("Failed to fetch records:", fetchError.message);
    process.exit(1);
  }

  if (!records || records.length === 0) {
    console.log("No ESTIMATE_ONLY Vectis records to process.");
    return { confirmed: 0, unsold: 0 };
  }

  console.log(`Found ${records.length} ESTIMATE_ONLY records to update\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  let confirmed = 0;
  let unsold = 0;

  try {
    // ─── Manual Login ──────────────────────────────────────────
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    console.log('==============================================');
    console.log('MANUAL LOGIN REQUIRED');
    console.log('Please log into Vectis in the browser window.');
    console.log('Once logged in, come back here and press Enter.');
    console.log('==============================================');

    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      console.warn('⚠ URL still contains "login" — continuing anyway...');
    }

    console.log('Continuing with current session...\n');

    // ─── Process each record ───────────────────────────────────
    for (const record of records) {
      await sleep(2000, 4000);
      console.log(`Processing: ${record.variant_code} | ${record.lot_ref}`);

      try {
        await page.goto(record.lot_url, { waitUntil: "domcontentloaded", timeout: 30000 });
      } catch (e) {
        console.warn(`  ⚠ Failed to load: ${e.message}`);
        continue;
      }

      // Check if login wall is still showing
      const loginWall = await page.evaluate(() => {
        return (document.body.textContent || "").includes("Login To See Hammer Price");
      });
      if (loginWall) {
        console.warn(`  ⚠ Login wall detected — marking UNSOLD`);
        const { error: updateError } = await supabase
          .from("lots")
          .update({ price_status: "UNSOLD" })
          .eq("id", record.id);
        if (!updateError) unsold++;
        continue;
      }

      // Look for hammer price on the page
      const priceText = await page.evaluate(() => {
        // Try various selectors where hammer price might appear
        const selectors = [
          ".hammer-price",
          ".sold-price",
          ".winning-bid",
          "[class*='hammer']",
          "[class*='sold']",
          "[class*='price']",
          ".result",
          ".lot-result",
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.textContent || "";
            // Check if it contains a price
            if (text.match(/£[\d,]+/)) {
              return text;
            }
          }
        }

        // Fallback: search entire page for "Hammer" or "Sold for"
        const body = document.body.textContent || "";
        const hammerMatch = body.match(/hammer\s*(?:price)?[:\s]*£[\d,]+/i);
        if (hammerMatch) return hammerMatch[0];

        const soldMatch = body.match(/sold\s*(?:for)?[:\s]*£[\d,]+/i);
        if (soldMatch) return soldMatch[0];

        return "";
      });

      const hammerPrice = parseHammerPrice(priceText);

      if (hammerPrice && hammerPrice > 0) {
        // Calculate buyer's premium and total
        const buyersPremium = Math.round(hammerPrice * BUYER_PREMIUM_RATE);
        const totalPaid = hammerPrice + buyersPremium;

        const { error: updateError } = await supabase
          .from("lots")
          .update({
            hammer_price_gbp: hammerPrice,
            buyers_premium_gbp: buyersPremium,
            total_paid_gbp: totalPaid,
            price_status: "CONFIRMED",
          })
          .eq("id", record.id);

        if (updateError) {
          console.warn(`  ✗ Update failed: ${updateError.message}`);
        } else {
          confirmed++;
          console.log(`  ✓ CONFIRMED: £${hammerPrice} + £${buyersPremium} = £${totalPaid}`);
        }
      } else {
        // No hammer price found = UNSOLD
        const { error: updateError } = await supabase
          .from("lots")
          .update({
            price_status: "UNSOLD",
          })
          .eq("id", record.id);

        if (updateError) {
          console.warn(`  ✗ Update failed: ${updateError.message}`);
        } else {
          unsold++;
          console.log(`  ○ UNSOLD: No hammer price found`);
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
  console.log(`  Confirmed prices: ${confirmed}`);
  console.log(`  Marked unsold: ${unsold}`);
  console.log(`  Total processed: ${records.length}`);
  console.log(`═══════════════════════════════════════\n`);

  return { confirmed, unsold };
}

// Run
scrapeVectisAuth().catch(console.error);

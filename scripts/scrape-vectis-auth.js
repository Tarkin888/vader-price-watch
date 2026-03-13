/**
 * Vectis Scraper — Phase 2: Price Confirmation (Authenticated)
 *
 * Logs into Vectis to retrieve actual hammer prices for ESTIMATE_ONLY records.
 * Updates Supabase with confirmed prices or marks as UNSOLD.
 *
 * Prerequisites:
 *   npm install playwright @supabase/supabase-js dotenv
 *   npx playwright install chromium
 *
 * Create a .env file with:
 *   SUPABASE_URL=https://rdtwgrznjkigghbwstqz.supabase.co
 *   SUPABASE_ANON_KEY=your-anon-key
 *   VECTIS_EMAIL=zrezvi@gmail.com
 *   VECTIS_PASSWORD=Martine889!
 *
 * Usage:
 *   node scrape-vectis-auth.js
 *
 * IMPORTANT: Credentials are read from environment variables only.
 *            Never log or store credentials anywhere.
 */

const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// ─── Config ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const VECTIS_EMAIL = process.env.VECTIS_EMAIL;
const VECTIS_PASSWORD = process.env.VECTIS_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file");
  process.exit(1);
}

if (!VECTIS_EMAIL || !VECTIS_PASSWORD) {
  console.error("ERROR: Set VECTIS_EMAIL and VECTIS_PASSWORD in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const LOGIN_URL = "https://www.vectis.co.uk/login";
const BUYER_PREMIUM_RATE = 0.225; // 22.5% buyer's premium

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
    // ─── Login ─────────────────────────────────────────────────
    console.log("Logging into Vectis...");
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait for page to fully render
    await page.waitForTimeout(5000);

    // Strategy 1: click cookie consent by role/text
    for (const text of ["Accept All", "Accept", "I Accept", "OK", "Agree", "Allow All", "Allow"]) {
      try {
        const btn = page.getByRole("button", { name: text, exact: false });
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click();
          await page.waitForTimeout(2000);
          console.log(`  Cookie banner dismissed via: ${text}`);
          break;
        }
      } catch (e) {}
    }

    // Strategy 2: press Escape to dismiss any overlay
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    // Wait before finding form fields
    await page.waitForTimeout(3000);

    // Try multiple selectors for the email field
    const emailSelectors = [
      "#user-email-address",
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
    ];

    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.fill(VECTIS_EMAIL);
          emailFilled = true;
          console.log(`  Email filled using: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    if (!emailFilled) {
      console.error("Could not find email field. Check browser window.");
      await page.waitForTimeout(30000); // pause so you can see the page
      throw new Error("Email field not found");
    }

    // Try multiple selectors for the password field
    const passwordSelectors = ["#password", 'input[type="password"]', 'input[name="password"]'];

    let passwordFilled = false;
    for (const sel of passwordSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.fill(VECTIS_PASSWORD);
          passwordFilled = true;
          console.log(`  Password filled using: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    if (!passwordFilled) {
      console.error("Could not find password field. Check browser window.");
      await page.waitForTimeout(30000);
      throw new Error("Password field not found");
    }

    // Submit login
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"], input[type="submit"], .login-button, [class*="login"]'),
    ]);

    // Verify login by checking URL changed away from login page
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    const isStillOnLogin = currentUrl.includes('view=login') ||
                           currentUrl.includes('com_user');

    if (isStillOnLogin) {
      console.error('Login failed - still on login page. Check credentials.');
      await browser.close();
      process.exit(1);
    }

    console.log('Login successful!\n');

    // ─── Process each record ───────────────────────────────────
    for (const record of records) {
      await sleep(2000, 4000);
      console.log(`Processing: ${record.variant_code} | ${record.lot_ref}`);

      try {
        await page.goto(record.lot_url, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        console.warn(`  ⚠ Failed to load: ${e.message}`);
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

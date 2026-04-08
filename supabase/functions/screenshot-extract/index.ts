import { corsHeaders } from '@supabase/supabase-js/cors'

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const EXTRACTION_PROMPT = `You are a data extraction specialist for vintage Kenner Star Wars action figure auction records. Analyse this screenshot and extract every field you can identify. Return ONLY a JSON object with these fields (use null for anything you cannot determine):

{
  "source": "Heritage | Hakes | LCG | Vectis | CandT | eBay | Facebook | Other",
  "lotRef": "lot number or reference as shown",
  "lotUrl": "URL if visible in the screenshot",
  "saleDate": "YYYY-MM-DD format",
  "era": "SW | ESB | ROTJ | POTF | UNKNOWN",
  "cardbackCode": "e.g. SW-12A, ESB-41, ROTJ-65, POTF-92, or UNKNOWN",
  "variantCode": "e.g. SW-12A, CAN, PAL, MEX, VP, DT, or the cardbackCode if standard",
  "gradeTierCode": "e.g. AFA-85, UKG-80, CAS-80, RAW-NM, or UNKNOWN",
  "hammerPriceRaw": "numeric value as shown, before buyer's premium",
  "hammerCurrency": "GBP | USD",
  "buyersPremiumRate": "decimal, e.g. 0.20 for 20%",
  "totalPaidRaw": "numeric total if shown (hammer + premium)",
  "totalPaidCurrency": "GBP | USD",
  "conditionNotes": "any condition description, grade sub-scores, or notes visible",
  "imageUrls": ["any image URLs visible in the screenshot"],
  "title": "the full lot title as shown"
}

Rules:
- Extract EXACTLY what is visible. Do not guess or fabricate values.
- If you see a price labelled "Price Realized" (Heritage), that is hammer only — note hammerCurrency as USD.
- If you see a price labelled "Sold For" or a single total (Hake's), that typically includes buyer's premium — put it in totalPaidRaw.
- For Vectis, hammer and BP are usually shown separately.
- For UK auction houses (LCG, Vectis, C&T), default hammerCurrency to GBP.
- For US auction houses (Heritage, Hake's), default hammerCurrency to USD.
- Look for AFA, UKG, CAS, or CGA grade numbers and sub-scores (e.g. "AFA 85 C85 B85 F85").
- Look for cardback identifiers: "12-back", "41-back", "65-back", "POTF", "Power of the Force", etc.
- For eBay listings: "Sold for" or "Winning bid" is the total paid (no separate BP). If "Best offer accepted" is shown, use the displayed price as totalPaidRaw and set buyersPremiumRate to 0. Look for the eBay item number (usually 12-13 digits) as lotRef. The sold date is typically shown as "Sold [date]" or "Ended [date]". Currency is inferred from the listing (£ = GBP, $ = USD). eBay listings may show the original listing price — ignore this if a "Sold for" price is also visible.
- For Facebook sold listings: These are unstructured social media posts. Look for price indicators: "SOLD", "GONE", "SPF" (sold pending funds), "SALE AGREED", or a price followed by "sold" / "gone". The price is the total paid (no BP). Currency: default GBP unless $ symbol is explicit. There is no formal lot reference — use the Facebook post ID if visible or generate from date + seller name (e.g. "FB-2026-04-06-JohnSmith"). If the post is "WTB", "WTS" that has NOT sold, or a discussion post with no sale, return: { "error": "not_auction_data" }
- If the screenshot is not an auction listing or does not contain price data, return: { "error": "not_auction_data" }`;

function detectMediaType(base64: string): string {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

function detectSourceFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("ha.com") || lower.includes("historicalauctions.com")) return "Heritage";
  if (lower.includes("hakes.com")) return "Hakes";
  if (lower.includes("lcgauctions.com") || lower.includes("lovecollecting.com")) return "LCG";
  if (lower.includes("vectis.co.uk")) return "Vectis";
  if (lower.includes("candtauctions.co.uk")) return "CandT";
  if (lower.includes("ebay.com") || lower.includes("ebay.co.uk")) return "eBay";
  if (lower.includes("facebook.com")) return "Facebook";
  return "Other";
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function callClaude(content: Array<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: Record<string, string>) => b.type === "text");
  if (!textBlock) throw new Error("No text in Claude response");

  // Extract JSON from response (may be wrapped in ```json ... ```)
  let jsonStr = textBlock.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  return JSON.parse(jsonStr);
}

async function handleImageMode(image: string) {
  if (!image || typeof image !== "string" || image.length < 100) {
    return { success: false, error: "No image provided" };
  }

  // Strip data URI prefix if present
  const base64Data = image.replace(/^data:image\/[a-z+]+;base64,/, "");
  const mediaType = detectMediaType(base64Data);

  const content = [
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
    { type: "text", text: EXTRACTION_PROMPT },
  ];

  const extracted = await callClaude(content);

  if ((extracted as Record<string, string>).error === "not_auction_data") {
    return { success: true, extracted: null, reason: "Could not identify auction data in this image." };
  }

  return { success: true, extracted };
}

async function handleUrlMode(url: string) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { success: false, error: "Please enter a valid web address starting with https://" };
  }

  const detectedSource = detectSourceFromUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return { success: false, error: "This page requires authentication. Please take a screenshot instead." };
    }
    if (res.status === 404) {
      return { success: false, error: "Page not found. Please check the URL." };
    }
    if (!res.ok) {
      return { success: false, error: `Page returned error ${res.status}. Please try a screenshot instead.` };
    }

    html = await res.text();
  } catch (e: unknown) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) {
      return { success: false, error: "The page took too long to load. Please try a screenshot instead." };
    }
    return { success: false, error: "Could not fetch the page. Please try a screenshot instead." };
  }

  const ogImage = extractMetaContent(html, "og:image");
  const ogTitle = extractMetaContent(html, "og:title");
  const canonical = extractMetaContent(html, "og:url") || url;
  const visibleText = stripHtml(html).slice(0, 2000);

  const metadataContext = `\nPage metadata: title=${ogTitle || "unknown"}, url=${canonical}, detected_source=${detectedSource}, page_text_snippet=${visibleText}`;

  let content: Array<Record<string, unknown>>;

  if (ogImage) {
    // Download og:image and convert to base64
    try {
      const imgUrl = ogImage.startsWith("http") ? ogImage : new URL(ogImage, url).href;
      const imgRes = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (imgRes.ok) {
        const imgBuf = await imgRes.arrayBuffer();
        const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
        const mediaType = imgRes.headers.get("content-type") || detectMediaType(imgBase64);
        content = [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imgBase64 } },
          { type: "text", text: EXTRACTION_PROMPT + metadataContext },
        ];
      } else {
        content = [{ type: "text", text: EXTRACTION_PROMPT + metadataContext }];
      }
    } catch {
      content = [{ type: "text", text: EXTRACTION_PROMPT + metadataContext }];
    }
  } else {
    if (!visibleText || visibleText.length < 50) {
      return { success: false, error: "Could not extract any data from this page. Please take a screenshot instead." };
    }
    content = [{ type: "text", text: EXTRACTION_PROMPT + metadataContext }];
  }

  const extracted = await callClaude(content);

  if ((extracted as Record<string, string>).error === "not_auction_data") {
    return { success: true, extracted: null, reason: "Could not identify auction data from this page." };
  }

  // Merge detected source and URL
  if (!extracted.source || extracted.source === "Other") {
    extracted.source = detectedSource;
  }
  if (!extracted.lotUrl) {
    extracted.lotUrl = canonical;
  }

  return { success: true, extracted, sourceUrl: url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { mode } = body;

    let result: Record<string, unknown>;

    if (mode === "image") {
      result = await handleImageMode(body.image);
    } else if (mode === "url") {
      result = await handleUrlMode(body.url);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid mode. Use 'image' or 'url'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("screenshot-extract error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

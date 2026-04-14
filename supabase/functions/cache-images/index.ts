import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth + admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Not authenticated" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { check_user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Not admin" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const source = body.source || "all";
    const limit = Math.min(Number(body.limit) || 50, 200);

    // Fetch lots needing caching
    let query = adminClient
      .from("lots")
      .select("id, lot_ref, source, image_urls")
      .is("cached_image_url", null)
      .neq("image_urls", "{}")
      .limit(limit);

    if (source !== "all") {
      query = query.eq("source", source);
    }

    const { data: lots, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!lots || lots.length === 0) {
      return new Response(JSON.stringify({ success: true, cached: 0, skipped: 0, total: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cached = 0;
    let skipped = 0;

    for (const lot of lots) {
      try {
        const imageUrls = lot.image_urls as string[];
        if (!imageUrls || imageUrls.length === 0) { skipped++; continue; }

        // Pick best image URL (prefer large Vectis images)
        let imgUrl = imageUrls.find((u: string) => /images\/lot\/.*_l\./i.test(u) && u.startsWith("http"));
        if (!imgUrl) imgUrl = imageUrls.find((u: string) => u.startsWith("http"));
        if (!imgUrl) { skipped++; continue; }

        // Fetch image with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const imgRes = await fetch(imgUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; VaderPriceWatch/1.0)" },
        });
        clearTimeout(timeout);

        if (!imgRes.ok) { skipped++; continue; }

        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const buffer = await imgRes.arrayBuffer();
        if (buffer.byteLength < 500) { skipped++; continue; } // Skip tiny/broken images

        // Determine extension
        let ext = "jpg";
        if (contentType.includes("png")) ext = "png";
        else if (contentType.includes("webp")) ext = "webp";

        const srcFolder = (lot.source as string).toLowerCase();
        const safeLotRef = (lot.lot_ref as string).replace(/[^a-zA-Z0-9_-]/g, "_") || lot.id;
        const storagePath = `${srcFolder}/${safeLotRef}.${ext}`;

        // Upload to storage (upsert)
        const { error: uploadErr } = await adminClient.storage
          .from("lot-images")
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadErr) { skipped++; continue; }

        // Get public URL
        const { data: urlData } = adminClient.storage
          .from("lot-images")
          .getPublicUrl(storagePath);

        if (!urlData?.publicUrl) { skipped++; continue; }

        // Update lot record
        const { error: updateErr } = await adminClient
          .from("lots")
          .update({ cached_image_url: urlData.publicUrl })
          .eq("id", lot.id);

        if (updateErr) { skipped++; continue; }

        cached++;
      } catch {
        skipped++;
      }
    }

    return new Response(JSON.stringify({ success: true, cached, skipped, total: lots.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

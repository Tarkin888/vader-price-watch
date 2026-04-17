import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function gate(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: "Not authenticated", status: 401 };
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return { error: "Invalid session", status: 401 };
  const { data: profile } = await supabase
    .from("user_profiles").select("role,status").eq("id", user.id).single();
  if (!profile || profile.status !== "approved" || profile.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }
  return { user };
}

const RANGE_MS: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "all": null,
};

function rangeStart(range: string): string | null {
  const ms = RANGE_MS[range] ?? RANGE_MS["30d"];
  if (ms == null) return null;
  return new Date(Date.now() - ms).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min idle timeout

function maskChatBody(meta: any) {
  if (!meta || typeof meta !== "object") return meta;
  if (meta.body !== undefined || meta.content !== undefined || meta.message !== undefined) {
    const clone = { ...meta };
    if ("body" in clone) clone.body = "[hidden]";
    if ("content" in clone) clone.content = "[hidden]";
    if ("message" in clone) clone.message = "[hidden]";
    return clone;
  }
  return meta;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { pin, action, range = "30d", user_id } = await req.json();
    if (!pin || !action) return json({ error: "Missing pin or action" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await gate(req, supabase);
    if (auth.error) return json({ error: auth.error }, auth.status);

    const { data: pinValid } = await supabase.rpc("verify_admin_pin", { pin_input: pin });
    if (!pinValid) return json({ error: "Invalid PIN" }, 403);

    const since = rangeStart(range);

    // ── KPIS ────────────────────────────────────────────────────
    if (action === "kpis") {
      const day = new Date(Date.now() - DAY_MS).toISOString();
      const week = new Date(Date.now() - 7 * DAY_MS).toISOString();
      const month = new Date(Date.now() - 30 * DAY_MS).toISOString();

      const [d, w, m] = await Promise.all([
        supabase.from("user_activity").select("user_id").gte("created_at", day),
        supabase.from("user_activity").select("user_id").gte("created_at", week),
        supabase.from("user_activity").select("user_id").gte("created_at", month),
      ]);

      const dau = new Set((d.data ?? []).map((r: any) => r.user_id)).size;
      const wau = new Set((w.data ?? []).map((r: any) => r.user_id)).size;
      const mau = new Set((m.data ?? []).map((r: any) => r.user_id)).size;

      // Median session length (auth.login → auth.logout, 30m idle close)
      let sessionQuery = supabase
        .from("user_activity")
        .select("user_id, event_type, created_at")
        .in("event_type", ["auth.login", "auth.logout", "page.view"])
        .order("created_at", { ascending: true });
      if (since) sessionQuery = sessionQuery.gte("created_at", since);
      const { data: sessRows } = await sessionQuery;

      const byUser: Record<string, { t: number; type: string }[]> = {};
      for (const r of sessRows ?? []) {
        const arr = byUser[r.user_id] ?? (byUser[r.user_id] = []);
        arr.push({ t: new Date(r.created_at).getTime(), type: r.event_type });
      }

      const sessionLens: number[] = [];
      for (const events of Object.values(byUser)) {
        let start: number | null = null;
        let last: number | null = null;
        for (const ev of events) {
          if (ev.type === "auth.login") {
            if (start != null && last != null) sessionLens.push(last - start);
            start = ev.t;
            last = ev.t;
          } else if (ev.type === "auth.logout") {
            if (start != null) sessionLens.push(ev.t - start);
            start = null;
            last = null;
          } else {
            // page.view — extends session if within idle window
            if (start == null) {
              start = ev.t;
              last = ev.t;
            } else if (last != null && ev.t - last > SESSION_IDLE_MS) {
              sessionLens.push(last - start);
              start = ev.t;
              last = ev.t;
            } else {
              last = ev.t;
            }
          }
        }
        if (start != null && last != null && last !== start) sessionLens.push(last - start);
      }

      sessionLens.sort((a, b) => a - b);
      const median = sessionLens.length
        ? sessionLens[Math.floor(sessionLens.length / 2)]
        : null;

      return json({ dau, wau, mau, median_session_ms: median, sessions_counted: sessionLens.length });
    }

    // ── PER-USER TABLE ──────────────────────────────────────────
    if (action === "per_user") {
      // Always 30d for table (per spec column headers)
      const monthAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, email, display_name, role, status, last_sign_in_at, created_at");

      const { data: activity } = await supabase
        .from("user_activity")
        .select("user_id, event_type, created_at")
        .gte("created_at", monthAgo);

      type Bucket = {
        last_seen: string | null;
        sessions: Set<string>;
        total: number;
        chat: number;
        added: number;
        edited: number;
        favourites: number;
        notes: number;
      };
      const buckets: Record<string, Bucket> = {};
      for (const r of activity ?? []) {
        const b = buckets[r.user_id] ?? (buckets[r.user_id] = {
          last_seen: null, sessions: new Set(), total: 0,
          chat: 0, added: 0, edited: 0, favourites: 0, notes: 0,
        });
        b.total++;
        if (!b.last_seen || r.created_at > b.last_seen) b.last_seen = r.created_at;
        // crude session bucket = day
        b.sessions.add(r.created_at.slice(0, 10));
        const t = r.event_type;
        if (t === "chat.message") b.chat++;
        else if (t === "record_added" || t === "collection_added" || t === "inventory.add") b.added++;
        else if (t === "record_edited" || t === "collection_edited" || t === "record.edit" || t === "inventory.edit") b.edited++;
        else if (t === "favourite_added" || t === "favourite_removed" || t === "record.favourite") b.favourites++;
        else if (t === "note_created" || t === "note_updated" || t === "note_deleted" || t.startsWith("note.")) b.notes++;
      }

      const rows = (profiles ?? []).map((p: any) => {
        const b = buckets[p.id];
        return {
          user_id: p.id,
          email: p.email,
          display_name: p.display_name,
          role: p.role,
          status: p.status,
          last_seen: b?.last_seen ?? p.last_sign_in_at ?? null,
          sessions_30d: b?.sessions.size ?? 0,
          total_30d: b?.total ?? 0,
          chat_30d: b?.chat ?? 0,
          added_30d: b?.added ?? 0,
          edited_30d: b?.edited ?? 0,
          favourites_30d: b?.favourites ?? 0,
          notes_30d: b?.notes ?? 0,
        };
      });

      return json({ rows });
    }

    // ── USER TIMELINE (last 50) ────────────────────────────────
    if (action === "user_timeline") {
      if (!user_id) return json({ error: "user_id required" }, 400);
      const { data } = await supabase
        .from("user_activity")
        .select("id, event_type, entity_ref, metadata, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(50);

      const masked = (data ?? []).map((r: any) => ({
        ...r,
        metadata: r.event_type === "chat.message" ? maskChatBody(r.metadata) : r.metadata,
      }));
      return json({ events: masked });
    }

    // ── CHARTS ──────────────────────────────────────────────────
    if (action === "charts") {
      let q = supabase.from("user_activity").select("user_id, event_type, metadata, created_at");
      if (since) q = q.gte("created_at", since);
      const { data: rows } = await q;
      const events = rows ?? [];

      // Daily Active Users — last 30d (overrides range for this metric)
      const dauStart = Date.now() - 30 * DAY_MS;
      const dauMap: Record<string, Set<string>> = {};
      for (const e of events) {
        const t = new Date(e.created_at).getTime();
        if (t < dauStart) continue;
        const day = e.created_at.slice(0, 10);
        (dauMap[day] ?? (dauMap[day] = new Set())).add(e.user_id);
      }
      const dauSeries = Object.entries(dauMap)
        .map(([day, set]) => ({ day, dau: set.size }))
        .sort((a, b) => a.day.localeCompare(b.day));

      // Events per day by type
      const stackMap: Record<string, Record<string, number>> = {};
      const typeSet = new Set<string>();
      for (const e of events) {
        const day = e.created_at.slice(0, 10);
        const slot = stackMap[day] ?? (stackMap[day] = {});
        slot[e.event_type] = (slot[e.event_type] ?? 0) + 1;
        typeSet.add(e.event_type);
      }
      const stacked = Object.entries(stackMap)
        .map(([day, counts]) => ({ day, ...counts }))
        .sort((a: any, b: any) => a.day.localeCompare(b.day));
      const eventTypes = [...typeSet];

      // Top pages — last 7d, page.view only
      const weekStart = Date.now() - 7 * DAY_MS;
      const pageMap: Record<string, { count: number; total_dur: number; samples: number }> = {};
      for (const e of events) {
        if (e.event_type !== "page.view") continue;
        if (new Date(e.created_at).getTime() < weekStart) continue;
        const path = (e.metadata as any)?.path ?? "/";
        const dur = Number((e.metadata as any)?.duration_ms ?? 0);
        const slot = pageMap[path] ?? (pageMap[path] = { count: 0, total_dur: 0, samples: 0 });
        slot.count++;
        if (dur > 0) { slot.total_dur += dur; slot.samples++; }
      }
      const topPages = Object.entries(pageMap)
        .map(([path, s]) => ({ path, count: s.count, avg_duration_ms: s.samples ? Math.round(s.total_dur / s.samples) : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Chat volume — messages/day + avg length
      const chatMap: Record<string, { count: number; total_len: number }> = {};
      for (const e of events) {
        if (e.event_type !== "chat.message") continue;
        const day = e.created_at.slice(0, 10);
        const slot = chatMap[day] ?? (chatMap[day] = { count: 0, total_len: 0 });
        slot.count++;
        slot.total_len += Number((e.metadata as any)?.length ?? 0);
      }
      const chatSeries = Object.entries(chatMap)
        .map(([day, s]) => ({ day, messages: s.count, avg_length: s.count ? Math.round(s.total_len / s.count) : 0 }))
        .sort((a, b) => a.day.localeCompare(b.day));

      return json({ dauSeries, stacked, eventTypes, topPages, chatSeries });
    }

    // ── FUNNEL ──────────────────────────────────────────────────
    if (action === "funnel") {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, created_at");

      const { data: activity } = await supabase
        .from("user_activity")
        .select("user_id, event_type, created_at");

      const byUser: Record<string, any[]> = {};
      for (const r of activity ?? []) {
        (byUser[r.user_id] ?? (byUser[r.user_id] = [])).push(r);
      }

      const totalSignups = (profiles ?? []).length;
      let firstLogin = 0;
      let firstScrapeOrImport = 0;
      let firstInventoryAdd = 0;
      let returnedDay7 = 0;

      for (const p of profiles ?? []) {
        const events = byUser[p.id] ?? [];
        const hasLogin = events.some((e) => e.event_type === "auth.login");
        const hasScrape = events.some((e) => e.event_type === "scrape_run" || e.event_type === "scrape.run");
        const hasInv = events.some((e) =>
          e.event_type === "collection_added" || e.event_type === "inventory.add" || e.event_type === "inventory.csv_import"
        );

        if (hasLogin) firstLogin++;
        if (hasScrape || hasInv) firstScrapeOrImport++;
        if (hasInv) firstInventoryAdd++;

        const created = new Date(p.created_at).getTime();
        const day7Start = created + 6 * DAY_MS;
        const day7End = created + 8 * DAY_MS;
        if (events.some((e) => {
          const t = new Date(e.created_at).getTime();
          return t >= day7Start && t <= day7End;
        })) returnedDay7++;
      }

      const steps = [
        { label: "Signups", count: totalSignups },
        { label: "First Login", count: firstLogin },
        { label: "First Scrape / Import", count: firstScrapeOrImport },
        { label: "First Inventory Add", count: firstInventoryAdd },
        { label: "Returned Day 7", count: returnedDay7 },
      ];
      return json({ steps });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-activity error:", e);
    return json({ error: "Server error" }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Kenny — the Imperial Price Terminal's AI assistant and an expert on vintage Kenner Star Wars Darth Vader mint-on-card (MOC) action figures and the auction price data tracked by this app. Always introduce yourself as Kenny when greeting users.

You help users with three core tasks:
1. PRICE QUERIES — Answer questions about auction data by generating structured queries. When a user asks about prices, sales, or market data, respond with your conversational text FIRST, then on a new line output a [PRICE_QUERY] block with a closing [/PRICE_QUERY] tag. Example format:

Here's what I found for ESB-41 sales:

[PRICE_QUERY]
{ "type": "price_query", "filters": { "cardback_code": "ESB-41" }, "aggregation": "highest", "limit": 1 }
[/PRICE_QUERY]

Available filter fields: era, cardback_code, source, grade_tier_code, variant_code, date_from, date_to. Only populate filters the user mentions. IMPORTANT: You MUST include both the opening [PRICE_QUERY] and closing [/PRICE_QUERY] tags.

FOLLOW-UP QUERIES: When a user says things like "list them", "show them", "what are they", "show me", "which ones" after a count or summary query, you should output a [FOLLOW_UP_LIST] tag (no body needed). This tells the system to re-run the previous query as a list. Example:

Here are those records:

[FOLLOW_UP_LIST][/FOLLOW_UP_LIST]

If the follow-up adds a new constraint (e.g. "list the ones over £2000"), output a [PRICE_QUERY] block but ONLY include the additional filter. The system will merge it with the cached filters. Add "merge_with_previous": true to signal this:

[PRICE_QUERY]
{ "type": "price_query", "filters": { "min_price": 2000 }, "aggregation": "list", "merge_with_previous": true }
[/PRICE_QUERY]

2. BUG REPORTS — If a user describes a problem with the app, DO NOT immediately generate a [BUG_REPORT] block. Instead, follow this two-step process:

   Step 1 (first response): Acknowledge the issue and ask clarifying questions to gather enough detail for a useful report. Ask about:
   - When did this happen (date/time or "just now")?
   - Which page or feature were they using?
   - What did they expect to happen vs what actually happened?
   - Are there specific lot references, cardback codes, or sources involved?
   Do NOT include a [BUG_REPORT] block in this response.

   Step 2 (after the user replies with details): Now generate the [BUG_REPORT] block with the full context gathered from both messages:
   { "type": "bug_report", "category": "SCRAPER|UI|CLASSIFIER|DATA|PRICING|GENERAL", "title": "<concise summary>", "description": "<full detail incorporating the user's answers>", "priority": "LOW|MEDIUM|HIGH|CRITICAL" }

   Only generate the [BUG_REPORT] block once you have enough detail. If the user's first message already contains all the necessary information (specific lots, dates, expected vs actual behaviour), you may generate the block in your first response — but this should be rare.

3. APP FEEDBACK — If a user offers feedback, a feature request, or a data correction, gather details and output a [FEEDBACK] block: { "type": "feedback", "feedback_type": "FEATURE_REQUEST|APP_FEEDBACK|DATA_ISSUE|OTHER", "category": "SCRAPER|UI|CLASSIFIER|DATA|PRICING|GENERAL", "title": "", "description": "" }.

Style rules:
- Use UK English spelling and grammar.
- Be concise — 2-3 sentences max for simple answers.
- Use the app's terminology: cardback codes (SW-12A, ESB-41, ROTJ-65, POTF-92), grade tiers (AFA-85, UKG-80, RAW-NM), era codes (SW, ESB, ROTJ, POTF), and source names (Heritage, Hakes, LCG, Vectis, C&T).
- Prices are always in GBP.
- If you don't know something, say so — don't fabricate data.
- Never output raw SQL. Always use the structured JSON blocks above.
- You can only READ data — never suggest you can modify or delete records.`;

function enhanceMessage(message: string): string {
  const notes: string[] = [];

  if (/twelve back|12[ -]?back/i.test(message)) {
    notes.push("Note: '12 back' / 'twelve back' refers to a cardback type (e.g. SW-12A, SW-12B).");
  }
  if (/\bempire\b/i.test(message) && !/\besb\b/i.test(message)) {
    notes.push("Note: 'Empire' likely refers to era ESB (The Empire Strikes Back).");
  }
  if (/\b(jedi|return)\b/i.test(message) && !/\brotj\b/i.test(message)) {
    notes.push("Note: 'Jedi'/'Return' likely refers to era ROTJ (Return of the Jedi).");
  }
  if (/power of the force/i.test(message) && !/\bpotf\b/i.test(message)) {
    notes.push("Note: 'Power of the Force' refers to era POTF.");
  }
  if (/\bstar wars\b/i.test(message) && !/\bsw\b/i.test(message) && !/empire|jedi|return|potf/i.test(message)) {
    notes.push("Note: 'Star Wars' alone likely refers to era SW (original Star Wars line).");
  }
  if (/\b(graded)\b/i.test(message) && !/afa|ukg|cas/i.test(message)) {
    notes.push("Note: 'graded' without a specific agency means all graded tiers (AFA, UKG, CAS).");
  }
  if (/\b(raw|ungraded)\b/i.test(message)) {
    notes.push("Note: 'raw'/'ungraded' refers to RAW grade tiers (RAW-NM, RAW-EX, RAW-VG).");
  }

  if (notes.length > 0) {
    return `${notes.join(" ")}\n\nUser message: ${message}`;
  }
  return message;
}

function parseActionBlocks(content: string) {
  const priceMatch = content.match(/\[PRICE_QUERY\]([\s\S]*?)\[\/PRICE_QUERY\]/) ||
    content.match(/\[PRICE_QUERY\]([\s\S]*$)/);
  const bugMatch = content.match(/\[BUG_REPORT\]([\s\S]*?)\[\/BUG_REPORT\]/) ||
    content.match(/\[BUG_REPORT\]([\s\S]*$)/);
  const feedbackMatch = content.match(/\[FEEDBACK\]([\s\S]*?)\[\/FEEDBACK\]/) ||
    content.match(/\[FEEDBACK\]([\s\S]*$)/);
  const followUpMatch = /\[FOLLOW_UP_LIST\]/.test(content);

  return {
    priceQuery: priceMatch ? JSON.parse(priceMatch[1].trim()) : null,
    bugReport: bugMatch ? JSON.parse(bugMatch[1].trim()) : null,
    feedback: feedbackMatch ? JSON.parse(feedbackMatch[1].trim()) : null,
    followUpList: followUpMatch,
  };
}

function stripActionBlocks(content: string): string {
  return content
    .replace(/\[PRICE_QUERY\][\s\S]*?(\[\/PRICE_QUERY\]|$)/g, "")
    .replace(/\[BUG_REPORT\][\s\S]*?(\[\/BUG_REPORT\]|$)/g, "")
    .replace(/\[FEEDBACK\][\s\S]*?(\[\/FEEDBACK\]|$)/g, "")
    .replace(/\[FOLLOW_UP_LIST\][\s\S]*?(\[\/FOLLOW_UP_LIST\]|$)/g, "")
    .trim();
}

function applyFilters(q: any, filters: any) {
  if (filters.era) q = q.eq("era", filters.era);
  if (filters.cardback_code) q = q.ilike("cardback_code", filters.cardback_code);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.grade_tier_code) q = q.eq("grade_tier_code", filters.grade_tier_code);
  if (filters.variant_code) q = q.eq("variant_code", filters.variant_code);
  if (filters.date_from) q = q.gte("sale_date", filters.date_from);
  if (filters.date_to) q = q.lte("sale_date", filters.date_to);
  if (filters.min_price) q = q.gte("total_paid_gbp", filters.min_price);
  if (filters.max_price) q = q.lte("total_paid_gbp", filters.max_price);
  q = q.not("total_paid_gbp", "is", null).gt("total_paid_gbp", 0);
  return q;
}

function buildFilterLabel(filters: any): string {
  const parts: string[] = [];
  if (filters.cardback_code) parts.push(filters.cardback_code);
  if (filters.variant_code && filters.variant_code !== filters.cardback_code) parts.push(filters.variant_code);
  if (filters.era) parts.push(filters.era);
  if (filters.grade_tier_code) parts.push(filters.grade_tier_code);
  if (filters.source) parts.push(filters.source);
  if (filters.date_from && filters.date_to) {
    const yearFrom = filters.date_from.substring(0, 4);
    const yearTo = filters.date_to.substring(0, 4);
    parts.push(yearFrom === yearTo ? yearFrom : `${yearFrom}–${yearTo}`);
  } else if (filters.date_from) {
    parts.push(`from ${filters.date_from.substring(0, 4)}`);
  } else if (filters.date_to) {
    parts.push(`to ${filters.date_to.substring(0, 4)}`);
  }
  if (filters.min_price) parts.push(`≥£${filters.min_price}`);
  if (filters.max_price) parts.push(`≤£${filters.max_price}`);
  return parts.join(" · ");
}

async function executePriceQuery(
  supabase: ReturnType<typeof createClient>,
  query: any
) {
  const filters = query.filters || {};
  const aggregation = query.aggregation || "list";
  const limit = Math.min(query.limit || 10, 25);

  // COUNT
  if (aggregation === "count") {
    let q = supabase.from("lots").select("*", { count: "exact", head: true });
    q = applyFilters(q, filters);
    const { count, error } = await q;
    if (error) throw error;

    // Also fetch the IDs for caching
    let idsQ = supabase.from("lots").select("id");
    idsQ = applyFilters(idsQ, filters);
    const { data: idRows } = await idsQ;
    const cachedIds = (idRows || []).map((r: any) => r.id);

    return {
      results: { count: count || 0 },
      resultCount: count || 0,
      totalMatches: count || 0,
      cachedIds,
    };
  }

  // AVERAGE
  if (aggregation === "average") {
    let countQ = supabase.from("lots").select("*", { count: "exact", head: true });
    countQ = applyFilters(countQ, filters);
    const { count: totalCount, error: countErr } = await countQ;
    if (countErr) throw countErr;

    const allValues: number[] = [];
    const pageSize = 1000;
    const total = totalCount || 0;
    for (let offset = 0; offset < total; offset += pageSize) {
      let q = supabase.from("lots").select("total_paid_gbp");
      q = applyFilters(q, filters);
      q = q.range(offset, offset + pageSize - 1);
      const { data, error } = await q;
      if (error) throw error;
      for (const r of (data || [])) {
        allValues.push(Number(r.total_paid_gbp));
      }
    }

    const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
    return {
      results: { average: Math.round(avg * 100) / 100, count: allValues.length },
      resultCount: allValues.length,
      totalMatches: total,
    };
  }

  // LIST / HIGHEST / LOWEST
  const selectCols =
    "id, sale_date, source, era, cardback_code, variant_code, grade_tier_code, total_paid_gbp, hammer_price_gbp, lot_ref, lot_url, image_urls, condition_notes";

  let q = supabase.from("lots").select(selectCols, { count: "exact" });
  q = applyFilters(q, filters);
  q = q.order("sale_date", { ascending: false });

  if (aggregation === "highest") {
    q = q.order("total_paid_gbp", { ascending: false }).limit(1);
  } else if (aggregation === "lowest") {
    q = q.order("total_paid_gbp", { ascending: true }).limit(1);
  } else {
    q = q.limit(limit);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    results: data || [],
    resultCount: (data || []).length,
    totalMatches: count || 0,
  };
}

// Fetch cached records by IDs
async function fetchByIds(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
  extraFilters?: any,
  limit = 25
) {
  const selectCols =
    "id, sale_date, source, era, cardback_code, variant_code, grade_tier_code, total_paid_gbp, hammer_price_gbp, lot_ref, lot_url, image_urls, condition_notes";

  let q = supabase.from("lots").select(selectCols, { count: "exact" }).in("id", ids);

  // Apply any extra filters (e.g. min_price from follow-up)
  if (extraFilters) {
    if (extraFilters.min_price) q = q.gte("total_paid_gbp", extraFilters.min_price);
    if (extraFilters.max_price) q = q.lte("total_paid_gbp", extraFilters.max_price);
    if (extraFilters.source) q = q.eq("source", extraFilters.source);
    if (extraFilters.grade_tier_code) q = q.eq("grade_tier_code", extraFilters.grade_tier_code);
  }

  q = q.order("sale_date", { ascending: false }).limit(limit);
  const { data, error, count } = await q;
  if (error) throw error;
  return { results: data || [], resultCount: (data || []).length, totalMatches: count || 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { sessionId, message, context } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    // 1. Create or use session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: session, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert({ session_type: "GENERAL", status: "ACTIVE", metadata: {}, user_id: userId })
        .select("id")
        .single();
      if (sessionErr) throw sessionErr;
      currentSessionId = session.id;
    }

    // Load session metadata (contains cached filters)
    const { data: sessionData } = await supabase
      .from("chat_sessions")
      .select("metadata")
      .eq("id", currentSessionId)
      .single();
    const sessionMeta: any = sessionData?.metadata || {};

    // 2. Insert user message
    const enhancedMessage = enhanceMessage(message);
    await supabase.from("chat_messages").insert({
      session_id: currentSessionId,
      role: "user",
      content: message,
      message_type: "TEXT",
      metadata: context ? { context } : {},
    });

    // 3. Load last 20 messages
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", currentSessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversationHistory = (history || []).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    if (conversationHistory.length > 0) {
      conversationHistory[conversationHistory.length - 1].content = enhancedMessage;
    }

    // Inject context about cached filters so Claude knows about them
    let systemWithContext = SYSTEM_PROMPT;
    if (sessionMeta.cached_filters) {
      const label = buildFilterLabel(sessionMeta.cached_filters);
      const count = sessionMeta.cached_ids?.length || 0;
      systemWithContext += `\n\nCONTEXT: The previous query used filters: ${JSON.stringify(sessionMeta.cached_filters)} and returned ${count} records. The filter label is "${label}". If the user asks to list/show/enumerate these results, output [FOLLOW_UP_LIST][/FOLLOW_UP_LIST]. If they add a constraint, use merge_with_previous.`;
    }

    // 4. Call Anthropic
    let claudeResponse: any;
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemWithContext,
          messages: conversationHistory,
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic error:", anthropicRes.status, errText);
        const errorMsg = {
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          message_type: "ERROR",
          metadata: {},
        };
        await supabase.from("chat_messages").insert({
          session_id: currentSessionId,
          ...errorMsg,
        });
        return new Response(
          JSON.stringify({ sessionId: currentSessionId, message: errorMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      claudeResponse = await anthropicRes.json();
    } catch (e) {
      console.error("Anthropic fetch error:", e);
      const errorMsg = {
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        message_type: "ERROR",
        metadata: {},
      };
      await supabase.from("chat_messages").insert({
        session_id: currentSessionId,
        ...errorMsg,
      });
      return new Response(
        JSON.stringify({ sessionId: currentSessionId, message: errorMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawContent = claudeResponse.content?.[0]?.text || "";

    // 5. Parse action blocks
    let actions: any;
    try {
      actions = parseActionBlocks(rawContent);
    } catch (e) {
      console.error("Failed to parse action blocks:", e);
      actions = { priceQuery: null, bugReport: null, feedback: null, followUpList: false };
    }

    let responseContent = stripActionBlocks(rawContent) || rawContent;
    let messageType = "TEXT";
    let messageMetadata: any = {};

    // 6a. Handle follow-up list (re-use cached filters/IDs)
    if (actions.followUpList && sessionMeta.cached_ids?.length > 0) {
      const queryCount = sessionMeta.price_query_count || 0;
      if (queryCount >= 10) {
        responseContent = "You've reached the query limit for this session. Please start a new chat or use the Price Tracker page directly.";
        messageType = "ERROR";
      } else {
        try {
          const queryResult = await fetchByIds(supabase as any, sessionMeta.cached_ids);
          messageType = "PRICE_RESULT";
          messageMetadata = {
            query: sessionMeta.cached_filters || {},
            aggregation: "list",
            results: queryResult.results,
            resultCount: queryResult.resultCount,
            totalMatches: queryResult.totalMatches,
            activeFilter: buildFilterLabel(sessionMeta.cached_filters || {}),
          };
          responseContent = `Here are all ${queryResult.totalMatches} matching record${queryResult.totalMatches === 1 ? "" : "s"}:`;

          await supabase
            .from("chat_sessions")
            .update({ metadata: { ...sessionMeta, price_query_count: queryCount + 1 } })
            .eq("id", currentSessionId);
        } catch (e) {
          console.error("Follow-up list error:", e);
          responseContent = "I had trouble retrieving those records. Please try again.";
          messageType = "ERROR";
        }
      }
    }
    // 6b. Handle price query (new or merged)
    else if (actions.priceQuery) {
      const queryCount = sessionMeta.price_query_count || 0;

      if (queryCount >= 10) {
        responseContent = "You've reached the query limit for this session. Please start a new chat or use the Price Tracker page directly.";
        messageType = "ERROR";
      } else {
        // Merge with previous filters if requested
        let effectiveFilters = actions.priceQuery.filters || {};
        if (actions.priceQuery.merge_with_previous && sessionMeta.cached_filters) {
          effectiveFilters = { ...sessionMeta.cached_filters, ...effectiveFilters };
        }

        // If merge + cached IDs, filter within cached set
        if (actions.priceQuery.merge_with_previous && sessionMeta.cached_ids?.length > 0) {
          try {
            const extraFilters = actions.priceQuery.filters || {};
            const queryResult = await fetchByIds(supabase as any, sessionMeta.cached_ids, extraFilters);
            messageType = "PRICE_RESULT";
            messageMetadata = {
              query: effectiveFilters,
              aggregation: "list",
              results: queryResult.results,
              resultCount: queryResult.resultCount,
              totalMatches: queryResult.totalMatches,
              activeFilter: buildFilterLabel(effectiveFilters),
            };
            if (queryResult.resultCount === 0) {
              responseContent = "None of the previous results matched that additional filter.";
            } else {
              responseContent = `Here are ${queryResult.totalMatches} matching record${queryResult.totalMatches === 1 ? "" : "s"}:`;
            }
            await supabase
              .from("chat_sessions")
              .update({
                session_type: "PRICE_QUERY",
                metadata: { ...sessionMeta, price_query_count: queryCount + 1 },
              })
              .eq("id", currentSessionId);
          } catch (e) {
            console.error("Merged query error:", e);
            responseContent = "I had trouble running that query. Please try again.";
            messageType = "ERROR";
          }
        } else {
          // Fresh query
          const fullQuery = { ...actions.priceQuery, filters: effectiveFilters };
          try {
            const queryResult = await executePriceQuery(supabase as any, fullQuery);
            messageType = "PRICE_RESULT";

            // Cache filters and IDs in session
            const newCachedIds = queryResult.cachedIds ||
              (Array.isArray(queryResult.results) ? queryResult.results.map((r: any) => r.id).filter(Boolean) : []);

            const updatedMeta = {
              ...sessionMeta,
              price_query_count: queryCount + 1,
              cached_filters: effectiveFilters,
              cached_ids: newCachedIds,
            };

            messageMetadata = {
              query: effectiveFilters,
              aggregation: fullQuery.aggregation || "list",
              results: queryResult.results,
              resultCount: queryResult.resultCount,
              totalMatches: queryResult.totalMatches,
              activeFilter: buildFilterLabel(effectiveFilters),
            };

            await supabase
              .from("chat_sessions")
              .update({ session_type: "PRICE_QUERY", metadata: updatedMeta })
              .eq("id", currentSessionId);

            if (queryResult.resultCount === 0) {
              responseContent = "I couldn't find any matching records. Try broadening your search.";
            } else {
              const agg = fullQuery.aggregation || "list";
              if (agg === "count") {
                const cnt = (queryResult.results as any)?.count ?? queryResult.resultCount;
                responseContent = `I found ${cnt} matching record${cnt === 1 ? "" : "s"}.`;
              } else if (agg === "average") {
                const cnt = (queryResult.results as any)?.count ?? queryResult.resultCount;
                responseContent = `Here's the average across ${cnt} sale${cnt === 1 ? "" : "s"}:`;
              } else {
                responseContent = `I found ${queryResult.totalMatches} matching record${queryResult.totalMatches === 1 ? "" : "s"}. Here are the results:`;
              }
            }
          } catch (e) {
            console.error("Price query error:", e);
            responseContent = "I had trouble running that query. Please try again or use the Price Tracker page directly.";
            messageType = "ERROR";
          }
        }
      }
    }

    // 7. Handle bug report
    if (actions.bugReport) {
      try {
        const { data: bugRow } = await supabase.from("chatbot_feedback").insert({
          session_id: currentSessionId,
          feedback_type: "BUG",
          category: actions.bugReport.category || "GENERAL",
          title: actions.bugReport.title,
          description: actions.bugReport.description,
          priority: actions.bugReport.priority || "MEDIUM",
          status: "OPEN",
        }).select("id").single();
        await supabase
          .from("chat_sessions")
          .update({ session_type: "BUG_REPORT" })
          .eq("id", currentSessionId);
        messageType = "BUG_REPORT";
        messageMetadata.bugReportId = bugRow?.id || null;
      } catch (e) {
        console.error("Bug report insert error:", e);
      }
    }

    // 8. Handle feedback
    if (actions.feedback) {
      try {
        const { data: fbRow } = await supabase.from("chatbot_feedback").insert({
          session_id: currentSessionId,
          feedback_type: actions.feedback.feedback_type || "OTHER",
          category: actions.feedback.category || "GENERAL",
          title: actions.feedback.title,
          description: actions.feedback.description,
          status: "OPEN",
          priority: "MEDIUM",
        }).select("id").single();
        await supabase
          .from("chat_sessions")
          .update({ session_type: "FEEDBACK" })
          .eq("id", currentSessionId);
        messageType = "FEEDBACK";
        messageMetadata.feedbackId = fbRow?.id || null;
      } catch (e) {
        console.error("Feedback insert error:", e);
      }
    }

    // 9. Insert assistant message
    const assistantMsg = {
      role: "assistant",
      content: responseContent,
      message_type: messageType,
      metadata: messageMetadata,
    };
    await supabase.from("chat_messages").insert({
      session_id: currentSessionId,
      ...assistantMsg,
    });

    // 10. Session summary at 10 messages
    const { count: msgCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", currentSessionId);

    if (msgCount && msgCount >= 10) {
      const { data: sessionCheck } = await supabase
        .from("chat_sessions")
        .select("summary")
        .eq("id", currentSessionId)
        .single();

      if (!sessionCheck?.summary) {
        try {
          const summaryRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 50,
              system: "Summarise this conversation in under 15 words.",
              messages: conversationHistory,
            }),
          });
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            const summary = summaryData.content?.[0]?.text || "";
            if (summary) {
              await supabase
                .from("chat_sessions")
                .update({ summary })
                .eq("id", currentSessionId);
            }
          }
        } catch (e) {
          console.error("Summary generation error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ sessionId: currentSessionId, message: assistantMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Chat function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

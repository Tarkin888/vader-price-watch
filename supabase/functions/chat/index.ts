import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the Imperial Price Terminal Assistant — an expert on vintage Kenner Star Wars Darth Vader mint-on-card (MOC) action figures and the auction price data tracked by this app.

You help users with three core tasks:
1. PRICE QUERIES — Answer questions about auction data by generating structured queries. When a user asks about prices, sales, or market data, respond with your conversational text FIRST, then on a new line output a [PRICE_QUERY] block with a closing [/PRICE_QUERY] tag. Example format:

Here's what I found for ESB-41 sales:

[PRICE_QUERY]
{ "type": "price_query", "filters": { "cardback_code": "ESB-41" }, "aggregation": "highest", "limit": 1 }
[/PRICE_QUERY]

Available filter fields: era, cardback_code, source, grade_tier_code, variant_code, date_from, date_to. Only populate filters the user mentions. IMPORTANT: You MUST include both the opening [PRICE_QUERY] and closing [/PRICE_QUERY] tags.

2. BUG REPORTS — If a user describes a problem with the app, gather details (what happened, what they expected, which page/feature), then output a [BUG_REPORT] block: { "type": "bug_report", "category": "SCRAPER|UI|CLASSIFIER|DATA|PRICING|GENERAL", "title": "", "description": "", "priority": "LOW|MEDIUM|HIGH|CRITICAL" }.

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
  const lower = message.toLowerCase();
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
  // Try with closing tag first, then fall back to unclosed block (to end of string)
  const priceMatch = content.match(/\[PRICE_QUERY\]([\s\S]*?)\[\/PRICE_QUERY\]/) ||
    content.match(/\[PRICE_QUERY\]([\s\S]*$)/);
  const bugMatch = content.match(/\[BUG_REPORT\]([\s\S]*?)\[\/BUG_REPORT\]/) ||
    content.match(/\[BUG_REPORT\]([\s\S]*$)/);
  const feedbackMatch = content.match(/\[FEEDBACK\]([\s\S]*?)\[\/FEEDBACK\]/) ||
    content.match(/\[FEEDBACK\]([\s\S]*$)/);

  return {
    priceQuery: priceMatch ? JSON.parse(priceMatch[1].trim()) : null,
    bugReport: bugMatch ? JSON.parse(bugMatch[1].trim()) : null,
    feedback: feedbackMatch ? JSON.parse(feedbackMatch[1].trim()) : null,
  };
}

function stripActionBlocks(content: string): string {
  return content
    .replace(/\[PRICE_QUERY\][\s\S]*?(\[\/PRICE_QUERY\]|$)/g, "")
    .replace(/\[BUG_REPORT\][\s\S]*?(\[\/BUG_REPORT\]|$)/g, "")
    .replace(/\[FEEDBACK\][\s\S]*?(\[\/FEEDBACK\]|$)/g, "")
    .trim();
}

async function executePriceQuery(
  supabase: ReturnType<typeof createClient>,
  query: any
) {
  const filters = query.filters || {};
  const aggregation = query.aggregation || "list";
  const limit = Math.min(query.limit || 10, 25);

  const selectCols =
    "sale_date, source, era, cardback_code, variant_code, grade_tier_code, total_paid_gbp, hammer_price_gbp, lot_ref, lot_url, image_urls, condition_notes";

  let q = supabase.from("lots").select(selectCols, { count: "exact" });

  // Apply filters
  if (filters.era) q = q.ilike("era", filters.era);
  if (filters.cardback_code) q = q.ilike("cardback_code", filters.cardback_code);
  if (filters.source) q = q.ilike("source", filters.source);
  if (filters.grade_tier_code) q = q.ilike("grade_tier_code", filters.grade_tier_code);
  if (filters.variant_code) q = q.ilike("variant_code", filters.variant_code);
  if (filters.date_from) q = q.gte("sale_date", filters.date_from);
  if (filters.date_to) q = q.lte("sale_date", filters.date_to);

  // Exclude null/zero prices
  q = q.not("total_paid_gbp", "is", null).gt("total_paid_gbp", 0);

  // Order
  q = q.order("sale_date", { ascending: false });

  if (aggregation === "list") {
    q = q.limit(limit);
  } else if (aggregation === "highest") {
    q = q.order("total_paid_gbp", { ascending: false }).limit(1);
  } else if (aggregation === "lowest") {
    q = q.order("total_paid_gbp", { ascending: true }).limit(1);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  if (aggregation === "average") {
    const totalMatches = count || 0;
    // Need all values for average - re-query just the column
    let avgQ = supabase.from("lots").select("total_paid_gbp");
    if (filters.era) avgQ = avgQ.ilike("era", filters.era);
    if (filters.cardback_code) avgQ = avgQ.ilike("cardback_code", filters.cardback_code);
    if (filters.source) avgQ = avgQ.ilike("source", filters.source);
    if (filters.grade_tier_code) avgQ = avgQ.ilike("grade_tier_code", filters.grade_tier_code);
    if (filters.variant_code) avgQ = avgQ.ilike("variant_code", filters.variant_code);
    if (filters.date_from) avgQ = avgQ.gte("sale_date", filters.date_from);
    if (filters.date_to) avgQ = avgQ.lte("sale_date", filters.date_to);
    avgQ = avgQ.not("total_paid_gbp", "is", null).gt("total_paid_gbp", 0);

    const { data: avgData, error: avgError } = await avgQ;
    if (avgError) throw avgError;

    const values = (avgData || []).map((r: any) => Number(r.total_paid_gbp));
    const avg = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;

    return {
      results: { average: Math.round(avg * 100) / 100, count: values.length },
      resultCount: values.length,
      totalMatches,
    };
  }

  if (aggregation === "count") {
    return {
      results: { count: count || 0 },
      resultCount: count || 0,
      totalMatches: count || 0,
    };
  }

  return {
    results: data || [],
    resultCount: (data || []).length,
    totalMatches: count || 0,
  };
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

    // 1. Create or use session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: session, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert({ session_type: "GENERAL", status: "ACTIVE", metadata: {} })
        .select("id")
        .single();
      if (sessionErr) throw sessionErr;
      currentSessionId = session.id;
    }

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

    // Replace last user message with enhanced version for Claude
    if (conversationHistory.length > 0) {
      conversationHistory[conversationHistory.length - 1].content = enhancedMessage;
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
          system: SYSTEM_PROMPT,
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
      actions = { priceQuery: null, bugReport: null, feedback: null };
    }

    let responseContent = stripActionBlocks(rawContent) || rawContent;
    let messageType = "TEXT";
    let messageMetadata: any = {};

    // 6. Handle price query
    if (actions.priceQuery) {
      // Check rate limit
      const { data: sessionData } = await supabase
        .from("chat_sessions")
        .select("metadata")
        .eq("id", currentSessionId)
        .single();

      const sessionMeta = sessionData?.metadata || {};
      const queryCount = (sessionMeta as any).price_query_count || 0;

      if (queryCount >= 10) {
        responseContent =
          "You've reached the query limit for this session. Please start a new chat or use the Price Tracker page directly.";
        messageType = "ERROR";
      } else {
        try {
          const queryResult = await executePriceQuery(supabase, actions.priceQuery);
          messageType = "PRICE_RESULT";
          messageMetadata = {
            query: actions.priceQuery.filters || {},
            aggregation: actions.priceQuery.aggregation || "list",
            results: queryResult.results,
            resultCount: queryResult.resultCount,
            totalMatches: queryResult.totalMatches,
          };

          // Update query count
          await supabase
            .from("chat_sessions")
            .update({
              session_type: "PRICE_QUERY",
              metadata: { ...(sessionMeta as object), price_query_count: queryCount + 1 },
            })
            .eq("id", currentSessionId);

          if (queryResult.resultCount === 0) {
            responseContent =
              "I couldn't find any matching records. Try broadening your search — perhaps widen the date range or remove a filter.";
          }
        } catch (e) {
          console.error("Price query error:", e);
          responseContent =
            "I had trouble running that query. Please try again or use the Price Tracker page directly.";
          messageType = "ERROR";
        }
      }
    }

    // 7. Handle bug report
    if (actions.bugReport) {
      try {
        await supabase.from("chatbot_feedback").insert({
          session_id: currentSessionId,
          feedback_type: "BUG",
          category: actions.bugReport.category || "GENERAL",
          title: actions.bugReport.title,
          description: actions.bugReport.description,
          priority: actions.bugReport.priority || "MEDIUM",
          status: "OPEN",
        });
        await supabase
          .from("chat_sessions")
          .update({ session_type: "BUG_REPORT" })
          .eq("id", currentSessionId);
        messageType = "BUG_REPORT";
      } catch (e) {
        console.error("Bug report insert error:", e);
      }
    }

    // 8. Handle feedback
    if (actions.feedback) {
      try {
        await supabase.from("chatbot_feedback").insert({
          session_id: currentSessionId,
          feedback_type: actions.feedback.feedback_type || "OTHER",
          category: actions.feedback.category || "GENERAL",
          title: actions.feedback.title,
          description: actions.feedback.description,
          status: "OPEN",
          priority: "MEDIUM",
        });
        await supabase
          .from("chat_sessions")
          .update({ session_type: "FEEDBACK" })
          .eq("id", currentSessionId);
        messageType = "FEEDBACK";
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

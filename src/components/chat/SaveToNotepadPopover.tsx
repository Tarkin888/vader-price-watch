import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "./ChatProvider";
import { logActivity } from "@/lib/activity-log";
import { toast } from "sonner";
import { X, Save, Search } from "lucide-react";
import { VARIANT_CODES, GRADE_TIER_CODES, SOURCES } from "@/types/lot";

const MAX_NOTES = 100;
const WARN_THRESHOLD = 90;
const RECENT_LOTS_KEY = "kenny:recentlyViewedLots";
const RECENT_LIMIT = 20;

interface LotPick {
  lot_ref: string;
  source: string;
  cardback_code: string | null;
}

interface Props {
  assistantContent: string;
  precedingUserQuestion: string;
  metadata: any;
  onClose: () => void;
}

const ERA_CODES = ["SW", "ESB", "ROTJ", "POTF"];
const CARDBACK_CODES = [
  "SW-12", "SW-12A", "SW-12B", "SW-12C", "SW-12A-DT", "SW-12B-DT", "SW-20", "SW-21", "SW-21A", "SW-21B", "SW-21C", "SW-21D", "SW-21E", "SW-21F", "SW-21G",
  "ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48",
  "ROTJ-48", "ROTJ-65", "ROTJ-77", "ROTJ-79", "POTF-92",
];

function autoDetectTags(text: string): string[] {
  const found = new Set<string>();
  const upper = text.toUpperCase();
  for (const code of CARDBACK_CODES) {
    if (upper.includes(code)) found.add(code.toLowerCase());
  }
  for (const code of GRADE_TIER_CODES) {
    if (upper.includes(code)) found.add(code.toLowerCase());
  }
  for (const code of VARIANT_CODES) {
    if (upper.includes(code)) found.add(code.toLowerCase());
  }
  for (const era of ERA_CODES) {
    const re = new RegExp(`\\b${era}\\b`);
    if (re.test(upper)) found.add(era.toLowerCase());
  }
  for (const src of SOURCES) {
    if (upper.includes(src.toUpperCase())) found.add(src.toLowerCase());
  }
  return [...found];
}

function getRecentLots(): LotPick[] {
  try {
    const raw = localStorage.getItem(RECENT_LOTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export default function SaveToNotepadPopover({
  assistantContent,
  precedingUserQuestion,
  metadata,
  onClose,
}: Props) {
  const { profile } = useAuth();
  const { sessionId } = useChat();
  const navigate = useNavigate();

  const initialTitle = (precedingUserQuestion || "Note from Kenny").slice(0, 60);
  const initialAutoTags = useMemo(
    () => ["kenny", ...autoDetectTags(assistantContent)],
    [assistantContent]
  );

  // Prefill linked lot from metadata if Kenny supplied one
  const metadataLot: LotPick | null = useMemo(() => {
    if (!metadata) return null;
    if (metadata.lot_ref && metadata.source) {
      return {
        lot_ref: String(metadata.lot_ref),
        source: String(metadata.source),
        cardback_code: metadata.cardback_code ?? null,
      };
    }
    return null;
  }, [metadata]);

  const [title, setTitle] = useState(initialTitle);
  const [tagsInput, setTagsInput] = useState(initialAutoTags.join(", "));
  const [linkedLot, setLinkedLot] = useState<LotPick | null>(metadataLot);
  const [lotQuery, setLotQuery] = useState("");
  const [lotResults, setLotResults] = useState<LotPick[]>([]);
  const [recentLots, setRecentLots] = useState<LotPick[]>(getRecentLots);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Backfill the recents list from the user's recent record_viewed activity
  useEffect(() => {
    if (!profile || recentLots.length >= RECENT_LIMIT) return;
    let cancelled = false;
    (async () => {
      const { data: views } = await supabase
        .from("user_activity" as any)
        .select("entity_ref, metadata, created_at")
        .eq("user_id", profile.id)
        .in("event_type", ["record_viewed", "record.view"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled || !views || views.length === 0) return;
      const seen = new Set<string>();
      const refs: string[] = [];
      for (const v of views as any[]) {
        const ref = v.entity_ref as string | null;
        if (!ref || seen.has(ref)) continue;
        seen.add(ref);
        refs.push(ref);
        if (refs.length >= RECENT_LIMIT) break;
      }
      if (refs.length === 0) return;
      const { data: lots } = await supabase
        .from("lots")
        .select("lot_ref, source, cardback_code")
        .in("lot_ref", refs);
      if (cancelled || !lots) return;
      // Preserve recency order
      const map = new Map((lots as LotPick[]).map((l) => [l.lot_ref, l]));
      const ordered = refs.map((r) => map.get(r)).filter(Boolean) as LotPick[];
      if (ordered.length > 0) setRecentLots(ordered);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Search lots when user types (full RLS-scoped search, not capped to 20)
  useEffect(() => {
    let cancelled = false;
    const q = lotQuery.trim();
    if (q.length < 2) {
      setLotResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("lots")
        .select("lot_ref, source, cardback_code")
        .ilike("lot_ref", `%${q}%`)
        .limit(25);
      if (!cancelled) setLotResults((data || []) as LotPick[]);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [lotQuery]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!profile) {
      toast.error("Sign in to save notes");
      navigate("/auth");
      return;
    }
    if (saving) return;
    setSaving(true);

    // Count notes BEFORE writing
    const { count, error: countErr } = await supabase
      .from("user_notes" as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id);

    if (countErr) {
      toast.error("Failed to check note count");
      setSaving(false);
      return;
    }

    const current = count ?? 0;
    if (current >= MAX_NOTES) {
      toast.error(`Notepad is full (${MAX_NOTES}/${MAX_NOTES}). Delete or archive an entry first.`);
      setSaving(false);
      return;
    }

    const parsedTags = [
      ...new Set(
        tagsInput
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    if (!parsedTags.includes("kenny")) parsedTags.unshift("kenny");

    const insertPayload: any = {
      user_id: profile.id,
      title: (title || "Note from Kenny").slice(0, 200),
      body: assistantContent,
      tags: parsedTags,
      pinned: false,
      linked_lot_ref: linkedLot?.lot_ref ?? null,
      linked_lot_source: linkedLot?.source ?? null,
      source_context: {
        source: "kenny_chat",
        question: precedingUserQuestion || null,
        chat_session_id: sessionId,
        timestamp: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from("user_notes" as any)
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      if (error.message?.includes("limit: 100")) {
        toast.error(`Notepad is full (${MAX_NOTES}/${MAX_NOTES}). Delete or archive an entry first.`);
      } else {
        toast.error("Failed to save note");
      }
      setSaving(false);
      return;
    }

    const newId = (data as any)?.id as string | undefined;
    logActivity("note.create_from_kenny", newId ?? null, {
      note_id: newId,
      chat_session_id: sessionId,
    });

    setSaving(false);
    onClose();

    if (current + 1 >= WARN_THRESHOLD) {
      toast.warning(`You're at ${current + 1}/${MAX_NOTES} notes — consider tidying up soon`, {
        action: newId
          ? { label: "View", onClick: () => navigate(`/notepad?noteId=${newId}`) }
          : undefined,
      });
    } else {
      toast.success("Saved to Notepad", {
        action: newId
          ? { label: "View", onClick: () => navigate(`/notepad?noteId=${newId}`) }
          : undefined,
      });
    }
  };

  const pickLot = (lot: LotPick) => {
    setLinkedLot(lot);
    setShowPicker(false);
    setLotQuery("");
    setLotResults([]);
  };

  const visibleList: LotPick[] = lotQuery.trim().length >= 2 ? lotResults : recentLots;

  return (
    <div
      ref={popoverRef}
      className="mt-2 p-3 rounded-lg text-[12px]"
      style={{
        background: "#0D0D0A",
        border: "1px solid rgba(201,168,76,0.3)",
        color: "#e0d8c0",
        fontFamily: "Courier New, monospace",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] tracking-wider" style={{ color: "#C9A84C" }}>
          SAVE TO NOTEPAD
        </span>
        <button onClick={onClose} aria-label="Close" className="opacity-60 hover:opacity-100">
          <X size={12} />
        </button>
      </div>

      {/* Title */}
      <label className="block text-[10px] tracking-widest opacity-70 mb-1">TITLE</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        className="w-full px-2 py-1 mb-2 rounded text-[12px] outline-none"
        style={{
          background: "#1A1A16",
          border: "1px solid rgba(201,168,76,0.2)",
          color: "#e0d8c0",
        }}
      />

      {/* Tags */}
      <label className="block text-[10px] tracking-widest opacity-70 mb-1">TAGS</label>
      <input
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="kenny, sw-12, afa-85..."
        className="w-full px-2 py-1 mb-2 rounded text-[12px] outline-none"
        style={{
          background: "#1A1A16",
          border: "1px solid rgba(201,168,76,0.2)",
          color: "#e0d8c0",
        }}
      />

      {/* Linked lot */}
      <label className="block text-[10px] tracking-widest opacity-70 mb-1">LINK TO LOT</label>
      {linkedLot ? (
        <div
          className="flex items-center justify-between px-2 py-1 mb-2 rounded text-[11px]"
          style={{ background: "#1A1A16", border: "1px solid rgba(201,168,76,0.2)" }}
        >
          <span>
            <span style={{ color: "#C9A84C" }}>{linkedLot.source}</span> · {linkedLot.lot_ref}
            {linkedLot.cardback_code ? ` · ${linkedLot.cardback_code}` : ""}
          </span>
          <button
            onClick={() => setLinkedLot(null)}
            className="opacity-60 hover:opacity-100"
            aria-label="Remove lot link"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <div className="relative mb-2">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded"
            style={{ background: "#1A1A16", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <Search size={10} className="opacity-50" />
            <input
              value={lotQuery}
              onChange={(e) => {
                setLotQuery(e.target.value);
                setShowPicker(true);
              }}
              onFocus={() => setShowPicker(true)}
              placeholder="Search any lot, or pick from recent..."
              className="flex-1 bg-transparent outline-none text-[11px]"
              style={{ color: "#e0d8c0" }}
            />
          </div>
          {showPicker && visibleList.length > 0 && (
            <div
              className="absolute z-50 left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded"
              style={{ background: "#0D0D0A", border: "1px solid rgba(201,168,76,0.3)" }}
            >
              {lotQuery.trim().length < 2 && (
                <div
                  className="px-2 py-1 text-[9px] tracking-widest opacity-60"
                  style={{ borderBottom: "1px solid rgba(201,168,76,0.15)" }}
                >
                  RECENTLY VIEWED
                </div>
              )}
              {visibleList.map((lot, i) => (
                <button
                  key={`${lot.source}-${lot.lot_ref}-${i}`}
                  onClick={() => pickLot(lot)}
                  className="w-full text-left px-2 py-1 text-[11px] hover:bg-[#1A1A16]"
                  style={{ color: "#e0d8c0" }}
                >
                  <span style={{ color: "#C9A84C" }}>{lot.source}</span> · {lot.lot_ref}
                  {lot.cardback_code ? ` · ${lot.cardback_code}` : ""}
                </button>
              ))}
            </div>
          )}
          {showPicker && visibleList.length === 0 && lotQuery.trim().length >= 2 && (
            <div
              className="absolute z-50 left-0 right-0 mt-1 px-2 py-1.5 rounded text-[10px] opacity-70"
              style={{ background: "#0D0D0A", border: "1px solid rgba(201,168,76,0.3)" }}
            >
              No matching lots
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="px-3 py-1 rounded text-[11px] tracking-wider"
          style={{ color: "#e0d8c0", border: "1px solid rgba(201,168,76,0.2)" }}
        >
          CANCEL
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded text-[11px] tracking-wider flex items-center gap-1"
          style={{
            background: "#C9A84C",
            color: "#080806",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Save size={11} />
          {saving ? "SAVING..." : "SAVE"}
        </button>
      </div>
    </div>
  );
}

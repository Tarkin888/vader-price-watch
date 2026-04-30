import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Pin, PinOff, Plus, Search, Trash2, Copy, X, ExternalLink, StickyNote, Download, Upload,
} from "lucide-react";
import { logActivity } from "@/lib/activity-log";
import NotepadImportModal from "@/components/NotepadImportModal";

/* ── types ── */
interface Note {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tags: string[] | null;
  linked_lot_ref: string | null;
  linked_lot_source: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  source_context: { source?: string; question?: string; chat_session_id?: string; timestamp?: string } | null;
}

interface LinkedLot {
  lot_ref: string;
  source: string;
  cardback_code: string;
  total_paid_gbp: number | null;
  sale_date: string;
}

const SOURCE_COLORS: Record<string, string> = {
  Heritage: "#4A90D9", Hakes: "#5BA55B", LCG: "#D4A843",
  Vectis: "#C75050", CandT: "#8B5CF6", "C&T": "#8B5CF6",
};
const MAX_NOTES = 100;
const WARN_THRESHOLD = 90;
const AUTOSAVE_MS = 2000;
const MAX_BODY = 10000;
const MAX_TITLE = 200;

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function Notepad() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  // Editor state
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editLinkedRef, setEditLinkedRef] = useState<string | null>(null);
  const [editLinkedSource, setEditLinkedSource] = useState<string | null>(null);
  const [linkedLot, setLinkedLot] = useState<LinkedLot | null>(null);

  // Lot search
  const [lotSearchQuery, setLotSearchQuery] = useState("");
  const [lotSearchResults, setLotSearchResults] = useState<LinkedLot[]>([]);
  const [lotSearchOpen, setLotSearchOpen] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Autosave
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Import modal
  const [importOpen, setImportOpen] = useState(false);

  // Refs for keyboard
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const count = notes.length;
  const isFull = count >= MAX_NOTES;
  const isNearFull = count >= WARN_THRESHOLD && !isFull;

  // ── Load notes ──
  const fetchNotes = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from("user_notes" as any)
      .select("*")
      .eq("user_id", profile.id)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Failed to load notes:", error);
      toast.error("Failed to load notes");
      return;
    }
    setNotes((data as unknown as Note[]) || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Auto-select note from ?noteId= deep link (e.g. from Kenny "Save to Notepad" toast)
  useEffect(() => {
    const target = searchParams.get("noteId");
    if (!target || notes.length === 0) return;
    const match = notes.find((n) => n.id === target);
    if (match && match.id !== selectedId) {
      selectNote(match);
      // Clear the param so refresh doesn't keep re-selecting
      const next = new URLSearchParams(searchParams);
      next.delete("noteId");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, searchParams]);

  // ── Select a note ──
  const selectNote = useCallback((note: Note) => {
    // Save current if dirty before switching
    if (isDirty.current && selectedId) {
      saveNote(selectedId);
    }
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditTags((note.tags || []).join(", "));
    setEditPinned(note.pinned);
    setEditLinkedRef(note.linked_lot_ref);
    setEditLinkedSource(note.linked_lot_source);
    setLastSaved(null);
    isDirty.current = false;
    setMobileView("editor");

    // Fetch linked lot details
    if (note.linked_lot_ref) {
      fetchLinkedLot(note.linked_lot_ref, note.linked_lot_source);
    } else {
      setLinkedLot(null);
    }
  }, [selectedId]);

  const fetchLinkedLot = async (ref: string, source: string | null) => {
    let q = supabase.from("lots").select("lot_ref, source, cardback_code, total_paid_gbp, sale_date").eq("lot_ref", ref);
    if (source) q = q.eq("source", source as any);
    const { data } = await q.limit(1);
    setLinkedLot(data?.[0] as LinkedLot | null ?? null);
  };

  // ── Create note ──
  const createNote = async () => {
    if (!profile || isFull) return;
    const newNote = {
      user_id: profile.id,
      title: "Untitled note",
      body: "",
      tags: null,
      linked_lot_ref: null,
      linked_lot_source: null,
      pinned: false,
    };
    const { data, error } = await supabase
      .from("user_notes" as any)
      .insert(newNote)
      .select("*")
      .single();
    if (error) {
      if (error.message?.includes("limit: 100")) {
        toast.error("Notepad full — delete an entry before adding a new one.");
      } else {
        toast.error("Failed to create note");
      }
      return;
    }
    const created = data as unknown as Note;
    setNotes((prev) => [created, ...prev]);
    selectNote(created);
    logActivity("note_created", created.id);
    toast.success("Note created");
  };

  // ── Save note ──
  const saveNote = async (noteId?: string) => {
    const id = noteId || selectedId;
    if (!id) return;
    setSaving(true);

    const parsedTags = editTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    const uniqueTags = [...new Set(parsedTags)];

    const update = {
      title: editTitle.slice(0, MAX_TITLE) || "Untitled note",
      body: editBody.slice(0, MAX_BODY),
      tags: uniqueTags.length > 0 ? uniqueTags : null,
      pinned: editPinned,
      linked_lot_ref: editLinkedRef,
      linked_lot_source: editLinkedSource,
    };

    const { error } = await supabase
      .from("user_notes" as any)
      .update(update)
      .eq("id", id);

    if (error) {
      toast.error("Failed to save note");
      setSaving(false);
      return;
    }

    setNotes((prev) =>
      prev.map((n) => n.id === id ? { ...n, ...update, updated_at: new Date().toISOString() } : n)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
    );
    isDirty.current = false;
    setLastSaved(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setSaving(false);
    logActivity("note_updated", id);
  };

  // ── Autosave ──
  const scheduleAutosave = useCallback(() => {
    isDirty.current = true;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (isDirty.current && selectedId) {
        saveNote(selectedId);
      }
    }, AUTOSAVE_MS);
  }, [selectedId, editTitle, editBody, editTags, editPinned, editLinkedRef]);

  // ── Delete note ──
  const deleteNote = async () => {
    if (!selectedId) return;
    const { error } = await supabase
      .from("user_notes" as any)
      .delete()
      .eq("id", selectedId);
    if (error) {
      toast.error("Failed to delete note");
      return;
    }
    logActivity("note_deleted", selectedId);
    setNotes((prev) => prev.filter((n) => n.id !== selectedId));
    setSelectedId(null);
    setDeleteConfirmOpen(false);
    setMobileView("list");
    toast.success("Note deleted");
  };

  // ── Duplicate note ──
  const duplicateNote = async () => {
    if (!selectedId || !profile || isFull) return;
    const source = notes.find((n) => n.id === selectedId);
    if (!source) return;

    const newNote = {
      user_id: profile.id,
      title: `${source.title} (copy)`.slice(0, MAX_TITLE),
      body: source.body,
      tags: source.tags,
      linked_lot_ref: source.linked_lot_ref,
      linked_lot_source: source.linked_lot_source,
      pinned: false,
    };

    const { data, error } = await supabase
      .from("user_notes" as any)
      .insert(newNote)
      .select("*")
      .single();

    if (error) {
      if (error.message?.includes("limit: 100")) {
        toast.error("Notepad full — delete an entry before adding a new one.");
      } else {
        toast.error("Failed to duplicate note");
      }
      return;
    }
    const created = data as unknown as Note;
    setNotes((prev) => [created, ...prev]);
    selectNote(created);
    logActivity("note_created", created.id);
    toast.success("Note duplicated");
  };

  // ── Lot search ──
  const searchLots = async (query: string) => {
    setLotSearchQuery(query);
    if (query.length < 2) { setLotSearchResults([]); return; }
    const { data } = await supabase
      .from("lots")
      .select("lot_ref, source, cardback_code, total_paid_gbp, sale_date")
      .ilike("lot_ref", `%${query}%`)
      .limit(10);
    setLotSearchResults((data || []) as LinkedLot[]);
  };

  const linkLot = (lot: LinkedLot) => {
    setEditLinkedRef(lot.lot_ref);
    setEditLinkedSource(lot.source);
    setLinkedLot(lot);
    setLotSearchOpen(false);
    setLotSearchQuery("");
    setLotSearchResults([]);
    scheduleAutosave();
  };

  const unlinkLot = () => {
    setEditLinkedRef(null);
    setEditLinkedSource(null);
    setLinkedLot(null);
    scheduleAutosave();
  };

  // ── Export to Markdown ──
  const escapeYaml = (v: string) => v.replace(/"/g, '\\"');
  const handleExport = () => {
    if (notes.length === 0) return;

    // Sort: pinned DESC, updated_at DESC. Cap at 100 as safety.
    const sorted = [...notes]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 100);

    const blocks = sorted.map((n) => {
      const tagsArr = (n.tags ?? []).map((t) => `"${escapeYaml(t)}"`).join(", ");
      const origin = n.source_context?.source ?? "manual";
      const linked = n.linked_lot_ref ?? "";
      return [
        "---",
        `title: "${escapeYaml(n.title || "Untitled note")}"`,
        `tags: [${tagsArr}]`,
        `pinned: ${n.pinned ? "true" : "false"}`,
        `linked_lot: "${escapeYaml(linked)}"`,
        `source: "${escapeYaml(origin)}"`,
        `created: ${new Date(n.created_at).toISOString()}`,
        `updated: ${new Date(n.updated_at).toISOString()}`,
        "---",
        "",
        n.body ?? "",
      ].join("\n");
    });

    const md = blocks.join("\n\n---\n\n") + "\n";

    const today = new Date().toLocaleDateString("en-GB").split("/").reverse().join("-"); // YYYY-MM-DD
    const filename = `imperial-notepad-${today}.md`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);

    logActivity("notepad.export", null, { count: sorted.length });
    toast.success(`Exported ${sorted.length} note${sorted.length === 1 ? "" : "s"} to ${filename}`);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "n" && !isInput && !isFull) {
        e.preventDefault();
        createNote();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFull, profile]);

  // ── Filtered & sorted list ──
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const n of notes) {
      for (const t of n.tags || []) tagSet.add(t);
    }
    return [...tagSet].sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeTag) {
      result = result.filter((n) => (n.tags || []).includes(activeTag));
    }
    return result;
  }, [notes, searchQuery, activeTag]);

  const selectedNote = notes.find((n) => n.id === selectedId) || null;

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header totalRecords={0} lastScrapeDate={null} />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-primary tracking-widest">NOTEPAD</h1>
            <p className={`text-[10px] tracking-wider mt-0.5 ${
              isFull ? "text-destructive font-bold" : isNearFull ? "text-yellow-500" : "text-muted-foreground"
            }`}>
              {count} / {MAX_NOTES} entries used
            </p>
          </div>
          {/* Mobile toggle */}
          {selectedId && (
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-[10px] tracking-wider"
              onClick={() => setMobileView(mobileView === "list" ? "editor" : "list")}
            >
              {mobileView === "list" ? "EDITOR" : "LIST"}
            </Button>
          )}
        </div>

        {/* Capacity banners */}
        {isNearFull && (
          <div className="mb-3 px-3 py-2 rounded border text-[10px] tracking-wider"
            style={{ background: "rgba(234, 179, 8, 0.1)", borderColor: "rgba(234, 179, 8, 0.3)", color: "rgb(234, 179, 8)" }}>
            You're close to your 100-entry limit. Consider tidying old notes.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-[30%_1fr] gap-4">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[30%_1fr] gap-4" style={{ minHeight: "calc(100vh - 200px)" }}>
            {/* ── List pane ── */}
            <div className={`flex flex-col border border-border rounded-lg overflow-hidden bg-card ${
              mobileView === "editor" && selectedId ? "hidden md:flex" : "flex"
            }`}>
              {/* Search + New */}
              <div className="p-2 border-b border-border space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search notes... ( / )"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 h-7 text-xs bg-secondary border-border"
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={isFull}
                        onClick={createNote}
                      >
                        <Plus size={14} />
                      </Button>
                    </TooltipTrigger>
                    {isFull && <TooltipContent>Notepad full — delete an entry first</TooltipContent>}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={isFull}
                        onClick={() => setImportOpen(true)}
                        aria-label="Import notes from Markdown"
                      >
                        <Upload size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFull ? "Notepad full — delete an entry first" : "Import notes (.md)"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={notes.length === 0}
                        onClick={handleExport}
                        aria-label="Export notes to Markdown"
                      >
                        <Download size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {notes.length === 0 ? "No notes to export" : "Export all notes (.md)"}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Tag chips */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                        className={`px-1.5 py-0.5 rounded text-[9px] tracking-wider transition-colors ${
                          activeTag === tag
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Note list */}
              <div ref={listRef} className="flex-1 overflow-y-auto">
                {filteredNotes.length === 0 ? (
                  <div className="p-4 text-center">
                    <StickyNote size={24} className="mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-[10px] text-muted-foreground italic">
                      {notes.length === 0 ? "No notes yet. Press N or + to create one." : "No matching notes."}
                    </p>
                  </div>
                ) : (
                  filteredNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => selectNote(note)}
                      className={`w-full text-left px-3 py-2.5 border-b border-border transition-colors hover:bg-secondary/50 ${
                        selectedId === note.id ? "bg-secondary" : ""
                      }`}
                      style={note.pinned ? { borderLeft: "3px solid hsl(43, 50%, 54%)" } : undefined}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {note.pinned && <Pin size={10} className="text-primary shrink-0" />}
                        <span className="text-xs font-medium text-foreground truncate">{note.title}</span>
                        {note.source_context?.source === "kenny_chat" && (
                          <span
                            className="shrink-0 px-1 py-0.5 rounded text-[8px] tracking-wider"
                            style={{
                              background: "rgba(201,168,76,0.15)",
                              color: "hsl(43, 50%, 54%)",
                              border: "1px solid rgba(201,168,76,0.35)",
                            }}
                            title="Saved from a Kenny chat reply"
                          >
                            FROM KENNY
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{note.body || "Empty note"}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {(note.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className="px-1 py-0.5 rounded bg-secondary text-[8px] text-muted-foreground">{t}</span>
                        ))}
                        {note.linked_lot_ref && (
                          <span
                            className="px-1 py-0.5 rounded text-[8px] text-white"
                            style={{ backgroundColor: SOURCE_COLORS[note.linked_lot_source || ""] || "#666" }}
                          >
                            {note.linked_lot_ref}
                          </span>
                        )}
                        <span className="ml-auto text-[9px] text-muted-foreground">{relativeTime(note.updated_at)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ── Editor pane ── */}
            <div className={`flex flex-col border border-border rounded-lg bg-card overflow-hidden ${
              mobileView === "list" && selectedId ? "hidden md:flex" : !selectedId ? "hidden md:flex" : "flex"
            }`}>
              {!selectedId ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <StickyNote size={32} className="mx-auto mb-2 text-muted-foreground opacity-20" />
                    <p className="text-xs text-muted-foreground">Select a note or press N to create one</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Editor toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Button variant="default" size="sm" className="h-7 text-[10px] tracking-wider" onClick={() => saveNote()} disabled={saving}>
                        {saving ? "SAVING..." : "SAVE"}
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={duplicateNote} disabled={isFull}>
                            <Copy size={12} />
                          </Button>
                        </TooltipTrigger>
                        {isFull && <TooltipContent>Notepad full — delete an entry first</TooltipContent>}
                      </Tooltip>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {lastSaved && (
                        <span className="text-[9px] text-muted-foreground">Saved {lastSaved}</span>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 md:hidden" onClick={() => { setMobileView("list"); }}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Editor fields */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* From Kenny badge + quoted question */}
                    {selectedNote?.source_context?.source === "kenny_chat" && (
                      <div
                        className="px-3 py-2 rounded"
                        style={{
                          background: "rgba(201,168,76,0.08)",
                          border: "1px solid rgba(201,168,76,0.25)",
                        }}
                      >
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[9px] tracking-wider mb-1.5"
                          style={{
                            background: "rgba(201,168,76,0.2)",
                            color: "hsl(43, 50%, 54%)",
                            border: "1px solid rgba(201,168,76,0.4)",
                          }}
                        >
                          FROM KENNY
                        </span>
                        {selectedNote.source_context.question && (
                          <div className="text-[11px] text-muted-foreground italic leading-snug">
                            <span className="opacity-70">You asked Kenny: </span>
                            "{selectedNote.source_context.question}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Title */}
                    <div>
                      <label className="text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">Title *</label>
                      <Input
                        value={editTitle}
                        onChange={(e) => { setEditTitle(e.target.value); scheduleAutosave(); }}
                        maxLength={MAX_TITLE}
                        className="bg-secondary border-border text-xs tracking-wider h-8"
                        placeholder="Note title..."
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <label className="text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">Body *</label>
                      <Textarea
                        value={editBody}
                        onChange={(e) => { setEditBody(e.target.value); scheduleAutosave(); }}
                        maxLength={MAX_BODY}
                        className="bg-secondary border-border text-xs tracking-wider min-h-[200px] resize-y"
                        placeholder="Write your note..."
                      />
                      <p className={`text-[9px] mt-0.5 ${editBody.length > MAX_BODY * 0.9 ? "text-yellow-500" : "text-muted-foreground"}`}>
                        {editBody.length} / {MAX_BODY}
                      </p>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">Tags (comma-separated)</label>
                      <Input
                        value={editTags}
                        onChange={(e) => { setEditTags(e.target.value); scheduleAutosave(); }}
                        className="bg-secondary border-border text-xs tracking-wider h-8"
                        placeholder="e.g. sw-12, research, pricing"
                      />
                      {editTags && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {[...new Set(editTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-secondary text-[9px] text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Linked lot */}
                    <div>
                      <label className="text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">Linked Lot</label>
                      {linkedLot ? (
                        <Card className="bg-secondary border-border p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="px-1.5 py-0.5 rounded text-[9px] text-white mr-1.5"
                                style={{ backgroundColor: SOURCE_COLORS[linkedLot.source] || "#666" }}>
                                {linkedLot.source === "CandT" ? "C&T" : linkedLot.source}
                              </span>
                              <span className="text-foreground">{linkedLot.cardback_code}</span>
                              {linkedLot.total_paid_gbp && (
                                <span className="text-primary font-bold ml-2">
                                  £{linkedLot.total_paid_gbp.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                              <span className="text-muted-foreground ml-2">
                                {new Date(linkedLot.sale_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <a href={`/?search=${linkedLot.lot_ref}`} className="text-muted-foreground hover:text-foreground">
                                <ExternalLink size={12} />
                              </a>
                              <button onClick={unlinkLot} className="text-muted-foreground hover:text-destructive">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </Card>
                      ) : (
                        <div className="relative">
                          <Input
                            value={lotSearchQuery}
                            onChange={(e) => searchLots(e.target.value)}
                            onFocus={() => setLotSearchOpen(true)}
                            className="bg-secondary border-border text-xs tracking-wider h-8"
                            placeholder="Search by lot ref..."
                          />
                          {lotSearchOpen && lotSearchResults.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto">
                              {lotSearchResults.map((lot, i) => (
                                <button
                                  key={`${lot.lot_ref}-${lot.source}-${i}`}
                                  onClick={() => linkLot(lot)}
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary border-b border-border last:border-0"
                                >
                                  <span className="px-1 py-0.5 rounded text-[8px] text-white mr-1"
                                    style={{ backgroundColor: SOURCE_COLORS[lot.source] || "#666" }}>
                                    {lot.source}
                                  </span>
                                  {lot.lot_ref} — {lot.cardback_code}
                                  {lot.total_paid_gbp && (
                                    <span className="text-primary ml-1">
                                      £{lot.total_paid_gbp.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pinned */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pinned"
                        checked={editPinned}
                        onCheckedChange={(checked) => { setEditPinned(!!checked); scheduleAutosave(); }}
                      />
                      <label htmlFor="pinned" className="text-[10px] text-muted-foreground tracking-widest uppercase cursor-pointer flex items-center gap-1">
                        {editPinned ? <Pin size={10} className="text-primary" /> : <PinOff size={10} />}
                        Pin this note
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card border-border max-w-sm" aria-describedby="delete-note-desc">
          <DialogHeader>
            <DialogTitle className="text-primary tracking-wider text-sm">DELETE NOTE</DialogTitle>
            <DialogDescription id="delete-note-desc">
              Are you sure you want to delete "{selectedNote?.title}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" className="text-xs tracking-wider" onClick={() => setDeleteConfirmOpen(false)}>CANCEL</Button>
            <Button variant="destructive" size="sm" className="text-xs tracking-wider" onClick={deleteNote}>DELETE</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

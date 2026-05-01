import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Pencil, Trash2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";
import ChangelogPolishPreview from "./ChangelogPolishPreview";

interface ChangelogEntry {
  id: string;
  version: string;
  release_date: string;
  title: string;
  category: string;
  description: string;
  created_at: string;
}

const CATEGORIES = ["Feature", "Fix", "Improvement", "Security", "Data"];

/** Increment patch segment of a semver-ish string. v7.1.0 → v7.1.1, 7.0 → 7.0.1. */
function incrementPatch(v: string): string {
  if (!v) return "";
  const prefix = v.startsWith("v") ? "v" : "";
  const core = v.replace(/^v/, "").trim();
  const parts = core.split(".");
  if (parts.length === 0 || parts.length > 3) return "";
  while (parts.length < 3) parts.push("0");
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return "";
  nums[2] = nums[2] + 1;
  return prefix + nums.join(".");
}

const AdminChangelogTab = () => {
  const { profile, user } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [version, setVersion] = useState("");
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Feature");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");

  // Polish state
  const [polishing, setPolishing] = useState(false);
  const [polishedText, setPolishedText] = useState<string | null>(null);
  const [polishOriginal, setPolishOriginal] = useState<string>("");
  const [usedPolish, setUsedPolish] = useState(false);

  // Track if form has been manually edited (dirty) so we don't overwrite on prefill
  const dirtyRef = useRef(false);
  const prefilledRef = useRef(false);

  const markDirty = () => { dirtyRef.current = true; };

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase
        .from("changelog")
        .select("*")
        .order("release_date", { ascending: false });
      const rows = (data ?? []) as ChangelogEntry[];
      setEntries(rows);

      // Auto-prefill on clean form open (not editing, not dirty)
      if (!editingId && !dirtyRef.current && rows.length > 0 && !prefilledRef.current) {
        const next = incrementPatch(rows[0].version);
        setVersion(next);
        setReleaseDate(new Date().toISOString().split("T")[0]);
        prefilledRef.current = true;
      }
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, [editingId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Prefill author from signed-in admin
  useEffect(() => {
    if (!author && (profile?.display_name || user?.email)) {
      setAuthor(profile?.display_name || user?.email || "");
    }
  }, [profile, user, author]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategory("Feature");
    setDescription("");
    setReleaseDate(new Date().toISOString().split("T")[0]);
    setPolishedText(null);
    setPolishOriginal("");
    setUsedPolish(false);
    dirtyRef.current = false;
    prefilledRef.current = false;
    // Re-trigger prefill
    fetchAll();
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("changelog").update({
          version, release_date: releaseDate, title, category, description,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Entry updated");
      } else {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const { error } = await supabase.from("changelog").insert({
          version, release_date: releaseDate, title, category, description,
          created_by: authUser?.id,
        });
        if (error) throw error;
        toast.success("Entry added");
        logActivity("changelog.entry_created", version, {
          version, category, used_polish: usedPolish,
        });
      }
      resetForm();
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ChangelogEntry) => {
    setEditingId(entry.id);
    setVersion(entry.version);
    setReleaseDate(entry.release_date);
    setTitle(entry.title);
    setCategory(entry.category);
    setDescription(entry.description);
    setPolishedText(null);
    setUsedPolish(false);
    dirtyRef.current = true;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("changelog").delete().eq("id", deleteId);
    if (error) {
      toast.error("Delete failed: " + error.message);
    } else {
      toast.success("Entry deleted");
      fetchAll();
    }
    setDeleteId(null);
  };

  const handlePolish = async () => {
    if (!description.trim()) {
      toast.error("Write a description before polishing");
      return;
    }
    if (description.length > 10000) {
      toast.error("Description exceeds 10,000 characters");
      return;
    }
    const pin = sessionStorage.getItem("admin_pin") ?? "";
    if (!pin) {
      toast.error("No admin PIN — authenticate via Admin Dashboard first");
      return;
    }
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("changelog-polish", {
        body: { pin, text: description },
        headers: { "x-admin-pin": pin },
      });
      if (error) {
        // Try to extract structured error
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.clone) {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (!data?.polished) throw new Error(data?.error || "Empty polish response");
      setPolishOriginal(description);
      setPolishedText(data.polished);
    } catch (e: any) {
      toast.error("Polish failed: " + (e?.message || "Unknown error"));
    } finally {
      setPolishing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, fontSize: 13, minHeight: 44, width: "100%",
  };

  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading changelog…</p>;

  return (
    <div className="space-y-6 relative">
      <button onClick={fetchAll} className="absolute top-0 right-0 p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
        <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
      </button>

      {/* Form */}
      <div>
        <h2 className="text-xs tracking-wider font-bold mb-4" style={{ color: "#C9A84C" }}>
          {editingId ? "EDIT ENTRY" : "ADD ENTRY"}
        </h2>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Version</label>
              <input value={version} onChange={(e) => { setVersion(e.target.value); markDirty(); }} style={inputStyle} placeholder="e.g. v7.1.1" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Release Date</label>
              <input type="date" value={releaseDate} onChange={(e) => { setReleaseDate(e.target.value); markDirty(); }} style={inputStyle} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Author</label>
              <input value={author} onChange={(e) => { setAuthor(e.target.value); markDirty(); }} style={inputStyle} placeholder="Signed-in admin" />
            </div>
          </div>

          {/* Category as segmented control */}
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Category</label>
            <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={active}
                    type="button"
                    onClick={() => { setCategory(c); markDirty(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCategory(c); markDirty(); }
                    }}
                    style={{
                      background: active ? "#C9A84C" : "#080806",
                      color: active ? "#080806" : "#e0d8c0",
                      border: `1px solid ${active ? "#C9A84C" : "rgba(201,168,76,0.4)"}`,
                      padding: "8px 16px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      minHeight: 44,
                      cursor: "pointer",
                      flex: "1 1 auto",
                      minWidth: 90,
                    }}
                  >
                    {c.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Title</label>
            <input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} style={inputStyle} placeholder="Short title" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px]" style={{ color: "rgba(224,216,192,0.6)" }}>Description (Markdown)</label>
              <button
                type="button"
                onClick={handlePolish}
                disabled={polishing || !description.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold tracking-wider"
                style={{
                  background: "transparent",
                  color: "#C9A84C",
                  border: "1px solid rgba(201,168,76,0.4)",
                  minHeight: 36,
                  opacity: polishing || !description.trim() ? 0.5 : 1,
                  cursor: polishing || !description.trim() ? "not-allowed" : "pointer",
                }}
              >
                <Sparkles className={`w-3 h-3 ${polishing ? "animate-pulse" : ""}`} />
                {polishing ? "POLISHING…" : "POLISH WITH CLAUDE"}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              rows={4}
              style={{ ...inputStyle, minHeight: 100 }}
              placeholder="Describe the changes…"
            />
            {polishedText && (
              <ChangelogPolishPreview
                original={polishOriginal}
                polished={polishedText}
                onAccept={() => {
                  setDescription(polishedText);
                  setUsedPolish(true);
                  setPolishedText(null);
                  toast.success("Polished version applied");
                }}
                onReject={() => setPolishedText(null)}
                onEditPolished={() => {
                  setDescription(polishedText);
                  setUsedPolish(true);
                  toast.success("Polished text loaded — edit and re-polish if needed");
                }}
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded text-[11px] font-bold tracking-wider"
              style={{ background: "#C9A84C", color: "#080806", minHeight: 44, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? "SAVING…" : editingId ? "UPDATE" : "ADD ENTRY"}
            </button>
            {editingId && (
              <button onClick={resetForm} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", minHeight: 44 }}>
                CANCEL
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(201,168,76,0.2)" }} />

      {/* Entries list */}
      <div>
        <h2 className="text-xs tracking-wider font-bold mb-4" style={{ color: "#C9A84C" }}>
          ENTRIES ({entries.length})
        </h2>
        <div className="space-y-1">
          {entries.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold" style={{ color: "#C9A84C" }}>v{e.version}</span>
                  <span className="text-[10px]" style={{ color: "rgba(224,216,192,0.5)" }}>{e.release_date}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                    background: e.category === "Feature" ? "rgba(34,197,94,0.15)" : e.category === "Fix" ? "rgba(239,68,68,0.15)" : e.category === "Improvement" ? "rgba(59,130,246,0.15)" : e.category === "Security" ? "rgba(245,158,11,0.15)" : "rgba(168,85,247,0.15)",
                    color: e.category === "Feature" ? "#22c55e" : e.category === "Fix" ? "#ef4444" : e.category === "Improvement" ? "#3b82f6" : e.category === "Security" ? "#f59e0b" : "#a855f7",
                  }}>{e.category}</span>
                </div>
                <p className="text-[12px] truncate mt-0.5" style={{ color: "#e0d8c0" }}>{e.title}</p>
              </div>
              <button onClick={() => handleEdit(e)} className="p-2 flex-shrink-0" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setDeleteId(e.id)} className="p-2 flex-shrink-0" style={{ color: "#ef4444", minHeight: 44, minWidth: 44 }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="p-6 rounded-lg max-w-sm w-full mx-4" style={{ background: "#0D0D0B", border: "1px solid rgba(201,168,76,0.3)" }}>
            <p className="text-sm mb-4" style={{ color: "#e0d8c0" }}>Delete this changelog entry?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded text-[11px] font-bold" style={{ border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", minHeight: 44 }}>
                CANCEL
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded text-[11px] font-bold" style={{ background: "#ef4444", color: "#fff", minHeight: 44 }}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminChangelogTab;

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Pencil, Trash2 } from "lucide-react";

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

const AdminChangelogTab = () => {
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

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase
        .from("changelog")
        .select("*")
        .order("release_date", { ascending: false });
      const rows = (data ?? []) as ChangelogEntry[];
      setEntries(rows);
      if (!editingId && rows.length > 0) {
        const latest = rows[0].version;
        const parts = latest.split(".");
        if (parts.length === 3) {
          parts[2] = String(Number(parts[2]) + 1);
          setVersion(parts.join("."));
        }
      }
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, [editingId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategory("Feature");
    setDescription("");
    setReleaseDate(new Date().toISOString().split("T")[0]);
    // version will be auto-set on next fetch
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
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("changelog").insert({
          version, release_date: releaseDate, title, category, description,
          created_by: user?.id,
        });
        if (error) throw error;
        toast.success("Entry added");
      }
      resetForm();
      fetchAll();
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
              <input value={version} onChange={(e) => setVersion(e.target.value)} style={inputStyle} placeholder="e.g. 7.1.0" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Release Date</label>
              <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Short title" />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: "rgba(224,216,192,0.6)" }}>Description (Markdown)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...inputStyle, minHeight: 100 }} placeholder="Describe the changes…" />
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

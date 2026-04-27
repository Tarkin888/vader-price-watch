import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { toast } from "sonner";
import { RefreshCw, ArrowLeft, Trash2, Bold, Heading2, Link as LinkIcon, Image, Table, List, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MASTER_TABLE_CODES } from "@/lib/cardback-master";

const CATEGORIES = [
  { code: "CARDBACK_GUIDE", label: "US Kenner Cardback Guide", color: "#4A90D9" },
  { code: "DT_VARIANTS", label: "Double-Telescoping Sabers", color: "#D94A4A" },
  { code: "VADER_POINTING", label: "Vader Pointing Photo Variant", color: "#9B59B6" },
  { code: "COO_STAMPS", label: "Country of Origin Stamps", color: "#E67E22" },
  { code: "GRADING", label: "Grading Companies (AFA / UKG / CAS)", color: "#27AE60" },
  { code: "COMMUNITIES", label: "Collector Communities", color: "#3498DB" },
  { code: "REFERENCE_SITES", label: "Key Reference Websites", color: "#8E44AD" },
  { code: "PUBLICATIONS", label: "Books & Publications", color: "#D4AC0D" },
  { code: "AUTHENTICATION", label: "Authentication & Fake Detection", color: "#E74C3C" },
  { code: "HISTORY", label: "Historical Production Context", color: "#7F8C8D" },
  { code: "SWT_TAXONOMY", label: "StarWarsTracker Sub-Variant Taxonomy", color: "#1ABC9C" },
  { code: "INTERNATIONAL", label: "International Licensee Guides", color: "#C0392B" },
];

const CAT_COLOR_MAP: Record<string, string> = {};
for (const c of CATEGORIES) CAT_COLOR_MAP[c.code] = c.color;

interface Article {
  id: string;
  category: string;
  slug: string;
  title: string;
  content_md: string;
  image_urls: string[] | null;
  source_urls: string[] | null;
  display_order: number | null;
  is_published: boolean | null;
  last_researched: string | null;
  confidence: string | null;
  tags: string[] | null;
  cardback_refs: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EditorForm {
  title: string;
  category: string;
  is_published: boolean;
  display_order: string;
  slug: string;
  tags: string;
  confidence: string;
  last_researched: string;
  image_urls: string;
  source_urls: string;
  content_md: string;
  cardback_refs: string[];
}

const emptyForm = (): EditorForm => ({
  title: "", category: CATEGORIES[0].code, is_published: false,
  display_order: "0", slug: "", tags: "", confidence: "MEDIUM",
  last_researched: "", image_urls: "", source_urls: "", content_md: "",
  cardback_refs: [],
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminKnowledgeTab = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EditorForm>(emptyForm());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchArticles = useCallback(async () => {
    setSpinning(true);
    try {
      const { data } = await supabase
        .from("knowledge_articles")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      setArticles((data ?? []) as Article[]);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(fetchArticles, 300000);
    return () => clearInterval(id);
  }, [fetchArticles]);

  const filtered = useMemo(() => articles.filter((a) => {
    if (catFilter !== "All" && a.category !== catFilter) return false;
    if (statusFilter === "Published" && !a.is_published) return false;
    if (statusFilter === "Draft" && a.is_published) return false;
    if (searchTerm && !a.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }), [articles, catFilter, statusFilter, searchTerm]);

  const openEditor = (article?: Article) => {
    if (article) {
      setEditingId(article.id);
      setCreating(false);
      setForm({
        title: article.title,
        category: article.category,
        is_published: article.is_published ?? false,
        display_order: String(article.display_order ?? 0),
        slug: article.slug,
        tags: (article.tags ?? []).join(", "),
        confidence: article.confidence ?? "MEDIUM",
        last_researched: article.last_researched ?? "",
        image_urls: (article.image_urls ?? []).join("\n"),
        source_urls: (article.source_urls ?? []).join("\n"),
        content_md: article.content_md,
        cardback_refs: article.cardback_refs ?? [],
      });
    } else {
      setEditingId(null);
      setCreating(true);
      setForm(emptyForm());
    }
    setSaveStatus("idle");
  };

  const setField = (key: keyof EditorForm, val: string | boolean) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "title" && creating && !f.slug) {
        next.slug = slugify(val as string);
      }
      return next;
    });
    // Auto-save for existing articles
    if (editingId && key !== "is_published") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => autoSave(), 10000);
    }
  };

  const autoSave = async () => {
    if (!editingId) return;
    setSaveStatus("saving");
    try {
      await saveToDb(editingId);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  };

  const saveToDb = async (id?: string) => {
    const row: any = {
      title: form.title,
      category: form.category,
      is_published: form.is_published,
      display_order: parseInt(form.display_order) || 0,
      slug: form.slug || slugify(form.title),
      tags: form.tags ? form.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      confidence: form.confidence,
      last_researched: form.last_researched || null,
      image_urls: form.image_urls ? form.image_urls.split("\n").map((s: string) => s.trim()).filter(Boolean) : [],
      source_urls: form.source_urls ? form.source_urls.split("\n").map((s: string) => s.trim()).filter(Boolean) : [],
      content_md: form.content_md,
    };
    if (id) {
      const res = await adminWrite({ table: "knowledge_articles", operation: "update", data: row, match: { column: "id", value: id } });
      if (!res.success) throw new Error(res.error);
    } else {
      const res = await adminWrite({ table: "knowledge_articles", operation: "insert", data: row });
      if (!res.success) throw new Error(res.error);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    try {
      await saveToDb();
      toast.success("Article created");
      setCreating(false);
      fetchArticles();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await adminWrite({ table: "knowledge_articles", operation: "delete", match: { column: "id", value: id } });
    if (!res.success) { toast.error("Delete failed"); return; }
    toast.success("Article deleted");
    setDeleteConfirm(null);
    fetchArticles();
  };

  const handlePublishToggle = async () => {
    const next = !form.is_published;
    setField("is_published", next);
    if (editingId) {
      await adminWrite({ table: "knowledge_articles", operation: "update", data: { is_published: next }, match: { column: "id", value: editingId } });
      toast.success(next ? "Published" : "Unpublished");
      fetchArticles();
    }
  };

  const insertMarkdown = (type: "bold" | "h2" | "link" | "image" | "table" | "list") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = form.content_md.slice(start, end);
    let insert = "";
    switch (type) {
      case "bold": insert = `**${sel || "bold text"}**`; break;
      case "h2": insert = `\n## ${sel || "Heading"}\n`; break;
      case "link": insert = `[${sel || "text"}](url)`; break;
      case "image": insert = `![${sel || "alt"}](url)`; break;
      case "table": insert = `\n| Col 1 | Col 2 | Col 3 |\n|-------|-------|-------|\n| a | b | c |\n| d | e | f |\n| g | h | i |\n`; break;
      case "list": insert = sel ? sel.split("\n").map((l: string) => `- ${l}`).join("\n") : "- item"; break;
    }
    const newContent = form.content_md.slice(0, start) + insert + form.content_md.slice(end);
    setField("content_md", newContent);
  };

  const inputStyle: React.CSSProperties = {
    background: "#111110", border: "1px solid rgba(201,168,76,0.3)", color: "#e0d8c0",
    padding: "8px 12px", borderRadius: 4, width: "100%", fontSize: 13, minHeight: 44,
  };

  // Editor view
  if (editingId || creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditingId(null); setCreating(false); if (debounceRef.current) { clearTimeout(debounceRef.current); autoSave(); } fetchArticles(); }} style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs tracking-wider font-bold" style={{ color: "#C9A84C" }}>
            {creating ? "NEW ARTICLE" : "EDIT ARTICLE"}
          </span>
          {editingId && (
            <span className="text-[10px] ml-auto" style={{ color: saveStatus === "saving" ? "rgba(224,216,192,0.6)" : saveStatus === "saved" ? "#C9A84C" : "transparent" }}>
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : ""}
            </span>
          )}
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>TITLE *</label>
            <input value={form.title} onChange={(e) => setField("title", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>CATEGORY *</label>
            <select value={form.category} onChange={(e) => setField("category", e.target.value)} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>SLUG</label>
            <input value={form.slug} onChange={(e) => setField("slug", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>DISPLAY ORDER</label>
            <input type="number" inputMode="numeric" value={form.display_order} onChange={(e) => setField("display_order", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>TAGS (comma-sep)</label>
            <input value={form.tags} onChange={(e) => setField("tags", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>LAST RESEARCHED</label>
            <input type="date" value={form.last_researched} onChange={(e) => setField("last_researched", e.target.value)} style={inputStyle} />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>STATUS</label>
              <button onClick={handlePublishToggle} className="px-3 py-1.5 rounded text-[11px] font-bold" style={{ background: form.is_published ? "rgba(76,175,80,0.2)" : "rgba(102,102,102,0.2)", color: form.is_published ? "#4CAF50" : "#666", minHeight: 44 }}>
                {form.is_published ? "PUBLISHED" : "DRAFT"}
              </button>
            </div>
            <div>
              <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>CONFIDENCE</label>
              <div className="flex gap-2">
                {["HIGH", "MEDIUM", "LOW"].map((c) => (
                  <button key={c} onClick={() => setField("confidence", c)} className="px-2 py-1.5 rounded text-[10px] font-bold" style={{ background: form.confidence === c ? "rgba(201,168,76,0.3)" : "transparent", color: form.confidence === c ? "#C9A84C" : "rgba(224,216,192,0.4)", border: "1px solid rgba(201,168,76,0.2)", minHeight: 44 }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>IMAGE URLS (one per line)</label>
            <textarea value={form.image_urls} onChange={(e) => setField("image_urls", e.target.value)} rows={2} style={{ ...inputStyle, minHeight: 60 }} />
          </div>
          <div>
            <label className="text-[10px] tracking-wider block mb-1" style={{ color: "rgba(224,216,192,0.6)" }}>SOURCE URLS (one per line)</label>
            <textarea value={form.source_urls} onChange={(e) => setField("source_urls", e.target.value)} rows={2} style={{ ...inputStyle, minHeight: 60 }} />
          </div>
        </div>

        {/* Mobile editor tabs */}
        <div className="md:hidden flex gap-0 mb-2" style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
          <button onClick={() => setMobilePreview(false)} className="flex-1 py-2 text-[11px] font-bold tracking-wider" style={{ color: !mobilePreview ? "#C9A84C" : "rgba(224,216,192,0.6)", borderBottom: !mobilePreview ? "2px solid #C9A84C" : "2px solid transparent", minHeight: 44 }}>EDIT</button>
          <button onClick={() => setMobilePreview(true)} className="flex-1 py-2 text-[11px] font-bold tracking-wider" style={{ color: mobilePreview ? "#C9A84C" : "rgba(224,216,192,0.6)", borderBottom: mobilePreview ? "2px solid #C9A84C" : "2px solid transparent", minHeight: 44 }}>PREVIEW</button>
        </div>

        {/* Markdown toolbar */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 -webkit-overflow-scrolling-touch" style={{ borderBottom: "1px solid rgba(201,168,76,0.2)", WebkitOverflowScrolling: "touch" as any }}>
          {[
            { icon: Bold, type: "bold" as const, tip: "Bold" },
            { icon: Heading2, type: "h2" as const, tip: "H2" },
            { icon: LinkIcon, type: "link" as const, tip: "Link" },
            { icon: Image, type: "image" as const, tip: "Image" },
            { icon: Table, type: "table" as const, tip: "Table" },
            { icon: List, type: "list" as const, tip: "List" },
          ].map((btn) => (
            <button key={btn.type} onClick={() => insertMarkdown(btn.type)} title={btn.tip} className="flex-shrink-0 p-2 rounded" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
              <btn.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Editor + Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: 400 }}>
          <div className={mobilePreview ? "hidden md:block" : ""}>
            <textarea
              ref={textareaRef}
              value={form.content_md}
              onChange={(e) => setField("content_md", e.target.value)}
              className="w-full h-full resize-none rounded p-3"
              style={{ ...inputStyle, minHeight: 400, fontFamily: "Courier New, monospace", fontSize: 12 }}
            />
          </div>
          <div className={!mobilePreview ? "hidden md:block" : ""}>
            <div className="rounded p-4 overflow-y-auto prose prose-invert prose-sm max-w-none" style={{ background: "#111110", border: "1px solid rgba(201,168,76,0.2)", minHeight: 400, color: "#e0d8c0" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content_md || "*No content yet*"}</ReactMarkdown>
            </div>
          </div>
        </div>

        {creating && (
          <button onClick={handleCreate} className="px-6 py-3 rounded text-[11px] font-bold tracking-wider" style={{ background: "#C9A84C", color: "#080806", minHeight: 44 }}>
            CREATE ARTICLE
          </button>
        )}
      </div>
    );
  }

  // List view
  if (loading) return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading articles…</p>;

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-wider font-bold" style={{ color: "#C9A84C" }}>KNOWLEDGE ARTICLES</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => openEditor()} className="px-4 py-2 rounded text-[11px] font-bold tracking-wider" style={{ border: "1px solid #C9A84C", color: "#C9A84C", minHeight: 44 }}>
            ADD ARTICLE
          </button>
          <button onClick={fetchArticles} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
            <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search articles…"
          className="rounded px-3 py-2 text-xs flex-1"
          style={{ ...inputStyle, maxWidth: 300 }}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="All">All Status</option>
          <option value="Published">Published</option>
          <option value="Draft">Draft</option>
        </select>
      </div>

      {/* Article list */}
      {filtered.length === 0 ? (
        <p className="italic text-center py-8" style={{ color: "rgba(224,216,192,0.5)" }}>No articles found.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((a, i) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: i % 2 === 0 ? "#0D0D0B" : "#111110" }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-sm font-bold truncate" style={{ color: "#e0d8c0" }}>{a.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: `${CAT_COLOR_MAP[a.category] || "#666"}33`, color: CAT_COLOR_MAP[a.category] || "#666" }}>
                  {a.category}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: a.is_published ? "rgba(76,175,80,0.2)" : "rgba(102,102,102,0.2)", color: a.is_published ? "#4CAF50" : "#666" }}>
                  {a.is_published ? "PUBLISHED" : "DRAFT"}
                </span>
                <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(224,216,192,0.4)" }}>#{a.display_order ?? 0}</span>
                <span className="text-[10px] flex-shrink-0 hidden md:inline" style={{ color: "rgba(224,216,192,0.4)" }}>
                  {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEditor(a)} className="p-2" style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}>
                  <Bold className="w-4 h-4" />
                </button>
                {deleteConfirm === a.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(a.id)} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: "rgba(244,67,54,0.2)", color: "#F44336", minHeight: 44 }}>DELETE</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded text-[10px] font-bold" style={{ color: "rgba(224,216,192,0.5)", minHeight: 44 }}>CANCEL</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(a.id)} className="p-2" style={{ color: "#F44336", minHeight: 44, minWidth: 44 }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminKnowledgeTab;

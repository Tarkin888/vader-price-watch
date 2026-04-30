import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { useAuth } from "@/hooks/use-auth";
import { Search, ArrowLeft, Plus, Upload, Edit2, Trash2, Eye, EyeOff, X, Images, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import CompViewerModal from "@/components/knowledge-hub/CompViewerModal";
import ImageManagerModal from "@/components/knowledge-hub/ImageManagerModal";

/* ───────── constants ───────── */

const CATEGORIES = [
  "CARDBACK_GUIDE", "DT_VARIANTS", "VADER_POINTING", "COO_STAMPS",
  "GRADING", "COMMUNITIES", "REFERENCE_SITES", "PUBLICATIONS",
  "AUTHENTICATION", "HISTORY", "SWT_TAXONOMY", "INTERNATIONAL",
] as const;

type Category = typeof CATEGORIES[number];

const CATEGORY_COLOURS: Record<Category, string> = {
  CARDBACK_GUIDE: "#4A90D9",
  DT_VARIANTS: "#D94A4A",
  VADER_POINTING: "#9B59B6",
  COO_STAMPS: "#E67E22",
  GRADING: "#27AE60",
  COMMUNITIES: "#3498DB",
  REFERENCE_SITES: "#8E44AD",
  PUBLICATIONS: "#D4AC0D",
  AUTHENTICATION: "#E74C3C",
  HISTORY: "#7F8C8D",
  SWT_TAXONOMY: "#1ABC9C",
  INTERNATIONAL: "#C0392B",
};

const CATEGORY_LABELS: Record<Category, string> = {
  CARDBACK_GUIDE: "Cardback Guide",
  DT_VARIANTS: "DT Variants",
  VADER_POINTING: "Vader Pointing",
  COO_STAMPS: "COO Stamps",
  GRADING: "Grading",
  COMMUNITIES: "Communities",
  REFERENCE_SITES: "Reference Sites",
  PUBLICATIONS: "Publications",
  AUTHENTICATION: "Authentication",
  HISTORY: "History",
  SWT_TAXONOMY: "SWT Taxonomy",
  INTERNATIONAL: "International",
};

const CONFIDENCE_COLOURS: Record<string, string> = {
  HIGH: "#4CAF50",
  MEDIUM: "#FF9800",
  LOW: "#F44336",
};

/* ───────── types ───────── */

interface Article {
  id: string;
  category: string;
  slug: string;
  title: string;
  content_md: string;
  image_urls: string[] | null;
  source_urls: string[] | null;
  display_order: number;
  is_published: boolean;
  last_researched: string | null;
  confidence: string | null;
  cardback_refs: string[] | null;
  created_at: string;
  updated_at: string;
}

type FormData = {
  category: string;
  slug: string;
  title: string;
  content_md: string;
  image_urls: string;
  source_urls: string;
  display_order: number;
  confidence: string;
};

const emptyForm: FormData = {
  category: CATEGORIES[0],
  slug: "",
  title: "",
  content_md: "",
  image_urls: "",
  source_urls: "",
  display_order: 0,
  confidence: "MEDIUM",
};

/* ───────── component ───────── */

const ResearchLibrary = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const { isAdmin } = useAuth();

  // Admin state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [previewMode, setPreviewMode] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Comp-viewer state — single-ref opens modal directly; multi-ref opens picker first
  const [compsTarget, setCompsTarget] = useState<string | null>(null);
  const [pickerArticleId, setPickerArticleId] = useState<string | null>(null);
  const [imageEditArticle, setImageEditArticle] = useState<Article | null>(null);

  /* ── fetch ── */
  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_articles" as any)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) {
      toast.error("Failed to load articles");
      console.error(error);
    } else {
      setArticles((data as any as Article[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

  /* ── derived ── */
  const visibleArticles = useMemo(() => {
    let list = isAdmin ? articles : articles.filter((a) => a.is_published);
    if (selectedCategory) list = list.filter((a) => a.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.content_md.toLowerCase().includes(q));
    }
    return list;
  }, [articles, isAdmin, selectedCategory, search]);

  const categoryCounts = useMemo(() => {
    const base = isAdmin ? articles : articles.filter((a) => a.is_published);
    const map: Record<string, number> = {};
    CATEGORIES.forEach((c) => { map[c] = base.filter((a) => a.category === c).length; });
    return map;
  }, [articles, isAdmin]);

  /* ── CRUD ── */
  const saveArticle = async () => {
    const payload = {
      category: form.category,
      slug: form.slug,
      title: form.title,
      content_md: form.content_md,
      image_urls: form.image_urls.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean),
      source_urls: form.source_urls.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean),
      display_order: form.display_order,
      confidence: form.confidence,
      last_researched: new Date().toISOString().slice(0, 10),
    };

    if (editingId) {
      const res = await adminWrite({ table: "knowledge_articles", operation: "update", data: payload, match: { column: "id", value: editingId } });
      if (!res.success) { toast.error("Update failed: " + res.error); return; }
      toast.success("Article updated");
    } else {
      const res = await adminWrite({ table: "knowledge_articles", operation: "insert", data: { ...payload, is_published: false } });
      if (!res.success) { toast.error("Insert failed: " + res.error); return; }
      toast.success("Article created as draft");
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchArticles();
  };

  const togglePublish = async (a: Article) => {
    const res = await adminWrite({ table: "knowledge_articles", operation: "update", data: { is_published: !a.is_published }, match: { column: "id", value: a.id } });
    if (!res.success) { toast.error("Toggle failed"); return; }
    fetchArticles();
  };

  const deleteArticle = async (id: string) => {
    const res = await adminWrite({ table: "knowledge_articles", operation: "delete", match: { column: "id", value: id } });
    if (!res.success) { toast.error("Delete failed"); return; }
    setDeleteConfirm(null);
    fetchArticles();
  };

  const importArticles = async () => {
    try {
      const arr = JSON.parse(importJson);
      if (!Array.isArray(arr)) { toast.error("JSON must be an array"); return; }
      let imported = 0, errors: string[] = [];
      for (const obj of arr) {
        if (!obj.category || !obj.slug || !obj.title || !obj.content_md) {
          errors.push(`Missing fields in: ${obj.slug || "unknown"}`);
          continue;
        }
        const res = await adminWrite({ table: "knowledge_articles", operation: "insert", data: {
          category: obj.category,
          slug: obj.slug,
          title: obj.title,
          content_md: obj.content_md,
          image_urls: obj.image_urls || [],
          source_urls: obj.source_urls || [],
          display_order: obj.display_order || 0,
          confidence: obj.confidence || "MEDIUM",
          is_published: false,
          last_researched: obj.last_researched || null,
        }});
        if (!res.success) errors.push(`${obj.slug}: ${res.error}`);
        else imported++;
      }
      toast.success(`Imported ${imported} articles`);
      if (errors.length) toast.error(`${errors.length} errors: ${errors.slice(0, 3).join("; ")}`);
      setShowImport(false);
      setImportJson("");
      fetchArticles();
    } catch { toast.error("Invalid JSON"); }
  };

  const startEdit = (a: Article) => {
    setForm({
      category: a.category,
      slug: a.slug,
      title: a.title,
      content_md: a.content_md,
      image_urls: (a.image_urls ?? []).join("\n"),
      source_urls: (a.source_urls ?? []).join("\n"),
      display_order: a.display_order,
      confidence: a.confidence ?? "MEDIUM",
    });
    setEditingId(a.id);
    setShowForm(true);
    setSelectedArticle(null);
  };

  /* ── ARTICLE DETAIL VIEW ── */
  if (selectedArticle) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedArticle(null)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors tracking-wider">
          <ArrowLeft className="w-3 h-3" /> Back To Articles
        </button>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-primary tracking-wider">{selectedArticle.title}</h3>
            <CategoryBadge category={selectedArticle.category} />
             <ConfidenceBadge confidence={selectedArticle.confidence ?? "MEDIUM"} />
          </div>
          {selectedArticle.last_researched && (
            <p className="text-[10px] text-muted-foreground tracking-wider">Last Researched: {selectedArticle.last_researched}</p>
          )}
          {selectedArticle.image_urls && selectedArticle.image_urls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {selectedArticle.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block" style={{ border: '1px solid #C9A84C', borderRadius: 4, overflow: 'hidden' }}>
                  <img src={url} alt={`Image ${i + 1}`} className="h-[80px] w-auto object-contain transition-opacity hover:opacity-80" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </a>
              ))}
            </div>
          )}
          <div className="prose-custom">
            <ReactMarkdown>{selectedArticle.content_md || ""}</ReactMarkdown>
          </div>
          {selectedArticle.source_urls && selectedArticle.source_urls.length > 0 && (
            <div className="pt-4 border-t border-border space-y-1">
              <p className="text-[10px] text-primary tracking-wider font-medium">Sources</p>
              {selectedArticle.source_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-primary/70 hover:text-primary truncate transition-colors">{url}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── MAIN LIST VIEW ── */
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-primary tracking-wider">Research Library</h3>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1 text-[10px] tracking-wider px-2 py-1 rounded border border-primary/50 text-primary hover:bg-primary/10 transition-colors">
              <Plus className="w-3 h-3" /> Add Article
            </button>
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1 text-[10px] tracking-wider px-2 py-1 rounded border border-primary/50 text-primary hover:bg-primary/10 transition-colors">
              <Upload className="w-3 h-3" /> Import JSON
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/30 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Mobile category toggle */}
      <button onClick={() => setMobileSidebar(!mobileSidebar)} className="md:hidden text-[10px] tracking-wider text-primary border border-primary/40 px-2 py-1 rounded">
        {mobileSidebar ? "Hide Categories" : "Show Categories"}
      </button>

      <div className="flex gap-4">
        {/* Category sidebar */}
        <div className={`${mobileSidebar ? "block" : "hidden"} md:block w-full md:w-48 shrink-0 space-y-1`}>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left text-[10px] tracking-wider px-2 py-1.5 rounded transition-colors ${
              !selectedCategory ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
            }`}
          >
            All Categories
            <span className="ml-1 text-[9px] opacity-60">({(isAdmin ? articles : articles.filter(a => a.is_published)).length})</span>
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat === selectedCategory ? null : cat); setMobileSidebar(false); }}
              className={`w-full text-left text-[10px] tracking-wider px-2 py-1.5 rounded flex items-center justify-between transition-colors ${
                selectedCategory === cat ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLOURS[cat] }} />
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-[9px] opacity-60">{categoryCounts[cat] || 0}</span>
            </button>
          ))}
        </div>

        {/* Articles grid */}
        <div className="flex-1 space-y-3">
          {loading ? (
            <p className="text-xs text-muted-foreground tracking-wider">Loading articles...</p>
          ) : visibleArticles.length === 0 ? (
            <p className="text-xs text-muted-foreground tracking-wider">No articles found.</p>
          ) : (
            visibleArticles.map((a) => (
              <div
                key={a.id}
                onClick={() => !isAdmin && setSelectedArticle(a)}
                className={`border border-border rounded p-3 transition-colors ${
                  !isAdmin ? "cursor-pointer hover:border-[#C9A84C]" : ""
                } ${!a.is_published ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {a.image_urls && a.image_urls.length > 0 && (
                    <img
                      src={a.image_urls[0]}
                      alt=""
                      className="w-[48px] h-[48px] object-contain rounded shrink-0"
                      style={{ border: '1px solid #C9A84C' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isAdmin && <span className="text-xs text-foreground font-medium">{a.title}</span>}
                      {isAdmin && (
                        <button onClick={() => setSelectedArticle(a)} className="text-xs text-foreground font-medium hover:text-primary transition-colors text-left">
                          {a.title}
                        </button>
                      )}
                      {!a.is_published && <span className="text-[8px] tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">DRAFT</span>}
                      {a.cardback_refs && a.cardback_refs.length > 0 && (
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (a.cardback_refs!.length === 1) {
                                setCompsTarget(a.cardback_refs![0]);
                              } else {
                                setPickerArticleId(pickerArticleId === a.id ? null : a.id);
                              }
                            }}
                            title={a.cardback_refs.length === 1 ? `View auction comps for ${a.cardback_refs[0]}` : `View auction comps (${a.cardback_refs.length} cardbacks)`}
                            aria-label="View auction comps"
                            className="inline-flex items-center justify-center p-1 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Images className="w-3.5 h-3.5" />
                          </button>
                          {pickerArticleId === a.id && a.cardback_refs.length > 1 && (
                            <div
                              className="absolute z-30 mt-1 left-0 p-2 rounded shadow-lg flex flex-wrap gap-1 max-w-[280px]"
                              style={{ background: "#111110", border: "1px solid #C9A84C", minWidth: 200 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {a.cardback_refs.map((code) => (
                                <button
                                  key={code}
                                  onClick={(e) => { e.stopPropagation(); setCompsTarget(code); setPickerArticleId(null); }}
                                  className="px-2 py-1 rounded text-[10px] font-bold tracking-wider hover:bg-primary/20 transition-colors"
                                  style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
                                >
                                  {code}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CategoryBadge category={a.category} />
                      <ConfidenceBadge confidence={a.confidence ?? "MEDIUM"} />
                      {a.last_researched && <span className="text-[9px] text-muted-foreground">{a.last_researched}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(a); }} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); togglePublish(a); }} className="p-1 text-muted-foreground hover:text-primary transition-colors" title={a.is_published ? "Unpublish" : "Publish"}>
                        {a.is_published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(a.id); }} className="p-1 text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-4 max-w-sm w-full space-y-3">
            <p className="text-xs text-foreground">Delete this article permanently?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-3 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={() => deleteArticle(deleteConfirm)} className="text-[10px] px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Article form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border border-border rounded-lg p-4 max-w-2xl w-full space-y-3 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-primary tracking-wider">{editingId ? "Edit Article" : "Add Article"}</h4>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" placeholder="unique-slug" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" placeholder="Article Title" />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted-foreground tracking-wider">Content (Markdown)</label>
                  <button onClick={() => setPreviewMode(!previewMode)} className="text-[9px] tracking-wider text-primary hover:text-primary/80 transition-colors">
                    {previewMode ? "Edit" : "Preview"}
                  </button>
                </div>
                {previewMode ? (
                  <div className="prose-custom border border-border rounded p-3 min-h-[200px] max-h-[400px] overflow-y-auto bg-secondary/10">
                    <ReactMarkdown>{form.content_md}</ReactMarkdown>
                  </div>
                ) : (
                  <textarea value={form.content_md} onChange={(e) => setForm({ ...form, content_md: e.target.value })} rows={10} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 font-mono resize-y" placeholder="Write markdown content..." />
                )}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Image URLs (one per line)</label>
                <textarea value={form.image_urls} onChange={(e) => setForm({ ...form, image_urls: e.target.value })} rows={3} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 font-mono resize-y" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Source URLs (one per line)</label>
                <textarea value={form.source_urls} onChange={(e) => setForm({ ...form, source_urls: e.target.value })} rows={3} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 font-mono resize-y" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Display Order</label>
                <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground tracking-wider block mb-1">Confidence</label>
                <div className="flex gap-3 pt-1">
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((c) => (
                    <label key={c} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="confidence" checked={form.confidence === c} onChange={() => setForm({ ...form, confidence: c })} className="accent-[#C9A84C]" />
                      <span className="text-[10px] tracking-wider" style={{ color: CONFIDENCE_COLOURS[c] }}>{c}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-[10px] px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveArticle} className="text-[10px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">{editingId ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-primary tracking-wider">Import JSON</h4>
              <button onClick={() => { setShowImport(false); setImportJson(""); }} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground tracking-wider">Paste a JSON array. Each object needs: category, slug, title, content_md. All imports start as drafts.</p>
            <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} rows={12} className="w-full text-xs bg-secondary/30 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 font-mono resize-y" placeholder='[{"category":"GRADING","slug":"afa-guide","title":"AFA Grading Guide","content_md":"..."}]' />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowImport(false); setImportJson(""); }} className="text-[10px] px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={importArticles} className="text-[10px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Markdown styling */}
      <style>{`
        .prose-custom { color: #e0d8c0; font-size: 13px; line-height: 1.7; }
        .prose-custom h1 { font-size: 1.25rem; font-weight: 600; color: #C9A84C; margin: 1.5rem 0 0.5rem; letter-spacing: 0.05em; }
        .prose-custom h2 { font-size: 1.1rem; font-weight: 500; color: #C9A84C; margin: 1.25rem 0 0.5rem; letter-spacing: 0.05em; }
        .prose-custom h3 { font-size: 0.95rem; font-weight: 500; color: #C9A84C; margin: 1rem 0 0.4rem; letter-spacing: 0.04em; }
        .prose-custom p { margin: 0.5rem 0; }
        .prose-custom ul, .prose-custom ol { padding-left: 1.25rem; margin: 0.5rem 0; }
        .prose-custom li { margin: 0.25rem 0; }
        .prose-custom a { color: #C9A84C; text-decoration: underline; }
        .prose-custom a:hover { opacity: 0.8; }
        .prose-custom code { background: rgba(201, 168, 76, 0.1); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
        .prose-custom pre { background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; overflow-x: auto; margin: 0.75rem 0; }
        .prose-custom pre code { background: none; padding: 0; }
        .prose-custom blockquote { border-left: 2px solid #C9A84C; padding-left: 0.75rem; margin: 0.75rem 0; color: #C9A84C; opacity: 0.8; }
        .prose-custom table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
        .prose-custom th, .prose-custom td { border: 1px solid rgba(201, 168, 76, 0.3); padding: 0.35rem 0.5rem; font-size: 0.8rem; }
        .prose-custom th { background: rgba(201, 168, 76, 0.1); color: #C9A84C; }
        .prose-custom strong { color: #C9A84C; }
      `}</style>

      {compsTarget && (
        <CompViewerModal
          cardbackCode={compsTarget}
          variantCode={compsTarget}
          open={!!compsTarget}
          onClose={() => setCompsTarget(null)}
          source="research_library"
        />
      )}
    </div>
  );
};

/* ───────── small helpers ───────── */

const CategoryBadge = ({ category }: { category: string }) => {
  const colour = CATEGORY_COLOURS[category as Category] || "#666";
  const label = CATEGORY_LABELS[category as Category] || category;
  return (
    <span className="text-[9px] tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: colour + "22", color: colour, border: `1px solid ${colour}44` }}>
      {label}
    </span>
  );
};

const ConfidenceBadge = ({ confidence }: { confidence: string }) => {
  const colour = CONFIDENCE_COLOURS[confidence] || "#999";
  return (
    <span className="text-[8px] tracking-widest px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: colour + "22", color: colour, border: `1px solid ${colour}44` }}>
      {confidence}
    </span>
  );
};

export default ResearchLibrary;

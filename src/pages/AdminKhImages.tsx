import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { adminWrite } from "@/lib/admin-write";
import { logActivity } from "@/lib/activity-log";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  image_urls: string[] | null;
}

const AdminKhImages = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_articles")
      .select("id, title, slug, category, image_urls")
      .or("image_urls.is.null,image_urls.eq.{}")
      .order("category")
      .order("title");
    if (error) {
      toast.error("Failed to load articles");
      console.error(error);
    } else {
      setArticles((data as ArticleRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed && isAdmin) fetchArticles();
  }, [authed, isAdmin, fetchArticles]);

  const handleSave = async (article: ArticleRow, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(trimmed)) {
      toast.error("Invalid image URL — must be http(s) with an image extension");
      return;
    }
    setSaving((p) => ({ ...p, [article.id]: true }));
    const res = await adminWrite({
      table: "knowledge_articles",
      operation: "update",
      data: { image_urls: [trimmed] },
      match: { column: "id", value: article.id },
    });
    if (res.success) {
      toast.success(`Saved image for "${article.title}"`);
      logActivity("knowledge_hub.image_replace" as any, article.id, { image_count: 1 });
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      setUrls((p) => { const n = { ...p }; delete n[article.id]; return n; });
    } else {
      toast.error(res.error || "Save failed");
    }
    setSaving((p) => ({ ...p, [article.id]: false }));
  };

  if (authLoading) return <div className="min-h-screen" style={{ background: "#080806" }} />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080806" }}>
        <p className="text-lg font-bold tracking-widest" style={{ color: "#C9A84C" }}>ACCESS RESTRICTED</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080806" }}>
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: "#e0d8c0" }}>
            Authenticate via the <Link to="/admin" className="underline" style={{ color: "#C9A84C" }}>Admin Dashboard</Link> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080806", color: "#e0d8c0", fontFamily: "Aptos, sans-serif" }}>
      <header className="flex items-center justify-between px-4 md:px-6 h-[52px] border-b" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
        <Link to="/admin" className="text-sm font-bold tracking-widest" style={{ color: "#C9A84C" }}>
          ← ADMIN DASHBOARD
        </Link>
        <span className="text-[10px] tracking-widest" style={{ color: "#e0d8c0", opacity: 0.5 }}>
          ARTICLES MISSING IMAGES
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <h1 className="text-lg font-bold tracking-widest mb-1" style={{ color: "#C9A84C" }}>
          Articles Missing Images
        </h1>
        <p className="text-xs mb-6" style={{ color: "#e0d8c0", opacity: 0.6 }}>
          {loading ? "Loading…" : `${articles.length} article${articles.length !== 1 ? "s" : ""} with empty image_urls`}
        </p>

        {!loading && articles.length === 0 && (
          <p className="text-sm" style={{ color: "#C9A84C" }}>All articles have images — nothing to fix.</p>
        )}

        {!loading && articles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.3)" }}>
                  <th className="text-left py-2 px-3 text-[11px] font-bold tracking-wider" style={{ color: "#C9A84C" }}>#</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold tracking-wider" style={{ color: "#C9A84C" }}>Title</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold tracking-wider" style={{ color: "#C9A84C" }}>Slug</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold tracking-wider" style={{ color: "#C9A84C" }}>Category</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold tracking-wider" style={{ color: "#C9A84C" }}>Image URL</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: "1px solid rgba(201,168,76,0.1)",
                      background: i % 2 === 0 ? "transparent" : "rgba(201,168,76,0.03)",
                    }}
                  >
                    <td className="py-2 px-3 text-xs" style={{ color: "#e0d8c0", opacity: 0.5 }}>{i + 1}</td>
                    <td className="py-2 px-3 text-xs" style={{ color: "#e0d8c0" }}>{a.title}</td>
                    <td className="py-2 px-3 text-xs font-mono" style={{ color: "#e0d8c0", opacity: 0.6 }}>{a.slug}</td>
                    <td className="py-2 px-3 text-xs" style={{ color: "#e0d8c0", opacity: 0.7 }}>{a.category}</td>
                    <td className="py-2 px-3" style={{ minWidth: 300 }}>
                      <input
                        type="text"
                        placeholder="Paste image URL…"
                        value={urls[a.id] ?? ""}
                        onChange={(e) => setUrls((p) => ({ ...p, [a.id]: e.target.value }))}
                        onBlur={() => handleSave(a, urls[a.id] ?? "")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSave(a, urls[a.id] ?? "");
                        }}
                        disabled={saving[a.id]}
                        className="w-full text-xs py-1.5 px-2 rounded"
                        style={{
                          background: "#111110",
                          border: "1px solid rgba(201,168,76,0.25)",
                          color: "#e0d8c0",
                          opacity: saving[a.id] ? 0.5 : 1,
                          minHeight: 36,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="text-center text-[10px] py-2 border-t tracking-widest" style={{ color: "rgba(224,216,192,0.4)", borderColor: "rgba(201,168,76,0.15)" }}>
        IMPERIAL PRICE TERMINAL — ADMIN
      </footer>
    </div>
  );
};

export default AdminKhImages;

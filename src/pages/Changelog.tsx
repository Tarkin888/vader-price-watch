import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import Header from "@/components/Header";

interface ChangelogEntry {
  id: string;
  version: string;
  release_date: string;
  title: string;
  category: string;
  description: string;
}

const CATEGORIES = ["Feature", "Fix", "Improvement", "Security", "Data"];

const categoryColors: Record<string, { bg: string; text: string }> = {
  Feature: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  Fix: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  Improvement: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  Security: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  Data: { bg: "rgba(168,85,247,0.15)", text: "#a855f7" },
};

const Changelog = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("changelog")
      .select("*")
      .order("release_date", { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as ChangelogEntry[]);
        setLoading(false);
      });
  }, []);

  const toggleFilter = (cat: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const filtered = activeFilters.size === 0 ? entries : entries.filter((e) => activeFilters.has(e.category));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080806", color: "#e0d8c0" }}>
      {/* Minimal header */}
      <header className="border-b px-4 md:px-6 flex items-center justify-between h-[52px]" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
        <Link to="/" className="text-sm font-bold tracking-widest" style={{ color: "#C9A84C" }}>
          IMPERIAL PRICE TERMINAL
        </Link>
        <Link to="/" className="text-[10px] tracking-widest" style={{ color: "rgba(224,216,192,0.5)" }}>
          ← Back to Dashboard
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8 max-w-3xl mx-auto w-full">
        {/* Title */}
        <h1 className="text-lg md:text-xl font-bold tracking-widest mb-1" style={{ color: "#C9A84C" }}>
          Changelog
        </h1>
        <p className="text-[12px] mb-6" style={{ color: "rgba(224,216,192,0.5)" }}>
          Version history and release notes for Imperial Price Terminal
        </p>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => {
            const active = activeFilters.has(cat);
            const colors = categoryColors[cat];
            return (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider transition-all"
                style={{
                  background: active ? colors.bg : "transparent",
                  color: active ? colors.text : "rgba(224,216,192,0.4)",
                  border: `1px solid ${active ? colors.text : "rgba(224,216,192,0.15)"}`,
                  minHeight: 36,
                }}
              >
                {cat}
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button onClick={() => setActiveFilters(new Set())} className="px-3 py-1.5 text-[11px] tracking-wider" style={{ color: "rgba(224,216,192,0.4)", minHeight: 36 }}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm animate-pulse" style={{ color: "#C9A84C" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm" style={{ color: "rgba(224,216,192,0.4)" }}>No entries found.</p>
        ) : (
          /* Timeline */
          <div className="relative pl-6 md:pl-8">
            {/* Vertical line */}
            <div className="absolute left-2 md:left-3 top-0 bottom-0 w-px" style={{ background: "#1a1a14" }} />

            <div className="space-y-6">
              {filtered.map((entry) => {
                const colors = categoryColors[entry.category] ?? categoryColors.Feature;
                return (
                  <div key={entry.id} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-[18px] md:-left-[22px] top-4 w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "#C9A84C", background: "#080806" }} />

                    {/* Card */}
                    <div
                      className="rounded-lg p-4 md:p-5 transition-colors"
                      style={{ background: "#0d0d0a", border: "1px solid #1a1a14" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9A84C")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a14")}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>
                          v{entry.version}
                        </span>
                        <span className="text-[11px]" style={{ color: "rgba(224,216,192,0.4)" }}>
                          {entry.release_date}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: colors.bg, color: colors.text }}>
                          {entry.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold mb-2" style={{ color: "#e0d8c0" }}>
                        {entry.title}
                      </h3>
                      <div className="text-[12px] leading-relaxed prose-invert" style={{ color: "rgba(224,216,192,0.7)" }}>
                        <ReactMarkdown>{entry.description}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer className="text-center text-[10px] py-2 border-t tracking-widest" style={{ color: "rgba(224,216,192,0.4)", borderColor: "rgba(201,168,76,0.15)" }}>
        IMPERIAL PRICE TERMINAL v4.1
      </footer>
    </div>
  );
};

export default Changelog;

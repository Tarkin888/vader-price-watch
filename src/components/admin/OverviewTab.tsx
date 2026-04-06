import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Database, Globe, Bug, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface Stats {
  totalRecords: number;
  activeSources: number;
  openBugs: number;
  visitorsToday: number;
}

interface SourceCount {
  source: string;
  count: number;
}

interface DayCount {
  day: string;
  count: number;
}

interface QualityPill {
  label: string;
  count: number;
  bg: string;
  text: string;
  filter: string;
}

const AdminOverviewTab = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sourceData, setSourceData] = useState<SourceCount[]>([]);
  const [visitorData, setVisitorData] = useState<DayCount[]>([]);
  const [pills, setPills] = useState<QualityPill[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);

  const fetchAll = useCallback(async () => {
    setSpinning(true);
    try {
      // Stats
      const [totalRes, sourcesRes, bugsRes, visitorsRes] = await Promise.all([
        supabase.from("lots").select("id", { count: "exact", head: true }),
        supabase.from("lots").select("source"),
        supabase.from("bug_reports").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
        supabase.from("page_views").select("id", { count: "exact", head: true }).gte("viewed_at", new Date().toISOString().slice(0, 10)),
      ]);

      const uniqueSources = new Set((sourcesRes.data ?? []).map((r: any) => r.source));

      setStats({
        totalRecords: totalRes.count ?? 0,
        activeSources: uniqueSources.size,
        openBugs: bugsRes.count ?? 0,
        visitorsToday: visitorsRes.count ?? 0,
      });

      // Source distribution
      const sourceCounts: Record<string, number> = {};
      for (const r of sourcesRes.data ?? []) {
        sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
      }
      setSourceData(
        ["Heritage", "Hakes", "LCG", "Vectis", "CandT"].map((s) => ({ source: s, count: sourceCounts[s] || 0 }))
      );

      // Quality pills
      const [unknownRes, missingImgRes, suspPriceRes] = await Promise.all([
        supabase.from("lots").select("id", { count: "exact", head: true }).eq("cardback_code", "UNKNOWN"),
        supabase.from("lots").select("id", { count: "exact", head: true }).eq("image_urls", "{}" as any),
        supabase.from("lots").select("id", { count: "exact", head: true }).or("total_paid_gbp.lt.5,total_paid_gbp.gt.50000"),
      ]);

      setPills([
        { label: "UNKNOWN Cardbacks", count: unknownRes.count ?? 0, bg: "rgba(255,152,0,0.2)", text: "#FF9800", filter: "cardback=UNKNOWN" },
        { label: "Missing Images", count: missingImgRes.count ?? 0, bg: "rgba(244,67,54,0.2)", text: "#F44336", filter: "" },
        { label: "Suspicious Prices", count: suspPriceRes.count ?? 0, bg: "rgba(230,126,34,0.2)", text: "#E67E22", filter: "" },
      ]);

      // 7-day visitors
      const days: DayCount[] = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);
        const { count } = await supabase
          .from("page_views")
          .select("id", { count: "exact", head: true })
          .gte("viewed_at", dateStr)
          .lt("viewed_at", nextD.toISOString().slice(0, 10));
        days.push({ day: dayNames[d.getDay()], count: count ?? 0 });
      }
      setVisitorData(days);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 300000); return () => clearInterval(id); }, [fetchAll]);

  const statCards = stats
    ? [
        { label: "Total Records", value: stats.totalRecords.toLocaleString(), icon: Database },
        { label: "Active Sources", value: `${stats.activeSources} of 5`, icon: Globe },
        { label: "Open Bugs", value: stats.openBugs.toString(), icon: Bug },
        { label: "Visitors Today", value: stats.visitorsToday.toString(), icon: Eye },
      ]
    : [];

  if (loading && !stats) {
    return <p className="italic py-8 text-center" style={{ color: "rgba(224,216,192,0.5)" }}>Loading overview…</p>;
  }

  return (
    <div className="space-y-6 relative">
      <button
        onClick={fetchAll}
        className="absolute top-0 right-0 p-2"
        style={{ color: "#C9A84C", minHeight: 44, minWidth: 44 }}
      >
        <RefreshCw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
      </button>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {statCards.map((c) => (
          <div key={c.label} className="rounded p-3" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
            <div className="flex items-center gap-2 mb-1">
              <c.icon className="w-4 h-4" style={{ color: "#C9A84C" }} />
              <span className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.6)" }}>{c.label}</span>
            </div>
            <span className="text-xl font-bold" style={{ color: "#C9A84C" }}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Source bar chart */}
      <div className="rounded p-4" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
        <h3 className="text-xs tracking-wider mb-3" style={{ color: "rgba(224,216,192,0.6)" }}>SOURCE DISTRIBUTION</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sourceData}>
            <XAxis dataKey="source" tick={{ fill: "#e0d8c0", fontSize: 11 }} axisLine={{ stroke: "#333" }} />
            <YAxis tick={{ fill: "#e0d8c0", fontSize: 11 }} axisLine={{ stroke: "#333" }} />
            <Tooltip contentStyle={{ background: "#111110", border: "1px solid #C9A84C", color: "#e0d8c0" }} />
            <Bar dataKey="count" fill="#C9A84C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quality pills */}
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <a
            key={p.label}
            href={p.filter ? `/?${p.filter}` : "#"}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wider"
            style={{ background: p.bg, color: p.text, minHeight: 44, display: "inline-flex", alignItems: "center" }}
          >
            {p.label}: {p.count}
          </a>
        ))}
      </div>

      {/* 7-day visitor chart */}
      <div className="rounded p-4" style={{ border: "1px solid rgba(201,168,76,0.3)", background: "#0D0D0B" }}>
        <h3 className="text-xs tracking-wider mb-3" style={{ color: "rgba(224,216,192,0.6)" }}>7-DAY VISITORS</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={visitorData}>
            <XAxis dataKey="day" tick={{ fill: "#e0d8c0", fontSize: 11 }} axisLine={{ stroke: "#333" }} />
            <YAxis tick={{ fill: "#e0d8c0", fontSize: 11 }} axisLine={{ stroke: "#333" }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#111110", border: "1px solid #C9A84C", color: "#e0d8c0" }} />
            <Line type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={2} dot={{ fill: "#C9A84C", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminOverviewTab;

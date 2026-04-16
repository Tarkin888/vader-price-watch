import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";

/* ── colour tokens ── */
const GOLD = "hsl(43, 50%, 54%)";
const MUTED = "hsl(40, 15%, 50%)";
const ERA_COLORS: Record<string, string> = {
  SW: "hsl(43, 50%, 54%)", ESB: "hsl(200, 50%, 55%)", ROTJ: "hsl(140, 45%, 50%)",
  POTF: "hsl(270, 50%, 60%)", UNKNOWN: "hsl(0, 0%, 40%)",
};
const SOURCE_COLORS: Record<string, string> = {
  Heritage: "#4A90D9", Hakes: "#5BA55B", LCG: "#D4A843", Vectis: "#C75050", CandT: "#8B5CF6",
};
const EVENT_COLORS: Record<string, string> = {
  record_added: "hsl(43,50%,54%)", record_edited: "hsl(200,50%,55%)",
  record_viewed: "hsl(140,45%,50%)", collection_added: "hsl(270,50%,60%)",
  classification_fixed: "hsl(20,60%,55%)", scrape_run: "hsl(340,50%,55%)",
};
const TOOLTIP_STYLE = { backgroundColor: "hsl(50, 14%, 6%)", border: "1px solid hsl(43, 20%, 18%)", borderRadius: 4 };
const TOOLTIP_LABEL = { color: GOLD, fontSize: 10, fontWeight: 600 };
const TOOLTIP_ITEM = { color: "hsl(40, 30%, 82%)", fontSize: 10 };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtGBP(v: number | null) {
  if (v == null) return "—";
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── main page ── */
export default function Stats() {
  const { profile } = useAuth();

  const [activityData, setActivityData] = useState<any[] | null>(null);
  const [lotsAgg, setLotsAgg] = useState<any>(null);
  const [recentViews, setRecentViews] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const fetchAll = async () => {
      // 1. All user activity
      const { data: activity } = await supabase
        .from("user_activity" as any)
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      setActivityData(activity || []);

      // 2. Lots aggregation — fetch all lots
      const { data: lots } = await supabase
        .from("lots")
        .select("era, source, grade_tier_code, total_paid_gbp, cardback_code");

      const allLots = lots || [];
      const totalRecords = allLots.length;

      // Era counts
      const eraCounts: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};
      const gradeCounts: Record<string, number> = {};
      const prices: number[] = [];

      for (const lot of allLots) {
        eraCounts[lot.era] = (eraCounts[lot.era] || 0) + 1;
        sourceCounts[lot.source] = (sourceCounts[lot.source] || 0) + 1;
        gradeCounts[lot.grade_tier_code] = (gradeCounts[lot.grade_tier_code] || 0) + 1;
        if (lot.total_paid_gbp != null && lot.total_paid_gbp > 0) {
          prices.push(Number(lot.total_paid_gbp));
        }
      }

      prices.sort((a, b) => a - b);
      const median = prices.length > 0
        ? prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)]
        : 0;

      setLotsAgg({
        totalRecords,
        eraCounts,
        sourceCounts,
        gradeCounts,
        priceStats: {
          avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
          median,
          highest: prices.length > 0 ? prices[prices.length - 1] : 0,
          lowest: prices.length > 0 ? prices[0] : 0,
        },
      });

      // 3. Recent views from activity
      const views = (activity || []).filter((a: any) => a.event_type === "record_viewed").slice(0, 5);
      if (views.length > 0) {
        const refs = views.map((v: any) => v.entity_ref).filter(Boolean);
        if (refs.length > 0) {
          const { data: viewedLots } = await supabase
            .from("lots")
            .select("lot_ref, source, total_paid_gbp, sale_date, cardback_code")
            .in("lot_ref", refs);
          setRecentViews(viewedLots || []);
        } else {
          setRecentViews([]);
        }
      } else {
        setRecentViews([]);
      }

      setLoading(false);
    };

    fetchAll();
  }, [profile]);

  /* ── derived activity metrics ── */
  const activityMetrics = useMemo(() => {
    if (!activityData) return null;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const count = (type: string, since?: Date) =>
      activityData.filter((a: any) => a.event_type === type && (!since || new Date(a.created_at) >= since)).length;

    const lastScrape = activityData.find((a: any) => a.event_type === "scrape_run");

    return {
      scrapes30d: count("scrape_run", thirtyDaysAgo),
      scrapesAll: count("scrape_run"),
      lastScrape: lastScrape?.created_at ?? null,
      added30d: count("record_added", thirtyDaysAgo) + count("collection_added", thirtyDaysAgo),
      addedAll: count("record_added") + count("collection_added"),
      edited30d: count("record_edited", thirtyDaysAgo) + count("collection_edited", thirtyDaysAgo),
      editedAll: count("record_edited") + count("collection_edited"),
      classified30d: count("classification_fixed", thirtyDaysAgo),
      classifiedAll: count("classification_fixed"),
      notes30d: count("note_created", thirtyDaysAgo),
      notesAll: count("note_created"),
      favs30d: count("favourite_added", thirtyDaysAgo),
      favsAll: count("favourite_added"),
    };
  }, [activityData]);

  /* ── timeline data ── */
  const timelineData = useMemo(() => {
    if (!activityData) return [];
    const now = new Date();
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().slice(0, 10));
    }

    const eventTypes = ["record_added", "record_edited", "record_viewed", "collection_added", "classification_fixed", "scrape_run"];
    return days.map((day) => {
      const row: any = { day: day.slice(5) }; // "MM-DD"
      for (const et of eventTypes) {
        row[et] = activityData.filter((a: any) => a.event_type === et && a.created_at?.slice(0, 10) === day).length;
      }
      return row;
    });
  }, [activityData]);

  /* ── top cardbacks viewed ── */
  const topCardbacks = useMemo(() => {
    if (!activityData) return [];
    const counts: Record<string, number> = {};
    for (const a of activityData as any[]) {
      if (a.event_type === "record_viewed" && a.metadata?.cardback_code) {
        const cb = a.metadata.cardback_code;
        counts[cb] = (counts[cb] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));
  }, [activityData]);

  const memberSince = profile?.created_at ? fmtDate(profile.created_at) : "—";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header totalRecords={lotsAgg?.totalRecords ?? 0} lastScrapeDate={null} />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-primary tracking-widest">MY STATS</h1>
          <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
            Signed in as {profile?.email ?? "—"} — member since {memberSince}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* A. Activity Summary */}
          {loading ? <SkeletonCard /> : <ActivitySummaryCard metrics={activityMetrics} />}

          {/* B. Library — Era Breakdown */}
          {loading ? <SkeletonCard /> : <EraBreakdownCard data={lotsAgg} />}

          {/* B. Library — Source Breakdown */}
          {loading ? <SkeletonCard /> : <SourceBreakdownCard data={lotsAgg} />}

          {/* B. Library — Grade Breakdown */}
          {loading ? <SkeletonCard /> : <GradeBreakdownCard data={lotsAgg} />}

          {/* B. Library — Price Stats */}
          {loading ? <SkeletonCard /> : <PriceStatsCard stats={lotsAgg?.priceStats} />}

          {/* C. My Picks */}
          {loading ? <SkeletonCard /> : <MyPicksCard recentViews={recentViews} topCardbacks={topCardbacks} metrics={activityMetrics} />}

          {/* D. Timeline (spans full width) */}
          <div className="md:col-span-2 xl:col-span-3">
            {loading ? <SkeletonCard /> : <TimelineCard data={timelineData} />}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Card components ── */

function SkeletonCard() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
      <CardContent><Skeleton className="h-24 w-full" /></CardContent>
    </Card>
  );
}

function MetricRow({ label, value30d, valueAll, caption }: { label: string; value30d: number; valueAll: number; caption?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-[10px] text-muted-foreground tracking-widest uppercase">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-foreground">{value30d}</span>
        <span className="text-[10px] text-muted-foreground ml-1.5">/ {valueAll} all-time</span>
      </div>
    </div>
  );
}

function ActivitySummaryCard({ metrics }: { metrics: any }) {
  if (!metrics) return <EmptyCard title="ACTIVITY SUMMARY" message="No activity recorded yet." />;
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">ACTIVITY SUMMARY</CardTitle>
        <p className="text-[10px] text-muted-foreground">Last 30 days</p>
      </CardHeader>
      <CardContent className="space-y-0">
        <MetricRow label="Scrapes Run" value30d={metrics.scrapes30d} valueAll={metrics.scrapesAll} />
        <MetricRow label="Records Added" value30d={metrics.added30d} valueAll={metrics.addedAll} />
        <MetricRow label="Records Edited" value30d={metrics.edited30d} valueAll={metrics.editedAll} />
        <MetricRow label="Classifications Fixed" value30d={metrics.classified30d} valueAll={metrics.classifiedAll} />
        <MetricRow label="Notes Created" value30d={metrics.notes30d} valueAll={metrics.notesAll} />
        <MetricRow label="Favourites Added" value30d={metrics.favs30d} valueAll={metrics.favsAll} />
        {metrics.lastScrape && (
          <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
            Last scrape: {fmtDate(metrics.lastScrape)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EraBreakdownCard({ data }: { data: any }) {
  if (!data) return <EmptyCard title="ERA BREAKDOWN" message="No records in library." />;
  const eras = ["SW", "ESB", "ROTJ", "POTF", "UNKNOWN"];
  const chartData = eras.map((era) => ({
    era,
    count: data.eraCounts[era] || 0,
    pct: data.totalRecords > 0 ? ((data.eraCounts[era] || 0) / data.totalRecords * 100).toFixed(1) : "0",
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">RECORDS BY ERA</CardTitle>
        <p className="text-[10px] text-muted-foreground">{data.totalRecords} total records</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 50 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="era" tick={{ fontSize: 10, fill: MUTED }} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: MUTED, formatter: (_: any, __: any, index: number) => `${chartData[index]?.pct}%` }}>
              {chartData.map((entry) => (
                <Cell key={entry.era} fill={ERA_COLORS[entry.era] || MUTED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SourceBreakdownCard({ data }: { data: any }) {
  if (!data) return <EmptyCard title="RECORDS BY SOURCE" message="No records in library." />;
  const chartData = Object.entries(data.sourceCounts as Record<string, number>)
    .map(([name, value]) => ({ name: name === "CandT" ? "C&T" : name, value, fill: SOURCE_COLORS[name] || MUTED }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">RECORDS BY SOURCE</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: MUTED, strokeWidth: 1 }}
              style={{ fontSize: 9 }}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function GradeBreakdownCard({ data }: { data: any }) {
  if (!data) return <EmptyCard title="RECORDS BY GRADE" message="No records in library." />;
  const chartData = Object.entries(data.gradeCounts as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([grade, count]) => ({ grade, count }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">RECORDS BY GRADE</CardTitle>
        <p className="text-[10px] text-muted-foreground">Top 12 grade tiers</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 70, right: 30 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="grade" tick={{ fontSize: 9, fill: MUTED }} width={65} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
            <Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]}
              label={{ position: "right", fontSize: 9, fill: MUTED }} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function PriceStatsCard({ stats }: { stats: any }) {
  if (!stats) return <EmptyCard title="PRICE STATISTICS" message="No priced records yet." />;
  const tiles = [
    { label: "Average", value: fmtGBP(stats.avg), caption: "Mean total paid" },
    { label: "Median", value: fmtGBP(stats.median), caption: "Middle value" },
    { label: "Highest", value: fmtGBP(stats.highest), caption: "Top sale" },
    { label: "Lowest", value: fmtGBP(stats.lowest), caption: "Lowest sale" },
  ];
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">PRICE STATISTICS</CardTitle>
        <p className="text-[10px] text-muted-foreground">Across all confirmed sales (GBP)</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="bg-secondary rounded-md p-2.5">
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">{t.label}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{t.value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t.caption}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MyPicksCard({ recentViews, topCardbacks, metrics }: { recentViews: any[] | null; topCardbacks: any[]; metrics: any }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">MY PICKS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1">Favourites</p>
          <p className="text-sm font-bold text-foreground">{metrics?.favsAll ?? 0}</p>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1">Top Cardbacks Viewed</p>
          {topCardbacks.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No views recorded yet</p>
          ) : (
            <div className="space-y-1">
              {topCardbacks.map((cb) => (
                <div key={cb.code} className="flex justify-between text-xs">
                  <span className="text-foreground">{cb.code}</span>
                  <span className="text-muted-foreground">{cb.count} views</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1">Recently Viewed</p>
          {(!recentViews || recentViews.length === 0) ? (
            <p className="text-[10px] text-muted-foreground italic">No recent views</p>
          ) : (
            <div className="space-y-1.5">
              {recentViews.map((lot, i) => (
                <div key={i} className="flex items-baseline justify-between text-xs gap-2">
                  <span className="text-foreground truncate">{lot.cardback_code} · {lot.source}</span>
                  <span className="text-primary font-bold shrink-0">{fmtGBP(lot.total_paid_gbp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineCard({ data }: { data: any[] }) {
  const eventTypes = [
    { key: "record_added", label: "Added" },
    { key: "record_edited", label: "Edited" },
    { key: "record_viewed", label: "Viewed" },
    { key: "collection_added", label: "Collection" },
    { key: "classification_fixed", label: "Classified" },
    { key: "scrape_run", label: "Scrapes" },
  ];

  const hasData = data.some((d) => eventTypes.some((et) => d[et.key] > 0));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">ACTIVITY TIMELINE</CardTitle>
        <p className="text-[10px] text-muted-foreground">Events per day — last 30 days</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-[10px] text-muted-foreground italic py-8 text-center">No activity in the last 30 days. Start using the app to see your timeline build up.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(43, 20%, 18%)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: MUTED }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} width={25} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {eventTypes.map((et) => (
                <Line key={et.key} type="monotone" dataKey={et.key} name={et.label}
                  stroke={EVENT_COLORS[et.key] || MUTED} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs tracking-widest text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] text-muted-foreground italic py-4 text-center">{message}</p>
      </CardContent>
    </Card>
  );
}

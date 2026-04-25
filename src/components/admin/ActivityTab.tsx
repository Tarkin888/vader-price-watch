import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";

const GOLD = "#C9A84C";
const BG = "#0D0D0B";
const TEXT = "#e0d8c0";
const BORDER = "rgba(201,168,76,0.2)";
const TOOLTIP = { backgroundColor: "#080806", border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontSize: 11 };
const TOOLTIP_LABEL = { color: GOLD, fontSize: 10, fontWeight: 600 };

const RANGES = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7d" },
  { key: "30d", label: "Last 30d" },
  { key: "90d", label: "Last 90d" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const STACK_COLORS = [
  "#C9A84C", "#4A90D9", "#5BA55B", "#C75050", "#8B5CF6",
  "#D4A843", "#E07A5F", "#3D5A80", "#81B29A", "#F2CC8F",
  "#9D4EDD", "#F08080", "#90BE6D", "#577590", "#43AA8B",
];

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(ms: number | null) {
  if (ms == null) return "—";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

async function callActivity(action: string, range: RangeKey, extra?: Record<string, unknown>) {
  const pin = sessionStorage.getItem("admin_pin") ?? "";
  const { data, error } = await supabase.functions.invoke("admin-activity", {
    body: { pin, action, range, ...(extra ?? {}) },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

type SortKey =
  | "email" | "last_seen" | "sessions_30d" | "total_30d"
  | "chat_30d" | "added_30d" | "edited_30d" | "favourites_30d" | "notes_30d";

export default function ActivityTab() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [users, setUsers] = useState<any[] | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Record<string, any[]>>({});
  const [sortKey, setSortKey] = useState<SortKey>("last_seen");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback((k: RangeKey) => {
    setRange(k);
    setActivePreset(null);
  }, []);

  const handlePresetChange = useCallback((key: PresetKey) => {
    const w = computePreset(key);
    setRange(w.range);
    setActivePreset(key);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, u, c, f] = await Promise.all([
        callActivity("kpis", range),
        callActivity("per_user", range),
        callActivity("charts", range),
        callActivity("funnel", range),
      ]);
      setKpis(k);
      setUsers(u.rows ?? []);
      setCharts(c);
      setFunnel(f);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const expandUser = useCallback(async (userId: string) => {
    if (expanded === userId) { setExpanded(null); return; }
    setExpanded(userId);
    if (timeline[userId]) return;
    try {
      const d = await callActivity("user_timeline", range, { user_id: userId });
      setTimeline((prev) => ({ ...prev, [userId]: d.events ?? [] }));
    } catch (e) {
      console.error(e);
    }
  }, [expanded, range, timeline]);

  const sortedUsers = useMemo(() => {
    if (!users) return [];
    const sorted = [...users].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    return sorted;
  }, [users, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc((p) => !p);
    else { setSortKey(k); setSortAsc(false); }
  };

  if (error) {
    return (
      <div className="p-6 text-sm" style={{ color: "#E07A5F" }}>
        Failed to load activity: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Range picker + preset chips */}
      <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] tracking-widest" style={{ color: TEXT, opacity: 0.6 }}>RANGE:</span>
        {RANGES.map((r) => {
          const isActive = range === r.key && activePreset === null;
          return (
            <button
              key={r.key}
              onClick={() => handleRangeChange(r.key)}
              className="px-3 py-1.5 text-[10px] tracking-widest rounded transition-colors"
              style={{
                border: `1px solid ${isActive ? GOLD : BORDER}`,
                background: isActive ? "rgba(201,168,76,0.1)" : "transparent",
                color: isActive ? GOLD : TEXT,
                minHeight: 32,
              }}
            >
              {r.label.toUpperCase()}
            </button>
          );
        })}
        <button
          onClick={load}
          className="ml-auto px-3 py-1.5 text-[10px] tracking-widest rounded"
          style={{ border: `1px solid ${BORDER}`, color: TEXT, minHeight: 32 }}
        >
          REFRESH
        </button>
      </div>

      {/* Preset chips */}
      <div className="flex items-center gap-2 flex-wrap pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-[10px] tracking-widest" style={{ color: TEXT, opacity: 0.4 }}>PRESET:</span>
        {PRESETS.map((p) => {
          const isActive = activePreset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => handlePresetChange(p.key)}
              className="px-3 py-1 text-[12px] rounded-full border transition-colors"
              style={{
                fontFamily: "'Courier New', monospace",
                background: isActive ? GOLD : "#0f0e0a",
                color: isActive ? "#080806" : "#C9A84C",
                borderColor: "#C9A84C",
                minHeight: 28,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "#1a1810";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "#0f0e0a";
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading || !kpis ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Kpi label="Daily Active" value={kpis.dau} />
            <Kpi label="Weekly Active" value={kpis.wau} />
            <Kpi label="Monthly Active" value={kpis.mau} />
            <Kpi
              label="Median Session"
              value={kpis.median_session_ms != null ? fmtDuration(kpis.median_session_ms) : "—"}
              sub={kpis.sessions_counted > 0 ? `${kpis.sessions_counted} sessions` : "Awaiting first sessions"}
            />
          </>
        )}
      </div>

      {/* Per-user table */}
      <Section title="Per-User Activity (30d)">
        {loading || !users ? (
          <Skeleton className="h-48" />
        ) : users.length === 0 ? (
          <Empty>No users.</Empty>
        ) : (
          <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 6 }}>
            <table className="w-full text-[11px]" style={{ color: TEXT }}>
              <thead>
                <tr style={{ background: "rgba(201,168,76,0.05)", borderBottom: `1px solid ${BORDER}` }}>
                  {[
                    ["email", "Email"],
                    ["last_seen", "Last Seen"],
                    ["sessions_30d", "Sessions"],
                    ["total_30d", "Events"],
                    ["chat_30d", "Chat"],
                    ["added_30d", "Added"],
                    ["edited_30d", "Edited"],
                    ["favourites_30d", "Favs"],
                    ["notes_30d", "Notes"],
                  ].map(([k, l]) => (
                    <th
                      key={k}
                      onClick={() => toggleSort(k as SortKey)}
                      className="px-3 py-2 text-left tracking-wider cursor-pointer select-none"
                      style={{ color: GOLD, fontSize: 10 }}
                    >
                      {l.toUpperCase()}
                      {sortKey === k && <span className="ml-1">{sortAsc ? "▲" : "▼"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, i) => (
                  <>
                    <tr
                      key={u.user_id}
                      onClick={() => expandUser(u.user_id)}
                      className="cursor-pointer transition-colors"
                      style={{
                        background: i % 2 ? "rgba(201,168,76,0.02)" : "transparent",
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2">{fmtDate(u.last_seen)}</td>
                      <td className="px-3 py-2">{u.sessions_30d}</td>
                      <td className="px-3 py-2">{u.total_30d}</td>
                      <td className="px-3 py-2">{u.chat_30d}</td>
                      <td className="px-3 py-2">{u.added_30d}</td>
                      <td className="px-3 py-2">{u.edited_30d}</td>
                      <td className="px-3 py-2">{u.favourites_30d}</td>
                      <td className="px-3 py-2">{u.notes_30d}</td>
                    </tr>
                    {expanded === u.user_id && (
                      <tr key={u.user_id + "-exp"}>
                        <td colSpan={9} style={{ background: "#080806", padding: 12 }}>
                          <div className="text-[10px] tracking-widest mb-2" style={{ color: GOLD }}>
                            LAST 50 EVENTS
                          </div>
                          {!timeline[u.user_id] ? (
                            <Skeleton className="h-32" />
                          ) : timeline[u.user_id].length === 0 ? (
                            <Empty>No activity yet.</Empty>
                          ) : (
                            <div className="space-y-1 max-h-72 overflow-y-auto">
                              {timeline[u.user_id].map((ev) => (
                                <div
                                  key={ev.id}
                                  className="flex items-start gap-2 px-2 py-1 rounded"
                                  style={{ background: "rgba(201,168,76,0.03)" }}
                                >
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] tracking-wider whitespace-nowrap"
                                    style={{ background: "rgba(201,168,76,0.15)", color: GOLD }}
                                  >
                                    {ev.event_type}
                                  </span>
                                  <span className="text-[10px]" style={{ color: TEXT, opacity: 0.6 }}>
                                    {fmtDate(ev.created_at)}
                                  </span>
                                  {ev.entity_ref && (
                                    <span className="text-[10px] truncate" style={{ color: TEXT, opacity: 0.8 }}>
                                      {ev.entity_ref}
                                    </span>
                                  )}
                                  {ev.metadata && (
                                    <span className="text-[10px] truncate flex-1" style={{ color: TEXT, opacity: 0.5 }}>
                                      {JSON.stringify(ev.metadata).slice(0, 200)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Engagement charts */}
      <Section title="Engagement (30d window)">
        {loading || !charts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Daily Active Users">
              {charts.dauSeries.length === 0 ? <Empty>No data.</Empty> : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.dauSeries}>
                    <CartesianGrid stroke={BORDER} />
                    <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 10 }} />
                    <YAxis tick={{ fill: TEXT, fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} />
                    <Line type="monotone" dataKey="dau" stroke={GOLD} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Events per Day by Type">
              {charts.stacked.length === 0 ? <Empty>No data.</Empty> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.stacked}>
                    <CartesianGrid stroke={BORDER} />
                    <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 10 }} />
                    <YAxis tick={{ fill: TEXT, fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} />
                    <Legend wrapperStyle={{ fontSize: 9, color: TEXT }} />
                    {charts.eventTypes.map((t: string, i: number) => (
                      <Bar key={t} dataKey={t} stackId="a" fill={STACK_COLORS[i % STACK_COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Top Pages (last 7d)">
              {charts.topPages.length === 0 ? <Empty>No page views logged yet.</Empty> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.topPages} layout="vertical">
                    <CartesianGrid stroke={BORDER} />
                    <XAxis type="number" tick={{ fill: TEXT, fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="path" tick={{ fill: TEXT, fontSize: 10 }} width={120} />
                    <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} />
                    <Bar dataKey="count" fill={GOLD} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Chat Volume">
              {charts.chatSeries.length === 0 ? <Empty>No chat activity yet.</Empty> : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.chatSeries}>
                    <CartesianGrid stroke={BORDER} />
                    <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: TEXT, fontSize: 10 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: TEXT, fontSize: 10 }} />
                    <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} />
                    <Legend wrapperStyle={{ fontSize: 9, color: TEXT }} />
                    <Line yAxisId="left" type="monotone" dataKey="messages" stroke={GOLD} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="avg_length" stroke="#4A90D9" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        )}
      </Section>

      {/* Funnel */}
      <Section title="Activation Funnel">
        {loading || !funnel ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {funnel.steps.map((s: any, i: number) => {
              const prev = i > 0 ? funnel.steps[i - 1].count : null;
              const pct = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
              return (
                <div
                  key={s.label}
                  className="p-4 rounded text-center"
                  style={{ background: BG, border: `1px solid ${BORDER}` }}
                >
                  <div className="text-[10px] tracking-widest mb-2" style={{ color: TEXT, opacity: 0.6 }}>
                    {`${i + 1}. ${s.label.toUpperCase()}`}
                  </div>
                  <div className="text-2xl font-bold" style={{ color: GOLD }}>
                    {s.count}
                  </div>
                  {pct != null && (
                    <div className="text-[10px] mt-1" style={{ color: TEXT, opacity: 0.6 }}>
                      {pct}% of prior step
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="p-4 rounded" style={{ background: BG, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] tracking-widest mb-2" style={{ color: TEXT, opacity: 0.6 }}>
        {label.toUpperCase()}
      </div>
      <div className="text-2xl font-bold" style={{ color: GOLD }}>{value ?? "—"}</div>
      {sub && <div className="text-[10px] mt-1" style={{ color: TEXT, opacity: 0.5 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-widest mb-3" style={{ color: GOLD }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded" style={{ background: BG, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] tracking-widest mb-2" style={{ color: TEXT, opacity: 0.7 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-8 text-[11px]" style={{ color: TEXT, opacity: 0.4 }}>
      {children}
    </div>
  );
}

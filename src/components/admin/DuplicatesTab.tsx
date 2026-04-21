import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LotRecord = {
  id: string;
  source: string;
  sale_date: string;
  variant_grade_key: string;
  cardback_code: string;
  total_paid_gbp: number | null;
  lot_ref: string;
  lot_url: string;
  image_urls: string[] | null;
};

type Pair = { a: LotRecord; b: LotRecord };

type ScanResponse = {
  pairs?: Pair[];
  pairsReturned?: number;
  pairsTotal?: number;
  truncated?: boolean;
  stats?: { flagged: number; ignored: number; merged: number };
  error?: string;
  details?: string;
};

const GOLD = "#C9A84C";
const BG = "#080806";
const TEXT = "#e0d8c0";

const fmtGBP = (v: number | null | undefined) =>
  v == null ? "—" : `£${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

export default function DuplicatesTab() {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairsTotal, setPairsTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [stats, setStats] = useState({ flagged: 0, ignored: 0, merged: 0 });
  const [mergeTarget, setMergeTarget] = useState<Pair | null>(null);
  const [busyPairKey, setBusyPairKey] = useState<string | null>(null);

  const scan = useCallback(async () => {
    const pin = sessionStorage.getItem("admin_pin");
    if (!pin) {
      toast.error("No admin PIN — re-authenticate.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<ScanResponse>(
        "duplicate-scan",
        { body: { pin } },
      );
      if (error) {
        toast.error(`Scan failed: ${error.message}`);
        return;
      }
      if (data?.error) {
        toast.error(`Scan failed: ${data.error}${data.details ? ` — ${data.details}` : ""}`);
        return;
      }
      setPairs(data?.pairs ?? []);
      setPairsTotal(data?.pairsTotal ?? 0);
      setTruncated(Boolean(data?.truncated));
      setStats(data?.stats ?? { flagged: 0, ignored: 0, merged: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const handleMarkDistinct = async (pair: Pair) => {
    const pin = sessionStorage.getItem("admin_pin");
    if (!pin) return;
    const key = `${pair.a.id}-${pair.b.id}`;
    setBusyPairKey(key);
    try {
      const { data, error } = await supabase.functions.invoke("duplicate-mark-distinct", {
        body: { pin, lotIdA: pair.a.id, lotIdB: pair.b.id },
      });
      if (error || data?.error) {
        toast.error(`Failed: ${error?.message ?? data?.error}`);
        return;
      }
      toast.success("Pair marked as distinct");
      setPairs((prev) => prev.filter((p) => !(p.a.id === pair.a.id && p.b.id === pair.b.id)));
      setStats((s) => ({ ...s, ignored: s.ignored + 1, flagged: Math.max(0, s.flagged - 1) }));
      setPairsTotal((n) => Math.max(0, n - 1));
    } finally {
      setBusyPairKey(null);
    }
  };

  const handleOpenBoth = (pair: Pair) => {
    if (pair.a.lot_url) window.open(pair.a.lot_url, "_blank", "noopener,noreferrer");
    if (pair.b.lot_url) window.open(pair.b.lot_url, "_blank", "noopener,noreferrer");
  };

  const performMerge = async (keepId: string, deleteId: string) => {
    const pin = sessionStorage.getItem("admin_pin");
    if (!pin || !mergeTarget) return;
    const key = `${mergeTarget.a.id}-${mergeTarget.b.id}`;
    setBusyPairKey(key);
    try {
      const { data, error } = await supabase.functions.invoke("duplicate-merge", {
        body: { pin, keepLotId: keepId, deleteLotId: deleteId },
      });
      if (error || data?.error) {
        toast.error(`Merge failed: ${error?.message ?? data?.error}`);
        return;
      }
      toast.success("Records merged");
      setPairs((prev) =>
        prev.filter(
          (p) =>
            !(p.a.id === mergeTarget.a.id && p.b.id === mergeTarget.b.id),
        ),
      );
      setStats((s) => ({ ...s, merged: s.merged + 1, flagged: Math.max(0, s.flagged - 1) }));
      setPairsTotal((n) => Math.max(0, n - 1));
      setMergeTarget(null);
    } finally {
      setBusyPairKey(null);
    }
  };

  const StatCard = ({ label, value }: { label: string; value: number }) => (
    <div
      className="flex-1 min-w-[140px] p-4 rounded"
      style={{ border: `1px solid rgba(201,168,76,0.25)`, background: "#0D0D0B" }}
    >
      <div className="text-[10px] tracking-widest mb-1" style={{ color: TEXT, opacity: 0.55 }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: GOLD }}>
        {value.toLocaleString()}
      </div>
    </div>
  );

  return (
    <div style={{ background: BG, color: TEXT }} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-bold tracking-widest" style={{ color: GOLD }}>
          SUSPECTED DUPLICATES — {pairsTotal} {pairsTotal === 1 ? "PAIR" : "PAIRS"} FLAGGED
        </h2>
        <button
          onClick={scan}
          disabled={loading}
          className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
          style={{
            border: `1px solid ${GOLD}`,
            color: GOLD,
            background: "transparent",
            opacity: loading ? 0.5 : 1,
            minHeight: 44,
          }}
        >
          {loading ? "SCANNING…" : "RE-SCAN"}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <StatCard label="PAIRS FLAGGED" value={stats.flagged} />
        <StatCard label="PAIRS IGNORED" value={stats.ignored} />
        <StatCard label="RECORDS MERGED" value={stats.merged} />
      </div>

      {truncated && (
        <div
          className="p-3 rounded text-xs"
          style={{
            border: `1px solid rgba(201,168,76,0.4)`,
            background: "rgba(201,168,76,0.08)",
            color: GOLD,
          }}
        >
          Showing first {pairs.length} of {pairsTotal} flagged pairs. Resolve these and re-scan to see the rest.
        </div>
      )}

      {!loading && pairs.length === 0 && (
        <div
          className="p-8 text-center rounded"
          style={{ border: `1px solid rgba(201,168,76,0.2)`, background: "#0D0D0B" }}
        >
          <p className="text-sm" style={{ color: TEXT }}>
            No suspected duplicates found. ✓
          </p>
        </div>
      )}

      <div className="space-y-4">
        {pairs.map((pair) => {
          const key = `${pair.a.id}-${pair.b.id}`;
          const busy = busyPairKey === key;
          return (
            <div
              key={key}
              className="rounded p-4"
              style={{ border: `1px solid rgba(201,168,76,0.25)`, background: "#0D0D0B" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <RecordCard lot={pair.a} label="RECORD A" />
                <RecordCard lot={pair.b} label="RECORD B" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setMergeTarget(pair)}
                  disabled={busy}
                  className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
                  style={{
                    background: GOLD,
                    color: BG,
                    opacity: busy ? 0.5 : 1,
                    minHeight: 44,
                  }}
                >
                  MERGE
                </button>
                <button
                  onClick={() => handleMarkDistinct(pair)}
                  disabled={busy}
                  className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
                  style={{
                    border: `1px solid ${GOLD}`,
                    color: GOLD,
                    background: "transparent",
                    opacity: busy ? 0.5 : 1,
                    minHeight: 44,
                  }}
                >
                  MARK AS DISTINCT
                </button>
                <button
                  onClick={() => handleOpenBoth(pair)}
                  disabled={busy}
                  className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
                  style={{
                    border: `1px solid rgba(201,168,76,0.4)`,
                    color: TEXT,
                    background: "transparent",
                    minHeight: 44,
                  }}
                >
                  OPEN BOTH
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!mergeTarget} onOpenChange={(o) => !o && setMergeTarget(null)}>
        <DialogContent style={{ background: "#0D0D0B", border: `1px solid ${GOLD}`, color: TEXT }}>
          <DialogHeader>
            <DialogTitle style={{ color: GOLD }}>Confirm Merge</DialogTitle>
            <DialogDescription style={{ color: TEXT, opacity: 0.7 }}>
              Choose which record to keep. The other will be deleted. Empty fields on the kept record will be backfilled from the other where possible.
            </DialogDescription>
          </DialogHeader>
          {mergeTarget && (
            <div className="space-y-2 text-xs">
              <div><strong style={{ color: GOLD }}>A:</strong> {mergeTarget.a.lot_ref} — {mergeTarget.a.sale_date} — {fmtGBP(mergeTarget.a.total_paid_gbp)}</div>
              <div><strong style={{ color: GOLD }}>B:</strong> {mergeTarget.b.lot_ref} — {mergeTarget.b.sale_date} — {fmtGBP(mergeTarget.b.total_paid_gbp)}</div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              onClick={() => mergeTarget && performMerge(mergeTarget.a.id, mergeTarget.b.id)}
              className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
              style={{ background: GOLD, color: BG, minHeight: 44 }}
            >
              KEEP A — DELETE B
            </button>
            <button
              onClick={() => mergeTarget && performMerge(mergeTarget.b.id, mergeTarget.a.id)}
              className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
              style={{ background: GOLD, color: BG, minHeight: 44 }}
            >
              KEEP B — DELETE A
            </button>
            <button
              onClick={() => setMergeTarget(null)}
              className="px-4 py-2 rounded text-[11px] font-bold tracking-widest"
              style={{ border: `1px solid ${GOLD}`, color: GOLD, background: "transparent", minHeight: 44 }}
            >
              CANCEL
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecordCard({ lot, label }: { lot: LotRecord; label: string }) {
  const img = lot.image_urls?.[0];
  return (
    <div
      className="p-3 rounded"
      style={{ border: `1px solid rgba(201,168,76,0.2)`, background: BG }}
    >
      <div
        className="text-[10px] tracking-widest mb-2"
        style={{ color: GOLD, opacity: 0.7 }}
      >
        {label}
      </div>
      <div className="flex gap-3">
        <div
          className="flex-shrink-0 w-20 h-20 rounded overflow-hidden flex items-center justify-center"
          style={{ background: "#1a1a18", border: "1px solid rgba(201,168,76,0.15)" }}
        >
          {img ? (
            <img src={img} alt={lot.lot_ref} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[9px] tracking-wider" style={{ color: TEXT, opacity: 0.4 }}>
              NO IMAGE
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 text-xs space-y-1">
          <Row k="Source" v={lot.source} />
          <Row k="Sale Date" v={lot.sale_date} />
          <Row k="Cardback" v={lot.cardback_code} />
          <Row k="Variant·Grade" v={lot.variant_grade_key} />
          <Row k="Total Paid" v={fmtGBP(lot.total_paid_gbp)} />
          <Row k="Lot Ref" v={lot.lot_ref} />
          {lot.lot_url && (
            <a
              href={lot.lot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[11px] block truncate"
              style={{ color: GOLD }}
            >
              View lot ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="flex-shrink-0" style={{ color: TEXT, opacity: 0.5, minWidth: 80 }}>{k}:</span>
      <span className="truncate" style={{ color: TEXT }}>{v || "—"}</span>
    </div>
  );
}

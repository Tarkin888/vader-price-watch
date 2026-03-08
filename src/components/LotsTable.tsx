import { useState, useMemo } from "react";
import type { Lot } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import LotFormModal from "@/components/LotFormModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SortKey = "sale_date" | "variant_grade_key" | "total_paid_gbp" | "hammer_price_gbp" | "buyers_premium_gbp";
type SortDir = "asc" | "desc";

interface LotsTableProps {
  lots: Lot[];
  onChanged: () => void;
  onCopyRow?: (lot: Lot) => void;
  onSelectLot?: (lot: Lot) => void;
}

const SORTABLE_COLS: { key: SortKey; label: string; align?: string }[] = [
  { key: "sale_date", label: "SALE DATE" },
  { key: "variant_grade_key", label: "VARIANT-GRADE" },
  { key: "total_paid_gbp", label: "TOTAL (£)", align: "text-right" },
  { key: "hammer_price_gbp", label: "HAMMER", align: "text-right" },
  { key: "buyers_premium_gbp", label: "BP", align: "text-right" },
];

const NOTABLE_THRESHOLD = 5000;

const LotsTable = ({ lots, onChanged, onCopyRow, onSelectLot }: LotsTableProps) => {
  const [editLot, setEditLot] = useState<Lot | null>(null);
  const [deleteLot, setDeleteLot] = useState<Lot | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("sale_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...lots];
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] as any;
      let bv: string | number = b[sortKey] as any;
      if (["total_paid_gbp", "hammer_price_gbp", "buyers_premium_gbp"].includes(sortKey)) {
        av = Number(av); bv = Number(bv);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [lots, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const copyRow = (l: Lot) => {
    const fields = [
      l.capture_date, l.sale_date, l.source, l.lot_ref, l.variant_code,
      l.grade_tier_code, l.variant_grade_key, l.hammer_price_gbp,
      l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate, l.condition_notes,
    ];
    navigator.clipboard.writeText(fields.join("\t"));
    toast.success("Row copied to clipboard");
    onCopyRow?.(l);
  };

  const handleDelete = async () => {
    if (!deleteLot) return;
    const { error } = await supabase.from("lots").delete().eq("id", deleteLot.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
    } else {
      toast.success("Lot deleted");
      onChanged();
    }
    setDeleteLot(null);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowDown className="w-2.5 h-2.5 opacity-20 inline ml-1" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-2.5 h-2.5 text-primary inline ml-1" />
      : <ArrowDown className="w-2.5 h-2.5 text-primary inline ml-1" />;
  };

  if (lots.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground text-sm tracking-wider">
        NO RECORDS MATCH CURRENT FILTERS
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground tracking-widest text-left">
              {SORTABLE_COLS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 cursor-pointer select-none hover:text-primary transition-colors ${col.align ?? ""}`}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}<SortIcon col={col.key} />
                </th>
              ))}
              <th className="px-3 py-2">SOURCE</th>
              <th className="px-3 py-2">LOT REF</th>
              <th className="px-3 py-2">NOTES</th>
              <th className="px-3 py-2">IMG</th>
              <th className="px-3 py-2">ACT</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap">{l.sale_date}</td>
                <td className="px-3 py-2 text-primary font-bold whitespace-nowrap">{l.variant_grade_key}</td>
                <td className="px-3 py-2 text-right text-primary font-bold">
                  £{Number(l.total_paid_gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right">
                  £{Number(l.hammer_price_gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right">
                  £{Number(l.buyers_premium_gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2">{l.source}</td>
                <td className="px-3 py-2">
                  {l.lot_url ? (
                    <a href={l.lot_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {l.lot_ref} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : l.lot_ref}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={l.condition_notes}>{l.condition_notes}</td>
                <td className="px-3 py-2">
                  {l.image_urls.length > 0 ? (
                    <a href={l.image_urls[0]} target="_blank" rel="noopener noreferrer">
                      <img src={l.image_urls[0]} alt="lot" className="w-8 h-10 object-cover border border-border hover:border-primary transition-colors" />
                    </a>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => copyRow(l)} className="text-muted-foreground hover:text-primary transition-colors" title="Copy row">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditLot(l)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit lot">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteLot(l)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete lot">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LotFormModal
        open={!!editLot}
        onOpenChange={(o) => { if (!o) setEditLot(null); }}
        onSaved={onChanged}
        editLot={editLot}
      />

      <AlertDialog open={!!deleteLot} onOpenChange={(o) => { if (!o) setDeleteLot(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary tracking-wider text-sm">CONFIRM DELETION</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs tracking-wider">
              Delete lot <span className="text-primary font-bold">{deleteLot?.variant_grade_key}</span> ({deleteLot?.lot_ref})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs tracking-wider">CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground text-xs tracking-wider hover:bg-destructive/90">
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LotsTable;

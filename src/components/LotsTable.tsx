import { useState } from "react";
import type { Lot } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
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

interface LotsTableProps {
  lots: Lot[];
  onChanged: () => void;
}

const LotsTable = ({ lots, onChanged }: LotsTableProps) => {
  const [editLot, setEditLot] = useState<Lot | null>(null);
  const [deleteLot, setDeleteLot] = useState<Lot | null>(null);

  const copyRow = (l: Lot) => {
    const fields = [
      l.capture_date, l.sale_date, l.source, l.lot_ref, l.variant_code,
      l.grade_tier_code, l.variant_grade_key, l.hammer_price_gbp,
      l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate, l.condition_notes,
    ];
    navigator.clipboard.writeText(fields.join("\t"));
    toast.success("Row copied to clipboard");
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
              <th className="px-3 py-2">SALE DATE</th>
              <th className="px-3 py-2">SOURCE</th>
              <th className="px-3 py-2">VARIANT-GRADE</th>
              <th className="px-3 py-2 text-right">TOTAL (£)</th>
              <th className="px-3 py-2 text-right">HAMMER</th>
              <th className="px-3 py-2 text-right">BP</th>
              <th className="px-3 py-2">LOT REF</th>
              <th className="px-3 py-2">NOTES</th>
              <th className="px-3 py-2">IMG</th>
              <th className="px-3 py-2">ACT</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="px-3 py-2 whitespace-nowrap">{l.sale_date}</td>
                <td className="px-3 py-2">{l.source}</td>
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

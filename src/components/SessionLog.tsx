import type { Lot } from "@/lib/db";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  copiedRows: Lot[];
  onClear: () => void;
}

const SessionLog = ({ copiedRows, onClear }: Props) => {
  if (copiedRows.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-muted-foreground text-xs tracking-wider">
        NO ROWS COPIED THIS SESSION — USE THE COPY ICON ON ANY ROW
      </div>
    );
  }

  const copyAll = () => {
    const headers = [
      "captureDate", "saleDate", "source", "lotRef", "variantCode",
      "gradeTierCode", "variantGradeKey", "hammerPriceGBP",
      "buyersPremiumGBP", "totalPaidGBP", "usdToGbpRate", "conditionNotes",
    ];
    const lines = copiedRows.map((l) => [
      l.capture_date, l.sale_date, l.source, l.lot_ref, l.variant_code,
      l.grade_tier_code, l.variant_grade_key, l.hammer_price_gbp,
      l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate, l.condition_notes,
    ].join("\t"));
    navigator.clipboard.writeText([headers.join("\t"), ...lines].join("\n"));
    toast.success(`Copied ${copiedRows.length} rows to clipboard`);
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border">
        <Button variant="outline" size="sm" onClick={copyAll} className="text-xs tracking-wider border-border hover:border-primary hover:text-primary">
          <Copy className="w-3 h-3 mr-1" /> Copy All ({copiedRows.length})
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} className="text-xs tracking-wider border-border hover:border-destructive hover:text-destructive">
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground tracking-widest text-left">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">SALE DATE</th>
              <th className="px-3 py-2">VARIANT-GRADE</th>
              <th className="px-3 py-2 text-right">TOTAL (£)</th>
              <th className="px-3 py-2">SOURCE</th>
              <th className="px-3 py-2">LOT REF</th>
            </tr>
          </thead>
          <tbody>
            {copiedRows.map((l, i) => (
              <tr key={`${l.id}-${i}`} className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">{l.sale_date}</td>
                <td className="px-3 py-2 text-primary font-bold">{l.variant_grade_key}</td>
                <td className="px-3 py-2 text-right text-primary font-bold">
                  £{Number(l.total_paid_gbp).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2">{l.source}</td>
                <td className="px-3 py-2">{l.lot_ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SessionLog;

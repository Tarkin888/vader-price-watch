import type { Lot } from "@/lib/db";
import { Download } from "lucide-react";

interface ExportCSVProps {
  lots: Lot[];
}

const ExportCSV = ({ lots }: ExportCSVProps) => {
  const exportCsv = () => {
    const headers = [
      "captureDate", "saleDate", "source", "era", "cardbackCode", "lotRef",
      "variantCode", "gradeTierCode", "variantGradeKey", "hammerPriceGBP",
      "buyersPremiumGBP", "totalPaidGBP", "usdToGbpRate", "conditionNotes",
    ];
    const rows = lots.map((l) => [
      l.capture_date, l.sale_date, l.source, (l as any).era ?? "", (l as any).cardback_code ?? "",
      l.lot_ref, l.variant_code, l.grade_tier_code, l.variant_grade_key,
      l.hammer_price_gbp, l.buyers_premium_gbp, l.total_paid_gbp, l.usd_to_gbp_rate,
      `"${(l.condition_notes ?? "").replace(/"/g, '""')}"`,
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vader-prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={exportCsv}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary tracking-wider transition-colors px-3 py-2"
    >
      <Download className="w-3.5 h-3.5" />
      EXPORT CSV ({lots.length})
    </button>
  );
};

export default ExportCSV;

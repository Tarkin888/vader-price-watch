import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { classifyLot, deriveFromVariantCode } from "@/lib/classify-lot";
import {
  calculatePrices,
  generateFbLotRef,
  type ExtractedData,
  type CalculatedPrices,
} from "@/lib/screenshot-prices";

interface Props {
  extracted: ExtractedData;
  onSave: (record: Record<string, unknown>) => void;
  onBack: () => void;
  saving: boolean;
  imageSrc?: string;
}

type Confidence = "extracted" | "inferred" | "missing";

function dot(c: Confidence) {
  const colors = { extracted: "bg-green-500", inferred: "bg-amber-500", missing: "bg-red-500" };
  const labels = {
    extracted: "Extracted directly from screenshot",
    inferred: "Inferred / auto-classified",
    missing: "Unknown — please fill in",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[c]}`}
      aria-label={labels[c]}
      title={labels[c]}
    />
  );
}

const SOURCES = ["Heritage", "Hakes", "LCG", "Vectis", "CandT", "eBay", "Facebook", "Other"];

// Map non-enum variant values Claude might return to valid enum values
const VARIANT_ALIASES: Record<string, string> = {
  "TRILOGO": "PAL-TL",
  "TRI-LOGO": "PAL-TL",
  "PALITOY": "PAL",
  "CANADIAN": "CAN",
  "BILINGUAL": "CAN",
  "MEXICO": "MEX",
  "LILI LEDY": "MEX",
  "DOUBLE TELESCOPING": "SW-12-DT",
};

function normalizeVariant(val: string | null): string | null {
  if (!val) return val;
  const upper = val.toUpperCase().trim();
  return VARIANT_ALIASES[upper] ?? val;
}

const ExtractionReviewForm = ({ extracted, onSave, onBack, saving, imageSrc }: Props) => {
  // Classify from title
  const classified = useMemo(() => {
    const text = [extracted.title, extracted.conditionNotes].filter(Boolean).join(" ");
    return classifyLot(text);
  }, [extracted]);

  // Merge: prefer Claude's non-null/non-UNKNOWN values, then classifier
  const pick = (claude: string | null, classified: string, fallback = "UNKNOWN") => {
    if (claude && claude !== "UNKNOWN" && claude !== "Other") return { value: claude, conf: "extracted" as Confidence };
    if (classified !== "UNKNOWN") return { value: classified, conf: "inferred" as Confidence };
    return { value: fallback, conf: "missing" as Confidence };
  };

  const era = pick(extracted.era, classified.era);
  const cardback = pick(extracted.cardbackCode, classified.cardback_code);
  const variant = pick(normalizeVariant(extracted.variantCode), classified.variant_code);
  const grade = pick(extracted.gradeTierCode, classified.grade_tier_code);

  // State for all fields
  const [source, setSource] = useState(extracted.source ?? "Other");
  const [lotRef, setLotRef] = useState(
    extracted.lotRef ?? (source === "Facebook" ? generateFbLotRef(extracted.saleDate, extracted.title) : "")
  );
  const [lotUrl, setLotUrl] = useState(extracted.lotUrl ?? "");
  const [saleDate, setSaleDate] = useState(extracted.saleDate ?? "");
  const [title, setTitle] = useState(extracted.title ?? "");
  const [eraVal, setEraVal] = useState(era.value);
  const [cardbackVal, setCardbackVal] = useState(cardback.value);
  const [variantVal, setVariantVal] = useState(variant.value);
  const [gradeVal, setGradeVal] = useState(grade.value);
  const [conditionNotes, setConditionNotes] = useState(extracted.conditionNotes ?? "");
  const [estimateOnly, setEstimateOnly] = useState(false);

  // Prices
  const [prices, setPrices] = useState<CalculatedPrices>(() => calculatePrices(extracted));
  const [hammerGBP, setHammerGBP] = useState(String(prices.hammerPriceGBP));
  const [bpGBP, setBpGBP] = useState(String(prices.buyersPremiumGBP));
  const [totalGBP, setTotalGBP] = useState(String(prices.totalPaidGBP));
  const [usdRate, setUsdRate] = useState(String(prices.usdToGbpRate));

  useEffect(() => {
    if (prices.priceStatus === "ESTIMATE_ONLY") setEstimateOnly(true);
  }, [prices.priceStatus]);

  // Inline field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sourceRef = useRef<HTMLSelectElement>(null);
  const saleDateRef = useRef<HTMLInputElement>(null);
  const hammerRef = useRef<HTMLInputElement>(null);
  const cardbackRef = useRef<HTMLInputElement>(null);

  const recalculate = () => {
    const p = calculatePrices(extracted);
    setPrices(p);
    setHammerGBP(String(p.hammerPriceGBP));
    setBpGBP(String(p.buyersPremiumGBP));
    setTotalGBP(String(p.totalPaidGBP));
    setUsdRate(String(p.usdToGbpRate));
  };

  const isUSD = source === "Heritage" || source === "Hakes" || lotUrl.includes("ebay.com");

  const handleSubmit = () => {
    // Pre-submit validation — populate inline errors, focus the first invalid
    // field, and never hit the edge function if anything is missing.
    const newErrors: Record<string, string> = {};
    const today = new Date().toISOString().slice(0, 10);

    if (!source || !SOURCES.includes(source)) {
      newErrors.source = "Source is required";
    }
    if (!saleDate) {
      newErrors.saleDate = "Sale date is required";
    } else if (saleDate < "1977-01-01" || saleDate > today) {
      newErrors.saleDate = "Sale date must be between 1977-01-01 and today";
    }
    const hammerNum = parseFloat(hammerGBP);
    if (!hammerGBP || Number.isNaN(hammerNum) || hammerNum <= 0) {
      newErrors.hammerGBP = "Hammer price must be greater than 0";
    }
    if (!cardbackVal || cardbackVal.trim() === "") {
      newErrors.cardback = "Cardback code is required (UNKNOWN is acceptable)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please complete the highlighted fields before saving.");
      // Focus the first invalid field in top-to-bottom form order.
      const focusOrder: Array<[string, React.RefObject<HTMLElement>]> = [
        ["source", sourceRef],
        ["saleDate", saleDateRef],
        ["hammerGBP", hammerRef],
        ["cardback", cardbackRef],
      ];
      for (const [key, ref] of focusOrder) {
        if (newErrors[key]) {
          ref.current?.focus();
          break;
        }
      }
      return;
    }

    // Also guard total_paid — computed from hammer + BP, but if the user has
    // manually zeroed it, block the save rather than persisting a £0 record.
    if (parseFloat(totalGBP) <= 0) {
      setErrors({ hammerGBP: "Total paid must be greater than 0 — check hammer & BP" });
      toast.error("Please complete the highlighted fields before saving.");
      hammerRef.current?.focus();
      return;
    }

    setErrors({});

    // Derive variant_grade_key
    const vgk = `${variantVal}-${gradeVal}`;

    onSave({
      source,
      lot_ref: lotRef,
      lot_url: lotUrl,
      sale_date: saleDate || new Date().toISOString().slice(0, 10),
      capture_date: new Date().toISOString().slice(0, 10),
      era: eraVal,
      cardback_code: cardbackVal,
      variant_code: variantVal,
      grade_tier_code: gradeVal,
      variant_grade_key: vgk,
      hammer_price_gbp: parseFloat(hammerGBP) || 0,
      buyers_premium_gbp: parseFloat(bpGBP) || 0,
      total_paid_gbp: parseFloat(totalGBP) || 0,
      usd_to_gbp_rate: parseFloat(usdRate) || 1,
      condition_notes: conditionNotes,
      image_urls: extracted.imageUrls ?? [],
      price_status: estimateOnly ? "ESTIMATE_ONLY" : "CONFIRMED",
    });
  };

  const labelClass = "text-[10px] tracking-wider text-muted-foreground font-mono flex items-center gap-1";
  const inputClass =
    "w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground font-mono focus:border-[#C9A84C] focus:outline-none";
  const errorInputClass =
    "w-full bg-background border border-red-500 rounded px-2 py-1.5 text-xs text-foreground font-mono focus:border-red-500 focus:outline-none";
  const errorTextClass = "text-[9px] text-red-500 tracking-wider font-mono mt-0.5";

  return (
    <div className="space-y-4">
      {/* Thumbnail */}
      {imageSrc && (
        <div className="flex justify-end">
          <img
            src={imageSrc}
            alt="Screenshot"
            className="w-[120px] h-auto border border-[#C9A84C] rounded"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-2">
          <div>
            <label className={labelClass}>{dot(extracted.source ? "extracted" : "missing")} Source</label>
            <select
              ref={sourceRef}
              value={source}
              onChange={(e) => { setSource(e.target.value); if (errors.source) setErrors((prev) => { const n = { ...prev }; delete n.source; return n; }); }}
              className={errors.source ? errorInputClass : inputClass}
              aria-invalid={!!errors.source}
            >
              {SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            {errors.source && <p className={errorTextClass}>{errors.source}</p>}
          </div>
          <div>
            <label className={labelClass}>{dot(extracted.lotRef ? "extracted" : "missing")} Lot Reference</label>
            <input value={lotRef} onChange={(e) => setLotRef(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{dot(extracted.lotUrl ? "extracted" : "missing")} Lot URL</label>
            <input value={lotUrl} onChange={(e) => setLotUrl(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{dot(extracted.saleDate ? "extracted" : "missing")} Sale Date</label>
            <input
              ref={saleDateRef}
              type="date"
              value={saleDate}
              onChange={(e) => { setSaleDate(e.target.value); if (errors.saleDate) setErrors((prev) => { const n = { ...prev }; delete n.saleDate; return n; }); }}
              className={errors.saleDate ? errorInputClass : inputClass}
              aria-invalid={!!errors.saleDate}
            />
            {errors.saleDate ? (
              <p className={errorTextClass}>{errors.saleDate}</p>
            ) : !saleDate ? (
              <p className="text-[9px] text-amber-400/80 tracking-wider font-mono mt-0.5">
                Date not found — please enter manually
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>{dot(extracted.title ? "extracted" : "missing")} Lot Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <div>
            <label className={labelClass}>{dot(era.conf)} Era</label>
            <input value={eraVal} onChange={(e) => setEraVal(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{dot(cardback.conf)} Cardback Code</label>
            <input
              ref={cardbackRef}
              value={cardbackVal}
              onChange={(e) => { setCardbackVal(e.target.value); if (errors.cardback) setErrors((prev) => { const n = { ...prev }; delete n.cardback; return n; }); }}
              className={errors.cardback ? errorInputClass : inputClass}
              aria-invalid={!!errors.cardback}
            />
            {errors.cardback && <p className={errorTextClass}>{errors.cardback}</p>}
          </div>
          <div>
            <label className={labelClass}>{dot(variant.conf)} Variant Code</label>
            <input value={variantVal} onChange={(e) => setVariantVal(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{dot(grade.conf)} Grade Tier</label>
            <input value={gradeVal} onChange={(e) => setGradeVal(e.target.value)} className={inputClass} />
          </div>

          {/* Prices */}
          <div>
            <label className={labelClass}>{dot("extracted")} Hammer Price (GBP)</label>
            <input
              ref={hammerRef}
              type="number"
              step="0.01"
              value={hammerGBP}
              onChange={(e) => { setHammerGBP(e.target.value); if (errors.hammerGBP) setErrors((prev) => { const n = { ...prev }; delete n.hammerGBP; return n; }); }}
              className={errors.hammerGBP ? errorInputClass : inputClass}
              aria-invalid={!!errors.hammerGBP}
            />
            {errors.hammerGBP && <p className={errorTextClass}>{errors.hammerGBP}</p>}
          </div>
          <div>
            <label className={labelClass}>{dot("inferred")} Buyer's Premium (GBP)</label>
            <input type="number" step="0.01" value={bpGBP} onChange={(e) => setBpGBP(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{dot("extracted")} Total Paid (GBP)</label>
            <input
              type="number"
              step="0.01"
              value={totalGBP}
              onChange={(e) => setTotalGBP(e.target.value)}
              className={`${inputClass} text-[#C9A84C] font-bold`}
            />
          </div>
          {isUSD && (
            <div>
              <label className={labelClass}>{dot("inferred")} USD→GBP Rate</label>
              <input type="number" step="0.01" value={usdRate} onChange={(e) => setUsdRate(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <label className={labelClass}>{dot(extracted.conditionNotes ? "extracted" : "missing")} Condition Notes</label>
            <textarea value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} rows={2} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Recalculate + Estimate checkbox */}
      <div className="flex items-center justify-between">
        <button onClick={recalculate} className="text-[#C9A84C] text-[10px] tracking-wider font-mono underline">
          Recalculate prices
        </button>
        <label className="flex items-center gap-1.5 text-[10px] tracking-wider text-muted-foreground font-mono">
          <input type="checkbox" checked={estimateOnly} onChange={(e) => setEstimateOnly(e.target.checked)} />
          Mark as ESTIMATE ONLY
        </label>
      </div>

      {cardbackVal === "UNKNOWN" && (
        <div className="text-amber-400 text-[10px] tracking-wider font-mono p-2 border border-amber-400/30 rounded">
          ⚠ Cardback code is UNKNOWN — you can still save, but consider reviewing.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-2 text-xs tracking-wider font-mono border border-border rounded text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2 text-sm tracking-wider font-mono bg-[#C9A84C] text-background rounded disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Record"}
        </button>
      </div>
    </div>
  );
};

export default ExtractionReviewForm;

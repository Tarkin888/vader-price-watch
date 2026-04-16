import { useState, useEffect } from "react";
import { Constants } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import type { Lot, LotInsert } from "@/lib/db";
import { deriveFromVariantCode } from "@/lib/classify-lot";
import { logActivity } from "@/lib/activity-log";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SOURCES = Constants.public.Enums.lot_source;
const VARIANTS = Constants.public.Enums.variant_code;
const GRADES = Constants.public.Enums.grade_tier_code;
const ERAS = ["SW", "ESB", "ROTJ", "POTF", "UNKNOWN"] as const;
const CARDBACK_CODES = [
  "SW-12", "SW-12A", "SW-12A-DT", "SW-12B", "SW-12B-DT", "SW-12C", "SW-20", "SW-21",
  "ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48",
  "ROTJ-48", "ROTJ-65", "ROTJ-65A", "ROTJ-65B", "ROTJ-65D", "ROTJ-65-VP", "ROTJ-70", "ROTJ-77", "ROTJ-79", "ROTJ-79A", "ROTJ-79B",
  "POTF-92",
  "UNKNOWN",
] as const;

const MIN_DATE = "1977-01-01";
const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editLot?: Lot | null;
}

function lotToForm(lot: Lot) {
  return {
    capture_date: lot.capture_date,
    sale_date: lot.sale_date,
    source: lot.source,
    lot_ref: lot.lot_ref,
    lot_url: lot.lot_url,
    era: lot.era ?? "UNKNOWN",
    cardback_code: lot.cardback_code ?? "UNKNOWN",
    variant_code: lot.variant_code,
    grade_tier_code: lot.grade_tier_code,
    hammer_price_gbp: String(lot.hammer_price_gbp),
    buyers_premium_gbp: String(lot.buyers_premium_gbp),
    total_paid_gbp: String(lot.total_paid_gbp),
    usd_to_gbp_rate: String(lot.usd_to_gbp_rate),
    image_urls: lot.image_urls.join(", "),
    condition_notes: lot.condition_notes,
    grade_subgrades: lot.grade_subgrades,
  };
}

const defaultForm = () => {
  const d = today();
  return {
    capture_date: d,
    sale_date: d,
    source: SOURCES[0] as string,
    lot_ref: "",
    lot_url: "",
    era: "UNKNOWN" as string,
    cardback_code: "UNKNOWN" as string,
    variant_code: VARIANTS[0] as string,
    grade_tier_code: GRADES[0] as string,
    hammer_price_gbp: "",
    buyers_premium_gbp: "",
    total_paid_gbp: "",
    usd_to_gbp_rate: "0.79",
    image_urls: "",
    condition_notes: "",
    grade_subgrades: "",
  };
};

type FormErrors = Record<string, string>;

function validateDate(val: string): string | null {
  if (!val) return "This field is required";
  if (val < MIN_DATE || val > today()) return "Date must be between 1977 and today.";
  return null;
}

function validate(form: ReturnType<typeof defaultForm>): FormErrors {
  const e: FormErrors = {};
  if (!form.source) e.source = "This field is required";
  if (!form.era) e.era = "This field is required";
  if (!form.cardback_code) e.cardback_code = "This field is required";
  const tp = parseFloat(form.total_paid_gbp);
  if (!form.total_paid_gbp || isNaN(tp) || tp <= 0) e.total_paid_gbp = "Must be a positive number";
  const sdErr = validateDate(form.sale_date);
  if (sdErr) e.sale_date = sdErr;
  const cdErr = validateDate(form.capture_date);
  if (cdErr) e.capture_date = cdErr;
  return e;
}

const LotFormModal = ({ open, onOpenChange, onSaved, editLot }: Props) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(editLot ? lotToForm(editLot) : defaultForm());
      setErrors({});
    }
  }, [open, editLot]);

  const set = (key: string, val: string) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "variant_code") {
        const derived = deriveFromVariantCode(val);
        next.era = derived.era;
        next.cardback_code = derived.cardback_code;
      }
      return next;
    });
    // Clear error on change
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const selectClass =
    "w-full bg-secondary border border-border text-foreground text-xs px-2 py-2 tracking-wider focus:outline-none focus:ring-1 focus:ring-primary";
  const inputClass = "bg-secondary border-border text-xs tracking-wider";

  const handleSubmit = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      const data: LotInsert = {
        capture_date: form.capture_date,
        sale_date: form.sale_date,
        source: form.source as any,
        lot_ref: form.lot_ref,
        lot_url: form.lot_url,
        era: form.era as any,
        cardback_code: form.cardback_code,
        variant_code: form.variant_code as any,
        grade_tier_code: form.grade_tier_code as any,
        hammer_price_gbp: parseFloat(form.hammer_price_gbp) || 0,
        buyers_premium_gbp: parseFloat(form.buyers_premium_gbp) || 0,
        total_paid_gbp: parseFloat(form.total_paid_gbp) || 0,
        usd_to_gbp_rate: parseFloat(form.usd_to_gbp_rate) || 1,
        image_urls: form.image_urls ? form.image_urls.split(",").map((s) => s.trim()) : [],
        condition_notes: form.condition_notes,
        grade_subgrades: form.grade_subgrades,
      };

      if (editLot) {
        const res = await adminWrite({ table: "lots", operation: "update", data, match: { column: "id", value: editLot.id } });
        if (!res.success) throw new Error(res.error);

        // Fire-and-forget audit log entries for each changed field
        const auditEntries: { lot_id: string; lot_ref: string; action: string; field_changed: string; old_value: string; new_value: string }[] = [];
        const fieldsToCheck: (keyof typeof data)[] = [
          "capture_date", "sale_date", "source", "era", "cardback_code", "variant_code",
          "grade_tier_code", "hammer_price_gbp", "buyers_premium_gbp", "total_paid_gbp",
          "usd_to_gbp_rate", "condition_notes", "lot_ref", "lot_url", "grade_subgrades",
        ];
        for (const field of fieldsToCheck) {
          const oldVal = String((editLot as any)[field] ?? "");
          const newVal = String(data[field] ?? "");
          if (oldVal !== newVal) {
            auditEntries.push({
              lot_id: editLot.id,
              lot_ref: data.lot_ref || editLot.lot_ref,
              action: "EDIT",
              field_changed: field,
              old_value: oldVal,
              new_value: newVal,
            });
          }
        }
        if (auditEntries.length > 0) {
          adminWrite({ table: "audit_log", operation: "insert", data: auditEntries });
        }

        toast.success("Lot updated successfully");
        logActivity("record_edited", editLot.lot_ref, { lot_id: editLot.id, fields_changed: auditEntries.length });
      } else {
        const res = await adminWrite({ table: "lots", operation: "insert", data });
        if (!res.success) throw new Error(res.error);
        adminWrite({ table: "audit_log", operation: "insert", data: { lot_ref: data.lot_ref, action: "INSERT" } });
        toast.success("Lot added successfully");
        logActivity("record_added", data.lot_ref);
      }

      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error("Failed to save lot: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby="lot-form-desc">
        <DialogHeader>
          <DialogTitle className="text-primary tracking-wider text-sm">
            {editLot ? "EDIT LOT RECORD" : "ADD NEW LOT RECORD"}
          </DialogTitle>
          <DialogDescription id="lot-form-desc" className="sr-only">
            Form to add or edit an auction lot record
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Field label="Capture Date" error={errors.capture_date}>
            <Input type="date" required min={MIN_DATE} max={today()} value={form.capture_date} onChange={(e) => set("capture_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Sale Date *" error={errors.sale_date}>
            <Input type="date" required min={MIN_DATE} max={today()} value={form.sale_date} onChange={(e) => set("sale_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Source *" error={errors.source}>
            <select className={selectClass} required value={form.source} onChange={(e) => set("source", e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Era *" error={errors.era}>
            <select className={selectClass} required value={form.era} onChange={(e) => set("era", e.target.value)}>
              {ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Cardback Code *" error={errors.cardback_code}>
            <select className={selectClass} required value={form.cardback_code} onChange={(e) => set("cardback_code", e.target.value)}>
              {CARDBACK_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Variant Code">
            <select className={selectClass} value={form.variant_code} onChange={(e) => set("variant_code", e.target.value)}>
              {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Grade Tier">
            <select className={selectClass} value={form.grade_tier_code} onChange={(e) => set("grade_tier_code", e.target.value)}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="USD/GBP Rate">
            <Input type="number" step="0.01" value={form.usd_to_gbp_rate} onChange={(e) => set("usd_to_gbp_rate", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Hammer Price (£)">
            <Input type="number" step="0.01" value={form.hammer_price_gbp} onChange={(e) => set("hammer_price_gbp", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Buyer's Premium (£)">
            <Input type="number" step="0.01" value={form.buyers_premium_gbp} onChange={(e) => set("buyers_premium_gbp", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Total Paid (£) *" span={2} error={errors.total_paid_gbp}>
            <Input type="number" step="0.01" required value={form.total_paid_gbp} onChange={(e) => set("total_paid_gbp", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Lot Ref">
            <Input value={form.lot_ref} onChange={(e) => set("lot_ref", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Lot URL">
            <Input value={form.lot_url} onChange={(e) => set("lot_url", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Image URLs (comma-separated)" span={2}>
            <Input value={form.image_urls} onChange={(e) => set("image_urls", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Condition Notes" span={2}>
            <Textarea value={form.condition_notes} onChange={(e) => set("condition_notes", e.target.value)} className="bg-secondary border-border text-xs tracking-wider min-h-[60px]" />
          </Field>
          <Field label="Grade Subgrades" span={2}>
            <Input value={form.grade_subgrades} onChange={(e) => set("grade_subgrades", e.target.value)} className={inputClass} placeholder="e.g. C80 B85 F80" />
          </Field>
        </div>
        <div className="flex justify-end mt-3">
          <Button onClick={handleSubmit} disabled={saving} className="text-xs tracking-wider">
            {saving ? "SAVING..." : editLot ? "UPDATE LOT" : "SAVE LOT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function Field({ label, children, span, error }: { label: string; children: React.ReactNode; span?: number; error?: string }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

export default LotFormModal;

import { useState, useEffect } from "react";
import { Constants } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { Lot, LotInsert } from "@/lib/db";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SOURCES = Constants.public.Enums.lot_source;
const VARIANTS = Constants.public.Enums.variant_code;
const GRADES = Constants.public.Enums.grade_tier_code;
const ERAS = ["SW", "ESB", "ROTJ", "POTF", "UNKNOWN"] as const;
const CARDBACK_CODES = [
  "SW-12", "SW-20", "SW-21",
  "ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48",
  "ROTJ-65", "ROTJ-77", "ROTJ-79",
  "POTF-92",
  "UNKNOWN",
] as const;

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
  const today = new Date().toISOString().slice(0, 10);
  return {
    capture_date: today,
    sale_date: today,
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

const LotFormModal = ({ open, onOpenChange, onSaved, editLot }: Props) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm());

  useEffect(() => {
    if (open) {
      setForm(editLot ? lotToForm(editLot) : defaultForm());
    }
  }, [open, editLot]);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const selectClass =
    "w-full bg-secondary border border-border text-foreground text-xs px-2 py-2 tracking-wider focus:outline-none focus:ring-1 focus:ring-primary";
  const inputClass = "bg-secondary border-border text-xs tracking-wider";

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const data: LotInsert = {
        capture_date: form.capture_date,
        sale_date: form.sale_date,
        source: form.source as any,
        lot_ref: form.lot_ref,
        lot_url: form.lot_url,
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
        const { error } = await supabase.from("lots").update(data).eq("id", editLot.id);
        if (error) throw error;
        toast.success("Lot updated successfully");
      } else {
        const { error } = await supabase.from("lots").insert(data);
        if (error) throw error;
        toast.success("Lot added successfully");
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
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary tracking-wider text-sm">
            {editLot ? "EDIT LOT RECORD" : "ADD NEW LOT RECORD"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Field label="Capture Date">
            <Input type="date" value={form.capture_date} onChange={(e) => set("capture_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Sale Date">
            <Input type="date" value={form.sale_date} onChange={(e) => set("sale_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Source">
            <select className={selectClass} value={form.source} onChange={(e) => set("source", e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
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
          <Field label="Total Paid (£)" span={2}>
            <Input type="number" step="0.01" value={form.total_paid_gbp} onChange={(e) => set("total_paid_gbp", e.target.value)} className={inputClass} />
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

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">{label}</label>
      {children}
    </div>
  );
}

export default LotFormModal;

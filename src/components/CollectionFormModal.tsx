import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CATEGORIES, GRADINGS, PURCHASE_SOURCES,
  upsertCollectionItem, getNextItemId,
  type CollectionItem,
} from "@/lib/collection-db";

const MIN_DATE = "1977-01-01";
const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  editItem?: CollectionItem | null;
}

type FormErrors = Record<string, string>;

function validateDate(val: string): string | null {
  if (!val) return "This field is required";
  if (val < MIN_DATE || val > todayStr()) return "Date must be between 1977 and today.";
  return null;
}

const CollectionFormModal = ({ open, onOpenChange, onSaved, editItem }: Props) => {
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [grading, setGrading] = useState<string>(GRADINGS[0]);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseSource, setPurchaseSource] = useState<string>(PURCHASE_SOURCES[0]);
  const [customSource, setCustomSource] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editItem) {
      setItemId(editItem.item_id);
      setDescription(editItem.description);
      setCategory(editItem.category);
      setGrading(editItem.grading);
      setPurchasePrice(String(editItem.purchase_price));
      setPurchaseDate(editItem.purchase_date);
      const knownSource = PURCHASE_SOURCES.find((s) => s === editItem.purchase_source);
      if (knownSource) {
        setPurchaseSource(knownSource);
        setCustomSource("");
      } else {
        setPurchaseSource("Other");
        setCustomSource(editItem.purchase_source);
      }
      setEstimatedValue(editItem.current_estimated_value != null ? String(editItem.current_estimated_value) : "");
      setNotes(editItem.notes);
    } else {
      getNextItemId().then(setItemId);
      setDescription(""); setCategory(CATEGORIES[0]); setGrading(GRADINGS[0]);
      setPurchasePrice(""); setPurchaseDate(""); setPurchaseSource(PURCHASE_SOURCES[0]);
      setCustomSource(""); setEstimatedValue(""); setNotes("");
    }
  }, [open, editItem]);

  const clearError = (key: string) => {
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const handleSave = async () => {
    const errs: FormErrors = {};
    if (!description.trim()) errs.description = "This field is required";
    const pp = parseFloat(purchasePrice);
    if (!purchasePrice || isNaN(pp) || pp <= 0) errs.purchasePrice = "Must be a positive number";
    const dateErr = validateDate(purchaseDate);
    if (dateErr) errs.purchaseDate = dateErr;

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      const source = purchaseSource === "Other" && customSource ? customSource : purchaseSource;
      await upsertCollectionItem(
        {
          item_id: itemId,
          description,
          category,
          grading,
          purchase_price: parseFloat(purchasePrice),
          purchase_date: purchaseDate,
          purchase_source: source,
          current_estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
          notes,
        },
        editItem?.id
      );
      toast.success(editItem ? "Item updated" : "Item added");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "bg-secondary border border-border text-foreground text-xs px-2 py-1.5 tracking-wider focus:outline-none focus:ring-1 focus:ring-primary w-full h-8";
  const labelClass = "text-[10px] text-muted-foreground tracking-widest uppercase";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby="collection-form-desc">
        <DialogHeader>
          <DialogTitle className="text-primary tracking-wider text-sm">
            {editItem ? "EDIT COLLECTION ITEM" : "ADD COLLECTION ITEM"}
          </DialogTitle>
          <DialogDescription id="collection-form-desc" className="sr-only">
            Form to add or edit a collection inventory item
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Item ID</label>
            <Input value={itemId} readOnly className="bg-secondary border-border text-xs tracking-wider h-8 opacity-60" />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label className={labelClass}>Description *</label>
            <Input required value={description} onChange={(e) => { setDescription(e.target.value); clearError("description"); }} className="bg-secondary border-border text-xs tracking-wider h-8" />
            {errors.description && <p className="text-[10px] text-destructive">{errors.description}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Category</label>
            <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Grading</label>
            <select className={selectClass} value={grading} onChange={(e) => setGrading(e.target.value)}>
              {GRADINGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Purchase Price (£) *</label>
            <Input type="number" required value={purchasePrice} onChange={(e) => { setPurchasePrice(e.target.value); clearError("purchasePrice"); }} className="bg-secondary border-border text-xs tracking-wider h-8" />
            {errors.purchasePrice && <p className="text-[10px] text-destructive">{errors.purchasePrice}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Purchase Date *</label>
            <Input type="date" required min={MIN_DATE} max={todayStr()} value={purchaseDate} onChange={(e) => { setPurchaseDate(e.target.value); clearError("purchaseDate"); }} className="bg-secondary border-border text-xs tracking-wider h-8" />
            {errors.purchaseDate && <p className="text-[10px] text-destructive">{errors.purchaseDate}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Source</label>
            <select className={selectClass} value={purchaseSource} onChange={(e) => setPurchaseSource(e.target.value)}>
              {PURCHASE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {purchaseSource === "Other" && (
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Custom Source</label>
              <Input value={customSource} onChange={(e) => setCustomSource(e.target.value)} className="bg-secondary border-border text-xs tracking-wider h-8" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Est. Value (£)</label>
            <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} className="bg-secondary border-border text-xs tracking-wider h-8" />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label className={labelClass}>Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-secondary border-border text-xs tracking-wider h-8" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" className="text-xs tracking-wider" onClick={() => onOpenChange(false)}>CANCEL</Button>
          <Button size="sm" className="text-xs tracking-wider" onClick={handleSave} disabled={saving}>
            {saving ? "SAVING..." : "SAVE"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CollectionFormModal;

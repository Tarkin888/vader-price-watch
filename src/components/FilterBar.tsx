import { Constants } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCES = Constants.public.Enums.lot_source;
const GRADES = Constants.public.Enums.grade_tier_code;
const ERAS = ["SW", "ESB", "ROTJ", "POTF"] as const;

const CARDBACK_GROUPS: { label: string; codes: string[] }[] = [
  { label: "SW", codes: ["SW-12", "SW-12A", "SW-12A-DT", "SW-12B", "SW-12B-DT", "SW-12C", "SW-20", "SW-21"] },
  { label: "ESB", codes: ["ESB-31", "ESB-32", "ESB-41", "ESB-45", "ESB-47", "ESB-48"] },
  { label: "ROTJ", codes: ["ROTJ-48", "ROTJ-65", "ROTJ-65-VP", "ROTJ-77", "ROTJ-79"] },
  { label: "POTF", codes: ["POTF-92"] },
  { label: "International", codes: ["CAN", "PAL", "MEX"] },
];

export type Currency = "GBP" | "USD";

export interface Filters {
  source: string | null;
  era: string | null;
  cardbackCode: string | null;
  variantCode: string | null;
  gradeTier: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  search: string;
  currency: Currency;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const FilterBar = ({ filters, onChange }: FilterBarProps) => {
  const set = (key: keyof Filters, val: any) => onChange({ ...filters, [key]: val });

  const selectClass =
    "bg-secondary border border-border text-foreground text-xs px-2 py-1.5 tracking-wider focus:outline-none focus:ring-1 focus:ring-primary";

  // Filter cardback groups by selected era
  const visibleGroups = filters.era
    ? CARDBACK_GROUPS.filter((g) => g.label === filters.era || g.label === "International")
    : CARDBACK_GROUPS;

  return (
    <div className="flex flex-wrap items-end gap-3 px-6 py-3 border-b border-border">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Search</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search lots..."
            className="bg-secondary border-border text-xs tracking-wider pl-7 h-8 w-44"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Source</label>
        <select className={selectClass} value={filters.source ?? ""} onChange={(e) => set("source", e.target.value || null)}>
          <option value="">ALL</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Era</label>
        <select className={selectClass} value={filters.era ?? ""} onChange={(e) => {
          const era = e.target.value || null;
          onChange({ ...filters, era, cardbackCode: null });
        }}>
          <option value="">ALL</option>
          {ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Cardback</label>
        <select className={selectClass} value={filters.cardbackCode ?? ""} onChange={(e) => set("cardbackCode", e.target.value || null)}>
          <option value="">ALL</option>
          {visibleGroups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.codes.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Grade</label>
        <select className={selectClass} value={filters.gradeTier ?? ""} onChange={(e) => set("gradeTier", e.target.value || null)}>
          <option value="">ALL</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <DateFilter label="From" value={filters.dateFrom} onChange={(d) => set("dateFrom", d)} />
      <DateFilter label="To" value={filters.dateTo} onChange={(d) => set("dateTo", d)} />

      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-primary tracking-wider"
        onClick={() => onChange({ source: null, era: null, cardbackCode: null, variantCode: null, gradeTier: null, dateFrom: null, dateTo: null, search: "" })}
      >
        <X className="w-3 h-3 mr-1" /> CLEAR
      </Button>
    </div>
  );
};

function DateFilter({ label, value, onChange }: { label: string; value: Date | null; onChange: (d: Date | null) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground tracking-widest uppercase">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "text-xs justify-start tracking-wider border-border bg-secondary",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="w-3 h-3 mr-1" />
            {value ? format(value, "yyyy-MM-dd") : "ANY"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => onChange(d ?? null)}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default FilterBar;

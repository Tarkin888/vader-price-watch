import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const CARDBACK_VARIANTS = [
  { era: "SW", code: "SW-12", desc: "Standard 12-back cardback (generic)", value: "Baseline" },
  { era: "SW", code: "SW-12A", desc: "12-back A, first release", value: "Baseline" },
  { era: "SW", code: "SW-12A-DT", desc: "12A with double-telescoping lightsaber", value: "Highest premium" },
  { era: "SW", code: "SW-12B", desc: "Second wave 12-back cardback", value: "Slightly lower" },
  { era: "SW", code: "SW-12B-DT", desc: "12B with double-telescoping lightsaber", value: "Very high premium" },
  { era: "SW", code: "SW-12C", desc: "Third wave 12-back cardback", value: "Lower" },
  { era: "SW", code: "SW-20", desc: "20-back cardback", value: "Moderate" },
  { era: "SW", code: "SW-21", desc: "21-back cardback", value: "Moderate" },
  { era: "ESB", code: "ESB-31", desc: "Empire Strikes Back 31-back", value: "Mid-range" },
  { era: "ESB", code: "ESB-32", desc: "Empire Strikes Back 32-back", value: "Mid-range" },
  { era: "ESB", code: "ESB-41", desc: "Empire Strikes Back 41-back", value: "Mid-range" },
  { era: "ESB", code: "ESB-45", desc: "Empire Strikes Back 45-back", value: "Mid-range" },
  { era: "ESB", code: "ESB-47", desc: "Empire Strikes Back 47-back", value: "Mid-range" },
  { era: "ESB", code: "ESB-48", desc: "Empire Strikes Back 48-back", value: "Mid-range" },
  { era: "ROTJ", code: "ROTJ-48", desc: "Return of the Jedi 48-back", value: "Mid-range" },
  { era: "ROTJ", code: "ROTJ-65", desc: "Return of the Jedi 65-back", value: "Common" },
  { era: "ROTJ", code: "ROTJ-65-VP", desc: "65-back Vader pointing variant", value: "Uncommon" },
  { era: "ROTJ", code: "ROTJ-77", desc: "Return of the Jedi 77-back", value: "Common" },
  { era: "ROTJ", code: "ROTJ-70", desc: "Return of the Jedi 70-back (Tri-Logo / Palitoy)", value: "Regional premium" },
  { era: "ROTJ", code: "ROTJ-79", desc: "Return of the Jedi 79-back", value: "Common" },
  { era: "POTF", code: "POTF-92", desc: "Power of the Force 92-back", value: "High premium" },
  { era: "INT", code: "CAN", desc: "Canadian release variant", value: "Regional premium" },
  { era: "INT", code: "PAL", desc: "Palitoy (UK) release variant", value: "Regional premium" },
  { era: "INT", code: "MEX", desc: "Lili Ledy (Mexico) release variant", value: "Regional premium" },
];

const GRADES = [
  { code: "RAW-NM", desc: "Ungraded, Near Mint condition", premium: "Baseline (ungraded)" },
  { code: "RAW-EX", desc: "Ungraded, Excellent condition", premium: "−10–20% vs NM" },
  { code: "RAW-VG", desc: "Ungraded, Very Good condition", premium: "−25–40% vs NM" },
  { code: "AFA-70", desc: "AFA graded 70", premium: "+20–30% vs RAW-NM" },
  { code: "AFA-75", desc: "AFA graded 75", premium: "+40–60% vs RAW-NM" },
  { code: "AFA-80", desc: "AFA graded 80", premium: "+80–120% vs RAW-NM" },
  { code: "AFA-85", desc: "AFA graded 85", premium: "+150–250% vs RAW-NM" },
  { code: "AFA-90+", desc: "AFA graded 90 or above", premium: "+400%+ vs RAW-NM" },
  { code: "UKG-80", desc: "UKG graded 80", premium: "+60–100% vs RAW-NM" },
  { code: "UKG-85", desc: "UKG graded 85", premium: "+120–200% vs RAW-NM" },
  { code: "CAS-80", desc: "CAS graded 80", premium: "+50–90% vs RAW-NM" },
];

const ERA_COLORS: Record<string, string> = {
  SW: "hsl(210, 35%, 47%)",
  ESB: "hsl(40, 12%, 49%)",
  ROTJ: "hsl(0, 43%, 44%)",
  POTF: "hsl(45, 50%, 54%)",
  INT: "hsl(180, 15%, 45%)",
};

const ReferencePanel = () => {
  const [open, setOpen] = useState(false);

  // Group variants by era
  const eras = ["SW", "ESB", "ROTJ", "POTF", "INT"];

  return (
    <div className="relative ml-auto">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-muted-foreground tracking-widest uppercase hover:text-primary transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        REFERENCE PANEL
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[700px] border border-border bg-background shadow-lg rounded-md p-4 grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] text-primary tracking-widest uppercase mb-2">
              Cardback Variant Codes
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground tracking-widest">
                  <th className="py-1 text-left">CODE</th>
                  <th className="py-1 text-left">DESCRIPTION</th>
                  <th className="py-1 text-left">RELATIVE VALUE</th>
                </tr>
              </thead>
              <tbody>
                {eras.map((era) => {
                  const items = CARDBACK_VARIANTS.filter((v) => v.era === era);
                  if (items.length === 0) return null;
                  return items.map((v) => (
                    <tr key={v.code} className="border-b border-border/30">
                      <td className="py-1 font-bold" style={{ color: ERA_COLORS[era] }}>
                        {v.code}
                      </td>
                      <td className="py-1">{v.desc}</td>
                      <td className="py-1 text-muted-foreground">{v.value}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-[10px] text-primary tracking-widest uppercase mb-2">
              Grade Tier Codes
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground tracking-widest">
                  <th className="py-1 text-left">CODE</th>
                  <th className="py-1 text-left">DESCRIPTION</th>
                  <th className="py-1 text-left">PREMIUM vs RAW-NM</th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((g) => (
                  <tr key={g.code} className="border-b border-border/30">
                    <td className="py-1 text-primary font-bold">{g.code}</td>
                    <td className="py-1">{g.desc}</td>
                    <td className="py-1 text-muted-foreground">{g.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferencePanel;

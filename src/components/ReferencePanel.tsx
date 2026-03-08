import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const VARIANTS = [
  { code: "12A", desc: "Standard 12-back cardback, first release", value: "Baseline" },
  { code: "12B", desc: "Second wave 12-back cardback", value: "Slightly lower" },
  { code: "12C", desc: "Third wave 12-back cardback", value: "Lower" },
  { code: "12A-DT", desc: "12A with double-telescoping lightsaber", value: "Highest premium" },
  { code: "12B-DT", desc: "12B with double-telescoping lightsaber", value: "Very high premium" },
  { code: "CAN", desc: "Canadian release variant", value: "Regional premium" },
  { code: "PAL", desc: "Palitoy (UK) release variant", value: "Regional premium" },
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

const ReferencePanel = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-6 py-2 text-[10px] text-muted-foreground tracking-widest uppercase hover:text-primary transition-colors w-full text-left"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        REFERENCE PANEL
      </button>
      {open && (
        <div className="px-6 pb-4 grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] text-primary tracking-widest uppercase mb-2">Variant Codes</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground tracking-widest">
                  <th className="py-1 text-left">CODE</th>
                  <th className="py-1 text-left">DESCRIPTION</th>
                  <th className="py-1 text-left">RELATIVE VALUE</th>
                </tr>
              </thead>
              <tbody>
                {VARIANTS.map((v) => (
                  <tr key={v.code} className="border-b border-border/30">
                    <td className="py-1 text-primary font-bold">{v.code}</td>
                    <td className="py-1">{v.desc}</td>
                    <td className="py-1 text-muted-foreground">{v.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-[10px] text-primary tracking-widest uppercase mb-2">Grade Tier Codes</h3>
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

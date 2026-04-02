import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import ThemeToggle from "@/components/ThemeToggle";

/* ───────── data ───────── */

const TIMELINE_NODES = [
  { era: "SW", label: "SW", years: "1977–1979", sub: "12-back → 21-back" },
  { era: "ESB", label: "ESB", years: "1980–1982", sub: "31-back → 48-back" },
  { era: "ROTJ", label: "ROTJ", years: "1983–1984", sub: "48-back → 79-back" },
  { era: "POTF", label: "POTF", years: "1985", sub: "92-back" },
];

const MASTER_TABLE = [
  { code: "SW-12A", era: "SW", cardback: "12-Back A", year: "1977–78", features: "Action Display Stand offer; DT saber instructions; earliest release", rarity: "★★★★★", notes: "15–25% premium over SW-12C" },
  { code: "SW-12A-DT", era: "SW", cardback: "12-Back A Double-Telescoping", year: "1977–78", features: "Inner saber wick visible; ~3 carded examples known worldwide", rarity: "★★★★★ (EXTREME)", notes: "£30k–£60k+ range" },
  { code: "SW-12B", era: "SW", cardback: "12-Back B", year: "1978", features: "POP cut-out for second Display Stand; minor text variation", rarity: "★★★★☆", notes: "5–10% premium over SW-12C" },
  { code: "SW-12B-DT", era: "SW", cardback: "12-Back B Double-Telescoping", year: "1978", features: "DT saber on 12B card; one documented example", rarity: "★★★★★ (EXTREME)", notes: "Comparable to SW-12A-DT" },
  { code: "SW-12C", era: "SW", cardback: "12-Back C", year: "1978", features: "Shortened saber instruction text vs 12B; most common 12-back", rarity: "★★★☆☆", notes: "Baseline value for 12-back Vader" },
  { code: "SW-20", era: "SW", cardback: "20-Back", year: "1978–79", features: "Boba Fett mail-away offer on some variants; 20-figure grid", rarity: "★★★☆☆", notes: "Two sub-variants A and B; Boba Fett offer adds premium" },
  { code: "SW-21", era: "SW", cardback: "21-Back", year: "1979", features: "Adds Luke X-Wing Pilot to grid; multiple sub-variants A–G", rarity: "★★★☆☆", notes: "Sub-variants differ by offer and factory COO stamps" },
  { code: "ESB-31", era: "ESB", cardback: "31-Back", year: "1980", features: "First ESB cardback; 31-figure grid; Yoda and Lando added", rarity: "★★★★☆", notes: "Canada ESB 31-backs have bilingual text" },
  { code: "ESB-32", era: "ESB", cardback: "32-Back", year: "1980", features: "Adds 2-1B to the grid; short-run transition card", rarity: "★★★★☆", notes: "Scarcer than ESB-41" },
  { code: "ESB-41", era: "ESB", cardback: "41-Back", year: "1980–81", features: "Full wave 1–2 ESB figures on back; most common ESB card", rarity: "★★★☆☆", notes: "Multiple offer variants; collector-case rebate documented" },
  { code: "ESB-45", era: "ESB", cardback: "45-Back", year: "1981", features: "Imperial Commander added; transitional wave", rarity: "★★★★☆", notes: "Scarcer than ESB-41" },
  { code: "ESB-47", era: "ESB", cardback: "47-Back", year: "1982", features: "4-LOM and others added; near-complete ESB roster", rarity: "★★★☆☆", notes: "AFA examples well documented at Heritage and Hake's" },
  { code: "ESB-48", era: "ESB", cardback: "48-Back", year: "1982", features: "Final ESB back; bridges ESB and ROTJ transition", rarity: "★★★☆☆", notes: "Check title carefully; overlap with ROTJ-48 packaging" },
  { code: "ROTJ-48", era: "ROTJ", cardback: "48-Back ROTJ", year: "1983", features: "ROTJ branding; 48-figure grid; transitional from ESB-48", rarity: "★★★☆☆", notes: "Vader uses standard lightsaber pose" },
  { code: "ROTJ-65A", era: "ROTJ", cardback: "65-Back A", year: "1983", features: "Standard ROTJ front photo (lightsaber raised)", rarity: "★★★☆☆", notes: "Most common ROTJ Vader card; multiple sub-variants A–D" },
  { code: "ROTJ-65B", era: "ROTJ", cardback: "65-Back B", year: "1983", features: "Minor offer and back text differences vs 65A", rarity: "★★★☆☆", notes: "Check back text and offer details to distinguish" },
  { code: "ROTJ-65C", era: "ROTJ", cardback: "65-Back C", year: "1983–84", features: "Further back text variation", rarity: "★★★★☆", notes: "Less common than 65A" },
  { code: "ROTJ-65D", era: "ROTJ", cardback: "65-Back D — Made in Mexico", year: "1984", features: "Lili Ledy; different card finish; Made in Mexico", rarity: "★★★★★", notes: "Rare; POP 2 at AFA per Heritage; distinct collector premium" },
  { code: "ROTJ-65-VP", era: "ROTJ", cardback: "65-Back Vader Pointing", year: "1983–84", features: "Alternate front photo: Vader pointing finger, arm extended", rarity: "★★★★☆", notes: "Confirmed on 65-back; rarer than standard pose" },
  { code: "ROTJ-77", era: "ROTJ", cardback: "77-Back", year: "1984", features: "Expanded figure grid; Canadian 77-backs documented", rarity: "★★★☆☆", notes: "Vader Pointing variant also documented on 77-back" },
  { code: "ROTJ-79A", era: "ROTJ", cardback: "79-Back A", year: "1984", features: "Near-complete ROTJ roster; standard Vader pose", rarity: "★★★☆☆", notes: "AFA 80 examples documented at Brian's Toys and Heritage" },
  { code: "ROTJ-79B", era: "ROTJ", cardback: "79-Back B", year: "1984", features: "Minor variation from 79A; check back text", rarity: "★★★★☆", notes: "Less common than 79A" },
  { code: "POTF-92", era: "POTF", cardback: "92-Back", year: "1985", features: "Coin included in bubble; 92-figure grid; final vintage line", rarity: "★★★★☆", notes: "Vader coin is one of the most collected POTF items" },
  { code: "ROTJ-70", era: "ROTJ", cardback: "70-Back (Tri-Logo / Palitoy)", year: "1984–85", features: "70-figure grid on reverse; Palitoy or Tri-Logo branding; international market (primarily UK/Europe)", rarity: "★★★★☆", notes: "Not a U.S. Kenner cardback. Most examples are PAL-TL variant; some are PAL. Strong at Vectis, Hake's, and Heritage." },
];

const SPOTLIGHT_CARDS = [
  {
    title: "DOUBLE-TELESCOPING SABER (SW-12A-DT / SW-12B-DT)",
    body: "The rarest production variant in the entire vintage Kenner line. The double-telescoping lightsaber has a visible inner wick that extends from the outer tube. Only approximately 3–4 carded SW-12A-DT examples are known to exist worldwide. A SW-12B-DT example with a single documented carded specimen is equally extreme. Prices for graded examples start at £30,000 and can exceed £60,000.",
  },
  {
    title: "VADER POINTING (ROTJ-65-VP)",
    body: "An alternate front-card photograph showing Darth Vader with his right arm raised and finger extended — distinct from the standard lightsaber-raised pose used across most ROTJ Vader cards. Confirmed on the 65-back, 77-back, and 79-back. Rarer than the standard pose on all cardbacks it appears on. Collectors treat this as a standalone variant requiring a separate carded example.",
  },
  {
    title: "MADE IN MEXICO / LILI LEDY (ROTJ-65D)",
    body: "Produced under licence by Lili Ledy for the Mexican market. Features different card stock and finish from U.S. Kenner issues. The ROTJ-65D is the most documented example. At time of writing, the AFA population report shows only POP 2 — making this one of the rarest graded ROTJ Vader cards in any registry. Commands a significant premium over equivalent U.S. issues.",
  },
  {
    title: "POTF COIN (POTF-92)",
    body: "The Power of the Force 92-back is the final release in the vintage Kenner line. Every figure was packaged with a unique collector coin inside the bubble. The Darth Vader coin is among the most sought-after in the set. A complete sealed POTF-92 Vader with coin intact commands a strong premium, with AFA Y-85 examples documented at Heritage Auctions.",
  },
];

const INTL_TABLE = [
  { code: "CAN", market: "Canadian Kenner", cardbacks: "SW-20, SW-21, ESB-31, ESB-41, ROTJ-77", features: "Bilingual English/French card; different logo layout", source: "Vectis; Heritage" },
  { code: "PAL", market: "Palitoy UK", cardbacks: "SW-12, SW-20, ESB series, ROTJ-70", features: "Palitoy branding; UK market; different back layout", source: "Vectis" },
  { code: "PAL-TL", market: "Palitoy Tri-Logo", cardbacks: "ROTJ-70", features: "Tri-Logo branding; European multi-language text; 70-figure grid", source: "Vectis; Heritage; Hake's" },
  { code: "MEX", market: "Lili Ledy Mexico", cardbacks: "ROTJ-65D", features: "Different card stock and finish; Made in Mexico stamping", source: "Heritage; Hake's" },
];

const AUCTION_SOURCES = [
  { name: "Heritage Auctions", location: "Dallas, TX, USA", currency: "USD", premium: "20% (standard)", bestFor: "High-grade AFA figures; major U.S. vintage Star Wars auctions", website: "ha.com", notes: "Largest U.S. auction house for vintage Star Wars" },
  { name: "Hake's Auctions", location: "York, PA, USA", currency: "USD", premium: "22% (varies)", bestFor: "Rare prototypes; DT sabers; pop-culture memorabilia", website: "hakes.com", notes: "Strong track record for record-breaking Star Wars lots" },
  { name: "Vectis Auctions", location: "Thornaby, UK", currency: "GBP", premium: "20.83% inc. VAT", bestFor: "Palitoy; UK/European carded figures; large volume vintage toy sales", website: "vectis.co.uk", notes: "Leading UK vintage toy auction house" },
  { name: "C&T Auctions", location: "Kent, UK", currency: "GBP", premium: "22% + 20% VAT on premium (26.4% inclusive)", bestFor: "Palitoy and Kenner carded figures; UKG/AFA graded lots; dedicated Star Wars auctions", website: "candtauctions.co.uk", notes: "Additional 3–4.95% + VAT surcharge if bidding via the-saleroom.com or EasyLiveAuctions; direct C&T website bids carry no surcharge" },
  { name: "LCG Auctions", location: "Online, UK", currency: "GBP", premium: "Varies", bestFor: "Vintage Star Wars lots; UK-based online auctions", website: "lcgauctions.com", notes: "Specialist vintage toy and Star Wars auctioneer" },
];

const GRADE_TABLE = [
  { code: "RAW-NM", grade: "Ungraded Near Mint", desc: "Sharp corners, clear bubble, no sticker, unpunched tab", premium: "Baseline" },
  { code: "RAW-EX", grade: "Ungraded Excellent", desc: "Light wear, minor corner rounding or small bubble blemish", premium: "−30 to −50%" },
  { code: "RAW-VG", grade: "Ungraded Very Good", desc: "Visible wear, possible sticker residue or POP cut, dented bubble", premium: "−50 to −70%" },
  { code: "AFA-70", grade: "AFA Grade 70", desc: "Excellent; professionally encapsulated", premium: "~Comparable to RAW-NM" },
  { code: "AFA-75", grade: "AFA Grade 75", desc: "Excellent+", premium: "+20 to +40%" },
  { code: "AFA-80", grade: "AFA Grade 80", desc: "Near Mint; solid graded example", premium: "+50 to +80%" },
  { code: "AFA-85", grade: "AFA Grade 85", desc: "Near Mint+; exceptional", premium: "+80 to +150%" },
  { code: "AFA-90+", grade: "AFA Grade 90+", desc: "Mint; investment grade", premium: "+150 to +300%+" },
  { code: "UKG-80", grade: "UKG Grade 80%", desc: "Broadly comparable to AFA 80", premium: "+50 to +80%" },
  { code: "UKG-85", grade: "UKG Grade 85%", desc: "Broadly comparable to AFA 85", premium: "+80 to +150%" },
  { code: "CAS-80", grade: "CAS Grade 80", desc: "Broadly comparable to AFA 80", premium: "+50 to +80%" },
];

const VALUE_RANKING = [
  { era: "SW", highest: "SW-12A-DT / SW-12B-DT", reason: "Double-telescoping saber; only 3–4 known carded examples" },
  { era: "SW", highest: "SW-12A", reason: "Earliest standard release; Action Display Stand offer" },
  { era: "SW", highest: "SW-12B", reason: "POP cut-out; slightly more common than 12A" },
  { era: "SW", highest: "SW-20 / SW-21", reason: "Less collected than 12-backs; still strong demand" },
  { era: "ESB", highest: "ESB-32 / ESB-45", reason: "Shorter production runs; scarcer in high grade" },
  { era: "ESB", highest: "ESB-41 / ESB-47", reason: "Core ESB collector cards; strong Heritage/Hake's volume" },
  { era: "ROTJ", highest: "ROTJ-65D Mexico", reason: "Extremely low POP; Made in Mexico factory variant" },
  { era: "ROTJ", highest: "ROTJ-65-VP", reason: "Vader Pointing alternate photo; rarer than standard ROTJ-65A" },
  { era: "ROTJ", highest: "ROTJ-79 / ROTJ-77", reason: "Standard late-run ROTJ; good market volume" },
  { era: "POTF", highest: "POTF-92", reason: "Coin included; last vintage run; strong demand for complete examples" },
];

const SECTIONS = ["Timeline", "Cardback Table", "Variant Spotlights", "International", "Auction Sources", "Grades & Value"] as const;

const ERA_ROW_BG: Record<string, string> = {
  SW: "rgba(30, 58, 95, 0.18)",
  ESB: "rgba(95, 30, 30, 0.18)",
  ROTJ: "rgba(30, 95, 45, 0.18)",
  POTF: "rgba(75, 30, 95, 0.18)",
};

const ERA_FILTERS = ["All", "SW", "ESB", "ROTJ", "POTF"] as const;

/* ───────── component ───────── */

const KnowledgeHub = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<typeof SECTIONS[number]>("Timeline");
  const [eraFilter, setEraFilter] = useState<string>("All");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filteredMaster = eraFilter === "All" ? MASTER_TABLE : MASTER_TABLE.filter((r) => r.era === eraFilter);

  const scrollToSection = (key: string) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* shared table cell class */
  const thCls = "py-2 px-3 text-left text-[10px] tracking-wider text-primary font-medium border-b border-primary/30 whitespace-nowrap";
  const tdCls = "py-2 px-3 text-xs text-foreground border-b border-border/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* header placeholder — reuse the same header */}
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-primary tracking-wider">
                IMPERIAL PRICE TERMINAL
              </h1>
              <span className="text-[10px] text-muted-foreground tracking-widest">v4.0 | March 2026</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground tracking-wider leading-relaxed">
              SW 12/20/21 &nbsp;•&nbsp; ESB 31/32/41/45/47/48 &nbsp;•&nbsp; ROTJ 48/65/77/79 &nbsp;•&nbsp; POTF 92
              <br />
              C&T &nbsp;•&nbsp; Hake's &nbsp;•&nbsp; Heritage &nbsp;•&nbsp; LCG &nbsp;•&nbsp; Vectis
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* top nav */}
      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <button
          onClick={() => navigate("/")}
          className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          Price Tracker
        </button>
        <button className="text-[10px] tracking-wider px-3 py-1 text-primary border-b border-primary">
          Knowledge Hub
        </button>
        <button
          onClick={() => navigate("/collection")}
          className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          My Collection
        </button>
      </div>

      {/* sub-nav */}
      <div className="flex items-center gap-1 border-b border-border px-6 py-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setActiveSection(s); scrollToSection(s); }}
            className={`text-[10px] tracking-wider px-3 py-1 transition-colors whitespace-nowrap ${
              activeSection === s ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-primary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-12">

        {/* ──── SECTION 1: TIMELINE ──── */}
        <div ref={(el) => { sectionRefs.current["Timeline"] = el; }}>
          <SectionHeader title="Cardback Timeline" />
          <div className="relative flex items-center justify-between mt-6 mb-4 px-4">
            {/* gold line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/60" />
            {TIMELINE_NODES.map((node) => (
              <button
                key={node.era}
                onClick={() => { setActiveSection("Cardback Table"); setEraFilter(node.era); scrollToSection("Cardback Table"); }}
                className="relative z-10 flex flex-col items-center group"
              >
                <div className="w-5 h-5 rounded-full border-2 border-primary bg-background group-hover:bg-primary/20 transition-colors shadow-[0_0_8px_hsl(43_50%_54%/0.4)]" />
                <span className="mt-2 text-xs font-bold text-primary tracking-wider">{node.label}</span>
                <span className="text-[10px] text-muted-foreground">{node.years}</span>
                <span className="text-[9px] text-muted-foreground">{node.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ──── SECTION 2: CARDBACK MASTER TABLE ──── */}
        <div ref={(el) => { sectionRefs.current["Cardback Table"] = el; }}>
          <SectionHeader title="Cardback Master Table" />
          {/* era filter pills */}
          <div className="flex gap-2 mt-4 mb-3">
            {ERA_FILTERS.map((e) => (
              <button
                key={e}
                onClick={() => setEraFilter(e)}
                className={`text-[10px] tracking-wider px-3 py-1 border transition-colors ${
                  eraFilter === e
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Era</th>
                  <th className={thCls}>Cardback</th>
                  <th className={thCls}>Year</th>
                  <th className={thCls}>Key Features</th>
                  <th className={thCls}>Rarity</th>
                  <th className={thCls}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaster.map((r) => (
                  <tr key={r.code} style={{ backgroundColor: ERA_ROW_BG[r.era] }}>
                    <td className={`${tdCls} text-primary font-bold whitespace-nowrap`}>{r.code}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{r.era}</td>
                    <td className={tdCls}>{r.cardback}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{r.year}</td>
                    <td className={tdCls}>{r.features}</td>
                    <td className={`${tdCls} whitespace-nowrap text-primary`}>{r.rarity}</td>
                    <td className={tdCls}>{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ──── SECTION 3: VARIANT SPOTLIGHTS ──── */}
        <div ref={(el) => { sectionRefs.current["Variant Spotlights"] = el; }}>
          <SectionHeader title="Variant Spotlight Cards" />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {SPOTLIGHT_CARDS.map((card) => (
              <div
                key={card.title}
                className="border border-primary/50 p-5 bg-card shadow-[0_0_12px_hsl(43_50%_54%/0.1)]"
              >
                <h4 className="text-xs font-bold text-primary tracking-wider mb-3">{card.title}</h4>
                <p className="text-xs text-foreground leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ──── SECTION 4: INTERNATIONAL ──── */}
        <div ref={(el) => { sectionRefs.current["International"] = el; }}>
          <SectionHeader title="International Variants" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Market</th>
                  <th className={thCls}>Cardbacks Known</th>
                  <th className={thCls}>Key Features</th>
                  <th className={thCls}>Best Auction Source</th>
                </tr>
              </thead>
              <tbody>
                {INTL_TABLE.map((r) => (
                  <tr key={r.code}>
                    <td className={`${tdCls} text-primary font-bold`}>{r.code}</td>
                    <td className={tdCls}>{r.market}</td>
                    <td className={tdCls}>{r.cardbacks}</td>
                    <td className={tdCls}>{r.features}</td>
                    <td className={tdCls}>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground tracking-wider italic leading-relaxed">
            International variants typically command a 20–80% premium over equivalent U.S. issues in high grade, driven by lower original production volumes and strong European and Canadian collector demand.
          </p>
        </div>

        {/* ──── SECTION 5: AUCTION SOURCES ──── */}
        <div ref={(el) => { sectionRefs.current["Auction Sources"] = el; }}>
          <SectionHeader title="Auction Source Reference" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thCls}>Source</th>
                  <th className={thCls}>Location</th>
                  <th className={thCls}>Currency</th>
                  <th className={thCls}>Buyer's Premium</th>
                  <th className={thCls}>Best For</th>
                  <th className={thCls}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {AUCTION_SOURCES.map((s) => (
                  <tr key={s.name}>
                    <td className={`${tdCls} text-primary font-bold whitespace-nowrap`}>
                      <a href={`https://${s.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.name}</a>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`}>{s.location}</td>
                    <td className={`${tdCls} whitespace-nowrap`}>{s.currency}</td>
                    <td className={tdCls}>{s.premium}</td>
                    <td className={tdCls}>{s.bestFor}</td>
                    <td className={tdCls}>{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ──── SECTION 6: GRADES & VALUE ──── */}
        <div ref={(el) => { sectionRefs.current["GRADES & VALUE"] = el; }}>
          <SectionHeader title="GRADE TIER & VALUE FRAMEWORK" />
          <div className="grid lg:grid-cols-2 gap-6 mt-4">
            {/* left – grade reference */}
            <div>
              <h4 className="text-[10px] text-primary tracking-widest font-bold mb-2">GRADE TIER REFERENCE</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thCls}>CODE</th>
                      <th className={thCls}>GRADE</th>
                      <th className={thCls}>DESCRIPTION</th>
                      <th className={thCls}>PREMIUM vs RAW-NM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRADE_TABLE.map((r) => (
                      <tr key={r.code}>
                        <td className={`${tdCls} text-primary font-bold whitespace-nowrap`}>{r.code}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{r.grade}</td>
                        <td className={tdCls}>{r.desc}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{r.premium}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* right – value ranking */}
            <div>
              <h4 className="text-[10px] text-primary tracking-widest font-bold mb-2">RELATIVE VALUE RANKING BY ERA (RAW-NM, U.S. KENNER)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thCls}>ERA</th>
                      <th className={thCls}>HIGHEST VALUE</th>
                      <th className={thCls}>REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VALUE_RANKING.map((r, i) => (
                      <tr key={i} style={{ backgroundColor: ERA_ROW_BG[r.era] }}>
                        <td className={`${tdCls} text-primary font-bold whitespace-nowrap`}>{r.era}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>{r.highest}</td>
                        <td className={tdCls}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ──── FOOTER NOTE ──── */}
        <p className="text-[10px] text-primary/70 italic tracking-wider leading-relaxed pt-4 border-t border-border">
          Reference data compiled from Heritage Auctions, Hake's Auctions, C&T Auctions, Dallas Vintage Toys, 4th Moon Toys, Brian's Toys, the SWCA archive, and the Kenner Star Wars Collectors' Handbook. Rarity ratings are collector consensus estimates. Always verify against current auction records in the Price Tracker tab.
        </p>
      </div>

      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-widest">
        IMPERIAL PRICE TERMINAL v4.0 • GALACTIC EMPIRE • CLASSIFIED
      </footer>
    </div>
  );
};

/* ───────── helpers ───────── */

const SectionHeader = ({ title }: { title: string }) => (
  <h2 className="text-sm font-bold text-primary tracking-[0.2em] uppercase border-b border-primary/40 pb-2 shadow-[0_2px_8px_hsl(43_50%_54%/0.15)]">
    {title}
  </h2>
);

export default KnowledgeHub;

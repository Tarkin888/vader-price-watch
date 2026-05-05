import { useState, useRef, useEffect } from "react";
import { COLLECTION_FEATURE_ENABLED, RESEARCH_LIBRARY_FEATURE_ENABLED } from "@/lib/feature-flags";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import ResearchLibrary from "@/components/ResearchLibrary";
import ErrorBoundary from "@/components/ErrorBoundary";
import CompViewerModal from "@/components/knowledge-hub/CompViewerModal";
import ImageManagerModal from "@/components/knowledge-hub/ImageManagerModal";
import { Menu, X, Images, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MASTER_TABLE } from "@/lib/cardback-master";

type ArticleStub = { id: string; title: string; image_urls: string[] | null; cardback_refs: string[] | null };

/* ───────── data ───────── */

const TIMELINE_NODES = [
  { era: "SW", label: "SW", years: "1977–1979", sub: "12-back → 21-back" },
  { era: "ESB", label: "ESB", years: "1980–1982", sub: "31-back → 48-back" },
  { era: "ROTJ", label: "ROTJ", years: "1983–1984", sub: "48-back → 79-back" },
  { era: "POTF", label: "POTF", years: "1985", sub: "92-back" },
];


const SPOTLIGHT_CARDS: Array<{ title: string; body: string; primaryCardback: string }> = [
  {
    title: "DOUBLE-TELESCOPING SABER (SW-12A-DT / SW-12B-DT)",
    body: "The rarest production variant in the entire vintage Kenner line. The double-telescoping lightsaber has a visible inner wick that extends from the outer tube. Only approximately 3–4 carded SW-12A-DT examples are known to exist worldwide. A SW-12B-DT example with a single documented carded specimen is equally extreme. Prices for graded examples start at £30,000 and can exceed £60,000.",
    primaryCardback: "SW-12A-DT",
  },
  {
    title: "VADER POINTING (ROTJ-65-VP)",
    body: "An alternate front-card photograph showing Darth Vader with his right arm raised and finger extended — distinct from the standard lightsaber-raised pose used across most ROTJ Vader cards. Confirmed on the 65-back, 77-back, and 79-back. Rarer than the standard pose on all cardbacks it appears on. Collectors treat this as a standalone variant requiring a separate carded example.",
    primaryCardback: "ROTJ-65-VP",
  },
  {
    title: "MADE IN MEXICO / LILI LEDY (ROTJ-65D)",
    body: "Produced under licence by Lili Ledy for the Mexican market. Features different card stock and finish from U.S. Kenner issues. The ROTJ-65D is the most documented example. At time of writing, the AFA population report shows only POP 2 — making this one of the rarest graded ROTJ Vader cards in any registry. Commands a significant premium over equivalent U.S. issues.",
    primaryCardback: "ROTJ-65D",
  },
  {
    title: "POTF COIN (POTF-92)",
    body: "The Power of the Force 92-back is the final release in the vintage Kenner line. Every figure was packaged with a unique collector coin inside the bubble. The Darth Vader coin is among the most sought-after in the set. A complete sealed POTF-92 Vader with coin intact commands a strong premium, with AFA Y-85 examples documented at Heritage Auctions.",
    primaryCardback: "POTF-92",
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
  { name: "Vectis Auctions", location: "Thornaby, UK", currency: "GBP", premium: "22.5% + VAT on BP = 27% effective", bestFor: "Palitoy; UK/European carded figures; large volume vintage toy sales", website: "vectis.co.uk", notes: "BP 22.5% of hammer; VAT at 20% on BP only (hammer is VAT-exempt). Worked example: £100 hammer → £22.50 BP → £4.50 VAT on BP → £127.00 total. Source: vectis.co.uk/content/terms (Section 26), checked 15 Apr 2026." },
  { name: "C&T Auctions", location: "Kent, UK", currency: "GBP", premium: "22% + 20% VAT on premium (26.4% inclusive)", bestFor: "Palitoy and Kenner carded figures; UKG/AFA graded lots; dedicated Star Wars auctions", website: "candtauctions.co.uk", notes: "Additional 3–4.95% + VAT surcharge if bidding via the-saleroom.com or EasyLiveAuctions; direct C&T website bids carry no surcharge" },
  { name: "LCG Auctions", location: "Online, UK", currency: "GBP", premium: "22% (back-calculated from total)", bestFor: "Vintage Star Wars lots; UK-based online auctions", website: "lcgauctions.com", notes: "Specialist vintage toy and Star Wars auctioneer" },
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
  { era: "SW", highest: "SW-12A-DT / SW-12B-DT", reason: "Rarest production Kenner variant; museum-tier collectible" },
  { era: "SW", highest: "SW-12A", reason: "Highest value SW standard card" },
  { era: "SW", highest: "SW-12B", reason: "Second-tier SW 12-back; slight premium over 12C" },
  { era: "SW", highest: "SW-20 / SW-21", reason: "Strong demand but lower than 12-backs" },
  { era: "ESB", highest: "ESB-32 / ESB-45", reason: "Low production run drives scarcity premium" },
  { era: "ESB", highest: "ESB-41 / ESB-47", reason: "Most liquid ESB cards at auction" },
  { era: "ROTJ", highest: "ROTJ-65D Mexico", reason: "Lowest graded population of any ROTJ Vader" },
  { era: "ROTJ", highest: "ROTJ-65-VP", reason: "Photo variant premium over standard ROTJ pose" },
  { era: "ROTJ", highest: "ROTJ-79 / ROTJ-77", reason: "Affordable late-run ROTJ; good entry point" },
  { era: "POTF", highest: "POTF-92", reason: "End-of-line scarcity; coin adds collector appeal" },
];

const ALL_SECTIONS = ["Timeline", "Cardback Table", "Variant Spotlights", "International", "Auction Sources", "Grades & Value", "Research Library"] as const;
const SECTIONS = RESEARCH_LIBRARY_FEATURE_ENABLED
  ? ALL_SECTIONS
  : ALL_SECTIONS.filter((s) => s !== "Research Library");

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
  const [activeSection, setActiveSection] = useState<typeof ALL_SECTIONS[number]>(RESEARCH_LIBRARY_FEATURE_ENABLED ? "Research Library" : "Timeline");
  const [eraFilter, setEraFilter] = useState<string>("All");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lastScrapeDate, setLastScrapeDate] = useState<string | null>(null);
  const [compsTarget, setCompsTarget] = useState<string | null>(null);
  const [spotlightTarget, setSpotlightTarget] = useState<string | null>(null);
  const { isAdmin } = useAuth();
  const [articleStubs, setArticleStubs] = useState<ArticleStub[]>([]);
  const [imageEditArticle, setImageEditArticle] = useState<ArticleStub | null>(null);

  useEffect(() => {
    supabase.from("lots").select("capture_date", { count: "exact", head: false })
      .order("capture_date", { ascending: false }).limit(1)
      .then(({ data, count }) => {
        setTotalRecords(count ?? 0);
        if (data && data.length > 0) setLastScrapeDate(data[0].capture_date);
      });
  }, []);

  const loadArticleStubs = () => {
    supabase.from("knowledge_articles" as any).select("id, title, image_urls, cardback_refs")
      .then(({ data }) => {
        if (data) setArticleStubs(data as unknown as ArticleStub[]);
      });
  };
  useEffect(() => { if (isAdmin) loadArticleStubs(); }, [isAdmin]);

  // Map cardback code → first matching article (for Master Table image-replace pencil)
  const articleByCardback = (code: string): ArticleStub | undefined =>
    articleStubs.find((a) => Array.isArray(a.cardback_refs) && a.cardback_refs.includes(code));

  const filteredMaster = eraFilter === "All" ? MASTER_TABLE : MASTER_TABLE.filter((r) => r.era === eraFilter);

  const scrollToSection = (key: string) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* shared table cell class */
  const thCls = "py-2 px-3 text-left text-[10px] tracking-wider text-primary font-medium border-b border-primary/30 whitespace-nowrap";
  const tdCls = "py-2 px-3 text-xs text-foreground border-b border-border/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header totalRecords={totalRecords} lastScrapeDate={lastScrapeDate} />

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-1 border-b border-border px-6 py-2">
        <button onClick={() => navigate("/")} className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors">Price Tracker</button>
        <button className="text-[10px] tracking-wider px-3 py-1 text-primary border-b border-primary">Knowledge Hub</button>
        {COLLECTION_FEATURE_ENABLED && <button onClick={() => navigate("/collection")} className="text-[10px] tracking-wider px-3 py-1 text-muted-foreground hover:text-primary transition-colors">My Collection</button>}
      </div>
      {/* Mobile hamburger */}
      <div className="md:hidden flex items-center border-b border-border px-4 py-2">
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="text-muted-foreground hover:text-primary transition-colors">
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {mobileNavOpen && (
        <div className="md:hidden border-b border-border bg-secondary/50 px-4 py-2 flex flex-col gap-1">
          <button onClick={() => { setMobileNavOpen(false); navigate("/"); }} className="text-[11px] tracking-wider px-3 py-2 text-muted-foreground hover:text-primary text-left transition-colors">Price Tracker</button>
          <button className="text-[11px] tracking-wider px-3 py-2 text-primary text-left">Knowledge Hub</button>
          {COLLECTION_FEATURE_ENABLED && <button onClick={() => { setMobileNavOpen(false); navigate("/collection"); }} className="text-[11px] tracking-wider px-3 py-2 text-muted-foreground hover:text-primary text-left transition-colors">My Collection</button>}
        </div>
      )}

      {/* sub-nav */}
      <div className="sticky top-0 z-20 bg-background flex items-center gap-1 border-b border-border px-6 py-2 overflow-x-auto">
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
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3 space-y-4">

        {/* ──── SECTION 1: TIMELINE ──── */}
        <div ref={(el) => { sectionRefs.current["Timeline"] = el; }}>
          <SectionHeader title="Cardback Timeline" />
          <div className="relative flex items-center justify-between mt-2 mb-1 px-4">
            {/* gold line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/60" />
            {TIMELINE_NODES.map((node) => (
              <button
                key={node.era}
                onClick={() => { setActiveSection("Cardback Table"); setEraFilter(node.era); scrollToSection("Cardback Table"); }}
                className="relative z-10 flex flex-col items-center group"
              >
                <div className="w-5 h-5 rounded-full border-2 border-primary bg-background group-hover:bg-primary/20 transition-colors shadow-[0_0_8px_hsl(43_50%_54%/0.4)]" />
                <span className="mt-1 text-xs font-bold text-primary tracking-wider">{node.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{node.years}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{node.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ──── SECTION 2: CARDBACK MASTER TABLE ──── */}
        <div ref={(el) => { sectionRefs.current["Cardback Table"] = el; }}>
          <SectionHeader title="Cardback Master Table" />
          {/* era filter pills */}
          <div className="flex gap-2 mt-2 mb-2">
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
                  <th className={thCls}>Comps</th>
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
                    <td className={`${tdCls} whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setCompsTarget(r.code)}
                          title="View auction comps"
                          aria-label={`View auction comps for ${r.code}`}
                          className="inline-flex items-center justify-center p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Images className="w-4 h-4" />
                        </button>
                        {isAdmin && (() => {
                          const art = articleByCardback(r.code);
                          return (
                            <button
                              onClick={() => art && setImageEditArticle(art)}
                              disabled={!art}
                              title={art ? `Replace image for ${art.title}` : "No article record yet — create one in Research Library first"}
                              aria-label="Replace image"
                              className="inline-flex items-center justify-center p-1.5 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                              <ImagePlus className="w-4 h-4" />
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ──── SECTION 3: VARIANT SPOTLIGHTS ──── */}
        <div ref={(el) => { sectionRefs.current["Variant Spotlights"] = el; }}>
          <SectionHeader title="Variant Spotlight Cards" />
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            {SPOTLIGHT_CARDS.map((card) => (
              <div
                key={card.title}
                className="border border-primary/50 p-5 bg-card shadow-[0_0_12px_hsl(43_50%_54%/0.1)]"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="text-xs font-bold text-primary tracking-wider">{card.title}</h4>
                  <button
                    onClick={() => setSpotlightTarget(card.primaryCardback)}
                    title={`View auction comps for ${card.primaryCardback}`}
                    aria-label={`View auction comps for ${card.primaryCardback}`}
                    className="inline-flex items-center justify-center p-1.5 rounded text-primary hover:bg-primary/10 transition-colors shrink-0"
                  >
                    <Images className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ──── SECTION 4: INTERNATIONAL ──── */}
        <div ref={(el) => { sectionRefs.current["International"] = el; }}>
          <SectionHeader title="International Variants" />
          <div className="overflow-x-auto mt-2">
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
          <div className="overflow-x-auto mt-2">
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
        <div ref={(el) => { sectionRefs.current["Grades & Value"] = el; }}>
          <SectionHeader title="Grade Tier & Value Framework" />
          <div className="grid lg:grid-cols-2 gap-4 mt-2">
            {/* left – grade reference */}
            <div>
              <h4 className="text-[10px] text-primary tracking-wider font-medium mb-2">Grade Tier Reference</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thCls}>Code</th>
                      <th className={thCls}>Grade</th>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Premium vs RAW-NM</th>
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
              <h4 className="text-[10px] text-primary tracking-wider font-medium mb-2">Relative Value Ranking by Era (RAW-NM, U.S. Kenner)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thCls}>Era</th>
                      <th className={thCls}>Highest Value</th>
                      <th className={thCls}>Reason</th>
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

        {/* ──── SECTION 7: RESEARCH LIBRARY ──── */}
        {RESEARCH_LIBRARY_FEATURE_ENABLED && (
          <div ref={(el) => { sectionRefs.current["Research Library"] = el; }}>
            {activeSection === "Research Library" && <ErrorBoundary><ResearchLibrary /></ErrorBoundary>}
            {activeSection !== "Research Library" && (
              <>
                <SectionHeader title="Research Library" />
                <p className="text-xs text-muted-foreground mt-3">
                  Select <button onClick={() => setActiveSection("Research Library")} className="text-primary hover:text-primary/80 underline transition-colors">Research Library</button> from the sub-nav to browse curated reference articles.
                </p>
              </>
            )}
          </div>
        )}

        {/* ──── FOOTER NOTE ──── */}
        <p className="text-[10px] text-primary/70 italic tracking-wider leading-relaxed pt-2 border-t border-border">
          Reference data compiled from Heritage Auctions, Hake's Auctions, C&T Auctions, Dallas Vintage Toys, 4th Moon Toys, Brian's Toys, the SWCA archive, and the Kenner Star Wars Collectors' Handbook. Rarity ratings are collector consensus estimates. Always verify against current auction records in the Price Tracker tab.
        </p>
      </div>

      <footer className="border-t border-border px-6 py-2 text-center text-[10px] text-muted-foreground tracking-wider">
        IMPERIAL PRICE TERMINAL v4.1 · Galactic Empire · Classified
      </footer>

      {compsTarget && (
        <CompViewerModal
          cardbackCode={compsTarget}
          variantCode={compsTarget}
          open={!!compsTarget}
          onClose={() => setCompsTarget(null)}
          source="master_table"
        />
      )}

      {spotlightTarget && (
        <CompViewerModal
          cardbackCode={spotlightTarget}
          variantCode={null}
          open={!!spotlightTarget}
          onClose={() => setSpotlightTarget(null)}
          source="variant_spotlight"
        />
      )}

      {imageEditArticle && (
        <ImageManagerModal
          articleId={imageEditArticle.id}
          articleTitle={imageEditArticle.title}
          mode={(imageEditArticle.image_urls?.length ?? 0) > 1 ? "multi" : "single"}
          initialUrls={imageEditArticle.image_urls ?? []}
          open={!!imageEditArticle}
          onClose={() => setImageEditArticle(null)}
          onSaved={(newUrls) => {
            setArticleStubs((prev) => prev.map((x) => x.id === imageEditArticle.id ? { ...x, image_urls: newUrls } : x));
          }}
        />
      )}
    </div>
  );
};

/* ───────── helpers ───────── */

const SectionHeader = ({ title }: { title: string }) => (
  <h2 className="text-sm font-medium text-primary tracking-wider border-b border-primary/40 pb-2 shadow-[0_2px_8px_hsl(43_50%_54%/0.15)]">
    {title}
  </h2>
);

export default KnowledgeHub;

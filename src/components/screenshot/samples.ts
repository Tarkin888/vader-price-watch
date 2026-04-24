// Pre-canned auction text samples for the Quick Import → Paste Text helper.
// Each sample stays well under the 20,000-char cap and includes a recognisable
// source keyword, hammer + BP + total, sale date, cardback code, and grade so
// the extractor has real data to chew on.

export type SampleKey = "heritage" | "hakes" | "vectis" | "multiLotHakes";

export const SAMPLE_TEXTS: Record<SampleKey, string> = {
  heritage: `Heritage Auctions — Lot 34521
Star Wars (1977) Luke Skywalker 12-back-A AFA 85 NM+ action figure.
SW-12A cardback. Fully sealed bubble, unpunched, original price sticker ($1.99).
Sold: 15 April 2026
Hammer: $4,200.00 USD
Buyer's Premium: 20%
Total Paid: $5,040.00 USD
Lot URL: https://comics.ha.com/itm/toys-/vintage-toys/lot-34521
Condition notes: Corner wear minimal, bubble crystal clear, card surface 85.`,

  hakes: `Hake's Auctions Lot 228844
STAR WARS: DARTH VADER ESB-45 CARDED ACTION FIGURE - AFA 90 NM+/MT.
Hammer Price: $3,100.00
Buyer's Premium: 21%
Total: $3,751.00
Sale date: 2026-04-10
Full grade: 90/90/90
Description: Empire Strikes Back cardback, offer sticker present, bubble intact.
URL: https://hakes.com/Auction/ItemDetail/228844/DARTH-VADER-ESB-45`,

  vectis: `Vectis Toy Auctions — Lot 19237
Kenner Star Wars Boba Fett ROTJ-65 Carded MOC — UKG 80 NM
Hammer: £1,850 GBP
Buyer's Premium: 24% incl VAT
Total paid: £2,294 GBP
Auction date: 8 April 2026
Notes: Return of the Jedi 65-back, clean bubble, tape discolouration on back.
Lot page: https://www.vectis.co.uk/Auctions/auc19237`,

  multiLotHakes: `Hake's Auctions console dump — batch of 3 lots

Lot 228844: STAR WARS DARTH VADER ESB-45 AFA 90 NM+/MT
Hammer: $3,100.00 · BP 21% · Total $3,751.00 · Sold 2026-04-10
URL: https://hakes.com/Auction/ItemDetail/228844

Lot 228902: STAR WARS LUKE SKYWALKER SW-12A AFA 85 NM+
Hammer: $2,450.00 · BP 21% · Total $2,964.50 · Sold 2026-04-10
URL: https://hakes.com/Auction/ItemDetail/228902

Lot 229015: STAR WARS BOBA FETT ROTJ-65 UKG 80 NM
Hammer: $1,720.00 · BP 21% · Total $2,081.20 · Sold 2026-04-10
URL: https://hakes.com/Auction/ItemDetail/229015`,
};

export const SAMPLE_LABELS: Record<SampleKey, { title: string; description: string }> = {
  heritage: {
    title: "Heritage sample",
    description: "Heritage Auctions lot with hammer + BP",
  },
  hakes: {
    title: "Hake's sample",
    description: "Hake's Auctions console output style",
  },
  vectis: {
    title: "Vectis sample",
    description: "Vectis Toy Auctions lot with VAT-style pricing",
  },
  multiLotHakes: {
    title: "Hake's (multi-lot) sample",
    description: "Three-lot console dump to exercise the multi-lot flow",
  },
};

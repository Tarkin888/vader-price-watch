interface HeaderProps {
  totalRecords: number;
  lastScrapeDate: string | null;
}

const Header = ({ totalRecords, lastScrapeDate }: HeaderProps) => {
  return (
    <header className="border-b border-border px-6 py-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-wider">
          IMPERIAL PRICE TERMINAL
        </h1>
        <span className="text-[10px] text-muted-foreground tracking-widest">
          v4.0 | March 2026
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground tracking-wider leading-relaxed">
        SW 12/20/21 &nbsp;• &nbsp;ESB 31/32/41/45/47/48 &nbsp;• &nbsp;ROTJ 48/65/77/79 &nbsp;• &nbsp;POTF 92
        <br />
        Hake's &nbsp;• &nbsp;Heritage &nbsp;• &nbsp;LCG &nbsp;• &nbsp;Vectis
      </p>
      <div className="mt-1 flex gap-6 text-xs text-muted-foreground tracking-wider">
        <span>RECORDS IN DATABASE: <span className="text-primary">{totalRecords}</span></span>
        <span>LAST SCRAPE: <span className="text-primary">{lastScrapeDate ?? "N/A"}</span></span>
      </div>
    </header>
  );
};

export default Header;

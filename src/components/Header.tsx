interface HeaderProps {
  totalRecords: number;
  lastScrapeDate: string | null;
}

const Header = ({ totalRecords, lastScrapeDate }: HeaderProps) => {
  return (
    <header className="border-b border-border px-6 py-5">
      <h1 className="text-xl md:text-2xl font-bold text-primary tracking-wider">
        Darth Vader 12-Back MOC — Auction Price Tracker
      </h1>
      <div className="mt-1 flex gap-6 text-xs text-muted-foreground tracking-wider">
        <span>RECORDS IN DATABASE: <span className="text-primary">{totalRecords}</span></span>
        <span>LAST SCRAPE: <span className="text-primary">{lastScrapeDate ?? "N/A"}</span></span>
      </div>
    </header>
  );
};

export default Header;

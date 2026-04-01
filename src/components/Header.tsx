import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  totalRecords: number;
  lastScrapeDate: string | null;
  currency?: "GBP" | "USD";
  onCurrencyToggle?: () => void;
}

const Header = ({ totalRecords, lastScrapeDate, currency = "GBP", onCurrencyToggle }: HeaderProps) => {
  return (
    <header className="border-b border-border px-6 flex items-center justify-between h-[60px]">
      <div className="flex items-baseline gap-3">
        <Link to="/" className="cursor-pointer">
          <h1 className="text-base md:text-lg font-bold text-primary tracking-widest">
            IMPERIAL PRICE TERMINAL
          </h1>
        </Link>
        <span className="text-[10px] text-muted-foreground tracking-widest">
          v4.0
        </span>
        <span className="text-[10px] text-muted-foreground tracking-wider">
          {totalRecords} Records • Last scrape: {lastScrapeDate ?? "N/A"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onCurrencyToggle && (
          <button
            onClick={onCurrencyToggle}
            className="text-[10px] font-bold tracking-widest px-3 py-1 rounded border border-primary transition-colors"
            style={{
              backgroundColor: currency === "USD" ? "hsl(43, 50%, 54%)" : "transparent",
              color: currency === "USD" ? "hsl(50, 14%, 6%)" : "hsl(43, 50%, 54%)",
            }}
          >
            {currency}
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
};


export default Header;

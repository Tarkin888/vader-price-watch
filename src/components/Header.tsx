import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { useAuth } from "@/hooks/use-auth";

interface HeaderProps {
  totalRecords: number;
  lastScrapeDate: string | null;
  currency?: "GBP" | "USD";
  onCurrencyToggle?: () => void;
}

const Header = ({ totalRecords, lastScrapeDate, currency = "GBP", onCurrencyToggle }: HeaderProps) => {
  const { isAdmin } = useAuth();

  return (
    <header className="border-b border-border px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between py-2 md:py-0 md:h-[60px] gap-1 md:gap-0">
      <div className="flex flex-col md:flex-row md:items-baseline gap-0.5 md:gap-3">
        <Link to="/" className="cursor-pointer">
          <h1 className="text-base md:text-lg font-bold text-primary tracking-widest">
            IMPERIAL PRICE TERMINAL
          </h1>
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-muted-foreground tracking-widest">
            v4.1
          </span>
          <span className="text-[10px] text-muted-foreground tracking-wider">
            {totalRecords} Records • Last scrape: {lastScrapeDate ?? "N/A"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            to="/admin"
            className="text-[10px] font-bold tracking-widest px-2 py-1 transition-colors"
            style={{ color: "hsl(43, 50%, 54%)", opacity: 0.6 }}
          >
            ADMIN
          </Link>
        )}
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
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;

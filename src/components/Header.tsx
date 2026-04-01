import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  totalRecords: number;
  lastScrapeDate: string | null;
}

const Header = ({ totalRecords, lastScrapeDate }: HeaderProps) => {
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
      <ThemeToggle />
    </header>
  );
};

export default Header;

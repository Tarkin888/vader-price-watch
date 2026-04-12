import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const Pagination = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) => {
  if (totalRecords === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div
      className="flex items-center justify-between px-4 md:px-6 py-3 border-t"
      style={{ borderColor: "rgba(201,168,76,0.15)", background: "rgba(8,8,6,0.6)" }}
    >
      {/* Left: record range */}
      <span className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.5)" }}>
        {start}–{end} of {totalRecords}
      </span>

      {/* Centre: navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded transition-colors disabled:opacity-20"
          style={{ color: "rgba(224,216,192,0.6)" }}
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded transition-colors disabled:opacity-20"
          style={{ color: "rgba(224,216,192,0.6)" }}
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="text-[10px] tracking-wider px-2" style={{ color: "#C9A84C" }}>
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded transition-colors disabled:opacity-20"
          style={{ color: "rgba(224,216,192,0.6)" }}
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded transition-colors disabled:opacity-20"
          style={{ color: "rgba(224,216,192,0.6)" }}
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tracking-wider" style={{ color: "rgba(224,216,192,0.4)" }}>
            Per page
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-[10px] tracking-wider rounded px-1.5 py-0.5 border"
            style={{
              background: "#0d0d0a",
              color: "#C9A84C",
              borderColor: "rgba(201,168,76,0.2)",
            }}
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default Pagination;

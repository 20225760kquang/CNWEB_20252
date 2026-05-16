import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((page) => {
    return page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 1;
  });
  const goToPage = (page: number) => onPageChange(Math.min(Math.max(page, 1), totalPages));

  return (
    <nav aria-label="Phân trang" className={`flex items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        aria-label="Trang trước"
        onClick={() => goToPage(safeCurrentPage - 1)}
        disabled={safeCurrentPage === 1}
        className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-sm">chevron_left</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page, index) => (
          <React.Fragment key={page}>
            {index > 0 && page - pages[index - 1] > 1 && (
              <span className="px-1 text-sm text-on-surface-variant">...</span>
            )}
          <button
            type="button"
            aria-current={safeCurrentPage === page ? "page" : undefined}
            aria-label={`Trang ${page}`}
            onClick={() => goToPage(page)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              safeCurrentPage === page
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-variant"
            }`}
          >
            {page}
          </button>
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        aria-label="Trang sau"
        onClick={() => goToPage(safeCurrentPage + 1)}
        disabled={safeCurrentPage === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    </nav>
  );
}

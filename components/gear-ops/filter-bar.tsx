/**
 * GearFilterBar — renders a row of filter chip links for the GearOps item list.
 *
 * Each chip links to a URL with the filter applied. Active chips are highlighted.
 * Supports a "Clear all" chip when any filter is active.
 */

import Link from "next/link";

export type GearFilterChip = {
  key: string;
  label: string;
  href: string;
  isActive?: boolean;
};

export function GearFilterBar({
  chips,
  clearHref,
  hasActiveFilters,
  activeFilterSummary,
}: {
  chips: GearFilterChip[];
  clearHref?: string;
  hasActiveFilters?: boolean;
  activeFilterSummary?: string;
}) {
  return (
    <div className="space-y-2">
      {hasActiveFilters && activeFilterSummary ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
          <span className="text-blue-800 dark:text-blue-200">{activeFilterSummary}</span>
          {clearHref ? (
            <>
              {" · "}
              <Link href={clearHref} className="font-medium text-blue-700 underline dark:text-blue-300">
                Clear filters
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter options">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            aria-pressed={chip.isActive}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              chip.isActive
                ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
            }`}
          >
            {chip.label}
          </Link>
        ))}
        {hasActiveFilters && clearHref ? (
          <Link
            href={clearHref}
            className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
          >
            Clear all
          </Link>
        ) : null}
      </div>
    </div>
  );
}

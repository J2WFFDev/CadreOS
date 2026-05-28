/**
 * Arc 23I — Entry System Consolidation & Operational Coherence
 *
 * Shared FilterTabs component.
 * Provides a unified filter tab strip used across all Entry-derived list pages:
 * habits, journals, prompts, entries, notes, tasks.
 *
 * Usage:
 *   <FilterTabs
 *     tabs={[
 *       { label: "Active", href: "/habits?status=active", value: "active" },
 *       { label: "Paused", href: "/habits?status=paused", value: "paused" },
 *       { label: "Archived", href: "/habits?status=archived", value: "archived" },
 *       { label: "All", href: "/habits?status=all", value: "all" },
 *     ]}
 *     activeValue="active"
 *   />
 */

import Link from "next/link";

export interface FilterTab {
  label: string;
  href: string;
  value: string;
}

export function FilterTabs({
  tabs,
  activeValue,
}: {
  tabs: FilterTab[];
  activeValue: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              isActive
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

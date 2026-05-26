/**
 * GearQuickActionCard — a large tappable card for operator quick-action areas.
 *
 * Used on the GearOps landing page to surface the most common field operations
 * without burying them in sub-menus. Designed for large tap targets (mobile-friendly).
 */

import Link from "next/link";

export type GearQuickAction = {
  key: string;
  title: string;
  description: string;
  href: string;
  /** Optional: emphasize the card as the most important action. */
  primary?: boolean;
};

/** Returns the card class string for a quick action based on whether it is primary. */
function quickActionCardClass(primary: boolean): string {
  return primary
    ? "rounded-lg border-2 border-zinc-800 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    : "rounded-lg border bg-white p-4 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800";
}

export function GearQuickActionCard({
  title,
  description,
  href,
  primary = false,
}: {
  title: string;
  description: string;
  href: string;
  primary?: boolean;
}) {
  const style = quickActionCardClass(primary);

  return (
    <Link href={href} className={`block ${style} focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500`}>
      <p className={`text-sm font-semibold ${primary ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-800 dark:text-zinc-200"}`}>
        {title}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
    </Link>
  );
}

export function GearQuickActionGrid({
  actions,
}: {
  actions: GearQuickAction[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => {
        const style = quickActionCardClass(action.primary ?? false);
        return (
          <Link
            key={action.key}
            href={action.href}
            className={`block ${style} focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500`}
          >
            <p className={`text-sm font-semibold ${action.primary ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-800 dark:text-zinc-200"}`}>
              {action.title}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{action.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

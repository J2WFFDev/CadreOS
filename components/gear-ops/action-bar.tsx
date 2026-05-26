/**
 * GearActionBar — renders a set of action links in a primary/secondary hierarchy.
 *
 * Primary actions appear as filled buttons; secondary actions appear as bordered
 * ghost buttons. Supports mobile-friendly full-width primary action on small screens.
 */

import Link from "next/link";

export type GearAction = {
  key: string;
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "danger";
  /** When true the button spans full width on small screens. */
  mobileFullWidth?: boolean;
};

export function GearActionBar({
  actions,
  className,
}: {
  actions: GearAction[];
  className?: string;
}) {
  const base = `inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition min-h-[44px]`;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {actions.map((action) => {
        let style: string;
        switch (action.variant ?? "secondary") {
          case "primary":
            style = `${base} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200`;
            break;
          case "danger":
            style = `${base} border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50`;
            break;
          default:
            style = `${base} border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800`;
        }
        const fullWidth = action.mobileFullWidth ? "sm:w-auto w-full" : "";
        return (
          <Link key={action.key} href={action.href} className={`${style} ${fullWidth}`}>
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}

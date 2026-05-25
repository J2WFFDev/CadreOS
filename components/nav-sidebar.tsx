"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/people", label: "People" },
  { href: "/programs", label: "Programs" },
  { href: "/teams", label: "Teams" },
  { href: "/today", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/events", label: "Events" },
  { href: "/field-ops", label: "FieldOps" },
  { href: "/gear-ops", label: "GearOps" },
  { href: "/notes", label: "Notes" },
  { href: "/tasks", label: "Tasks" },
  { href: "/decisions", label: "Decisions" },
  { href: "/entries", label: "All Entries" },
  { href: "/account", label: "Account" },
] as const;

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-52 shrink-0 border-r bg-white pt-4 dark:bg-zinc-900 md:block">
      <ul className="space-y-0.5 px-2">
        {NAV_LINKS.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href + "/")) ||
            (link.href !== "/dashboard" && pathname === link.href);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={
                  isActive
                    ? "block rounded-md px-3 py-2 text-sm font-medium bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "block rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

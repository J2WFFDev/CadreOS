"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/notifications", label: "Notifications" },
  { href: "/reports", label: "Reports" },
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
  { href: "/entries/inbox", label: "Entry Inbox" },
  { href: "/entries", label: "All Entries" },
  { href: "/account", label: "Account" },
] as const;

export function NavSidebar({ unreadNotificationCount = 0 }: { unreadNotificationCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="hidden w-52 shrink-0 border-r bg-white pt-4 dark:bg-zinc-900 md:block">
      <ul className="space-y-0.5 px-2">
        {NAV_LINKS.map((link) => {
          const isEntriesRoot = link.href === "/entries";
          const isEntryInboxPath = pathname.startsWith("/entries/inbox");
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href + "/") && !(isEntriesRoot && isEntryInboxPath)) ||
            (link.href !== "/dashboard" && pathname === link.href);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={
                  isActive
                    ? "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }
              >
                <span>{link.label}</span>
                {link.href === "/notifications" && unreadNotificationCount > 0 ? (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-black">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

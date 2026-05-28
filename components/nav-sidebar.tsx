"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SIDEBAR_GROUPS, isNavSidebarLinkActive } from "@/lib/nav-sidebar";

export function NavSidebar({ unreadNotificationCount = 0 }: { unreadNotificationCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="hidden w-52 shrink-0 border-r bg-white pt-4 dark:bg-zinc-900 md:block"
      aria-label="Dashboard navigation"
    >
      <ul className="space-y-3 px-2">
        {NAV_SIDEBAR_GROUPS.map((group) => (
          <li key={group.label}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const isActive = isNavSidebarLinkActive(pathname, link.href);

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
          </li>
        ))}
      </ul>
    </nav>
  );
}

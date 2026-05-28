"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CurrentUser } from "@/lib/auth/current-user-types";
import {
  getNavSidebarGroupsForUser,
  isNavSidebarGroupActive,
  isNavSidebarLinkActive,
} from "@/lib/nav-sidebar";

function renderNotificationBadge(href: string, unreadNotificationCount: number, className: string) {
  if (href !== "/notifications" || unreadNotificationCount <= 0) {
    return null;
  }

  return (
    <span className={className}>
      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
    </span>
  );
}

export function NavSidebar({
  unreadNotificationCount = 0,
  currentUser,
}: {
  unreadNotificationCount?: number;
  currentUser: CurrentUser | null;
}) {
  const pathname = usePathname();
  const groups = getNavSidebarGroupsForUser(currentUser);

  return (
    <nav
      className="hidden w-52 shrink-0 border-r bg-white pt-4 dark:bg-zinc-900 md:block"
      aria-label="Dashboard navigation"
    >
      <ul className="space-y-3 px-2">
        {groups.map((group) => {
          const isGroupActive = isNavSidebarGroupActive(pathname, group);

          return (
            <li key={group.key}>
              <p
                className={
                  isGroupActive
                    ? "mb-1 rounded-md bg-zinc-100 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
                }
              >
                {group.label}
              </p>
              <ul className="space-y-0.5 pl-3">
                {group.items.map((item) => {
                  const isActive = item.status === "active" && isNavSidebarLinkActive(pathname, item.href);
                  const isDisabled = item.disabled || item.status !== "active";
                  const statusLabel = item.status === "planned" ? "Planned" : item.status === "disabled" ? "Disabled" : null;
                  const statusTitle = item.plannedReason ?? item.disabledReason ?? statusLabel ?? undefined;

                  return (
                    <li key={item.key}>
                      {isDisabled ? (
                        <span
                          className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400 dark:text-zinc-600"
                          title={statusTitle}
                        >
                          <span>{item.label}</span>
                          {statusLabel ? (
                            <span className="ml-2 rounded-full border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                              {statusLabel}
                            </span>
                          ) : null}
                          {renderNotificationBadge(
                            item.href,
                            unreadNotificationCount,
                            "ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
                          )}
                        </span>
                      ) : (
                        <Link
                          href={item.href}
                          className={
                            isActive
                              ? "flex items-center justify-between rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                              : "flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                          }
                        >
                          <span>{item.label}</span>
                          {renderNotificationBadge(
                            item.href,
                            unreadNotificationCount,
                            "ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-black",
                          )}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { canAccessNavItem } from "@/lib/auth/access-control";
import type { CurrentUser } from "@/lib/auth/current-user-types";
import { type CanonicalNavGroup, CADREOS_NAV_GROUPS } from "@/lib/navigation/cadreos-nav";

export type { CanonicalNavItem as NavSidebarItem, CanonicalNavGroup as NavSidebarGroup } from "@/lib/navigation/cadreos-nav";

export const NAV_SIDEBAR_GROUPS = CADREOS_NAV_GROUPS;
export const NAV_SIDEBAR_GROUP_STATE_STORAGE_KEY = "cadreos.nav-sidebar.group-state.v1";
export const DEFAULT_NAV_SIDEBAR_GROUP_EXPANDED = true;

export type NavSidebarGroupState = Partial<Record<string, boolean>>;

export function getNavSidebarGroupsForUser(user: CurrentUser | null): readonly CanonicalNavGroup[] {
  return NAV_SIDEBAR_GROUPS.flatMap((group) => {
    if (!canAccessNavItem(user, group.allowedRoles)) {
      return [];
    }

    const items = group.items.filter((item) => canAccessNavItem(user, item.allowedRoles ?? group.allowedRoles));
    if (items.length === 0) {
      return [];
    }

    return [{ ...group, items }];
  });
}

export function isNavSidebarLinkActive(pathname: string, href: string): boolean {
  const isEntriesRoot = href === "/entries";
  const isEntrySubPath =
    pathname.startsWith("/entries/inbox") ||
    pathname.startsWith("/entries/review") ||
    pathname.startsWith("/entries/schedule");

  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href + "/") && !(isEntriesRoot && isEntrySubPath))
  );
}

/** Returns true when any child link in the group is active for the given pathname. */
export function isNavSidebarGroupActive(pathname: string, group: CanonicalNavGroup): boolean {
  return group.items.some((item) => isNavSidebarLinkActive(pathname, item.href));
}

export function parseNavSidebarGroupState(
  rawState: string | null | undefined,
  groups: readonly CanonicalNavGroup[],
): NavSidebarGroupState {
  if (!rawState) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawState) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return groups.reduce<NavSidebarGroupState>((state, group) => {
      const value = parsed[group.key];

      if (typeof value === "boolean") {
        state[group.key] = value;
      }

      return state;
    }, {});
  } catch {
    return {};
  }
}

export function isNavSidebarGroupExpanded(
  pathname: string,
  group: CanonicalNavGroup,
  groupState: NavSidebarGroupState,
): boolean {
  if (isNavSidebarGroupActive(pathname, group)) {
    return true;
  }

  return groupState[group.key] ?? DEFAULT_NAV_SIDEBAR_GROUP_EXPANDED;
}

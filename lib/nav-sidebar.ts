import { canAccessModule, type ModuleKey } from "@/lib/auth/access-control";
import type { CurrentUser } from "@/lib/auth/current-user-types";

export type NavSidebarLink = {
  href: string;
  label: string;
};

export type NavSidebarGroup = {
  key: string;
  moduleKey: ModuleKey;
  label: string;
  /**
   * Landing route for the module header. When present, the header renders as a clickable link.
   * Should match one of the child `links` hrefs so that the parent active state is consistent
   * with the child active state when on that route.
   */
  href?: string;
  links: readonly NavSidebarLink[];
};

export const NAV_SIDEBAR_GROUPS: readonly NavSidebarGroup[] = [
  {
    key: "home",
    moduleKey: "dashboard",
    label: "Home",
    href: "/dashboard",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/feed", label: "Feed" },
      { href: "/today", label: "Today" },
      { href: "/assigned", label: "Assigned to Me" },
      { href: "/notifications", label: "Notifications" },
    ],
  },
  {
    key: "member-ops",
    moduleKey: "memberOps",
    label: "MemberOps",
    href: "/programs",
    links: [
      { href: "/programs", label: "Programs" },
      { href: "/people", label: "People" },
      { href: "/teams", label: "Teams" },
      { href: "/reports", label: "Membership Lifecycle" },
    ],
  },
  {
    key: "entry",
    moduleKey: "entry",
    label: "Entry",
    href: "/entries",
    links: [
      { href: "/entries", label: "Entries" },
      { href: "/entries/inbox", label: "Inbox" },
      { href: "/reports", label: "Entry Reports" },
    ],
  },
  {
    key: "journal",
    moduleKey: "journal",
    label: "Journal",
    href: "/journals",
    links: [
      { href: "/journals", label: "Journals" },
      { href: "/habits", label: "Habits" },
      { href: "/tasks", label: "Tasks" },
      { href: "/decisions", label: "Decisions" },
    ],
  },
  {
    key: "field-resource-ops",
    moduleKey: "fieldOps",
    label: "FieldOps / ResourceOps",
    href: "/field-ops",
    links: [
      { href: "/field-ops", label: "FieldOps" },
      { href: "/field-ops/facilities", label: "Facilities" },
      { href: "/field-ops/bookings", label: "Bookings" },
      { href: "/field-ops/resources", label: "ResourceOps" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    key: "gear-ops",
    moduleKey: "gearOps",
    label: "GearOps",
    href: "/gear-ops",
    links: [
      { href: "/gear-ops", label: "GearOps" },
      { href: "/gear-ops/categories", label: "Categories" },
      { href: "/gear-ops/items", label: "Items" },
      { href: "/gear-ops/audits", label: "Audits" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    key: "admin",
    moduleKey: "admin",
    label: "Admin / Settings",
    href: "/prompt-assignments",
    links: [
      { href: "/reports", label: "Global Reports" },
      { href: "/prompt-assignments", label: "Prompt Assignments" },
    ],
  },
] as const;

export function getNavSidebarGroupsForUser(user: CurrentUser | null): readonly NavSidebarGroup[] {
  return NAV_SIDEBAR_GROUPS.filter((group) => canAccessModule(user, group.moduleKey));
}

export function isNavSidebarLinkActive(pathname: string, href: string): boolean {
  const isEntriesRoot = href === "/entries";
  const isEntryInboxPath = pathname.startsWith("/entries/inbox");

  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href + "/") && !(isEntriesRoot && isEntryInboxPath))
  );
}

/** Returns true when any child link in the group is active for the given pathname. */
export function isNavSidebarGroupActive(pathname: string, group: NavSidebarGroup): boolean {
  return group.links.some((link) => isNavSidebarLinkActive(pathname, link.href));
}

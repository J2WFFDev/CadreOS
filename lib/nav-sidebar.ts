export type NavSidebarLink = {
  href: string;
  label: string;
};

export type NavSidebarGroup = {
  label: string;
  links: readonly NavSidebarLink[];
};

export const NAV_SIDEBAR_GROUPS: readonly NavSidebarGroup[] = [
  {
    label: "Home",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/feed", label: "Feed" },
      { href: "/today", label: "Today" },
      { href: "/assigned", label: "Assigned to Me" },
      { href: "/notifications", label: "Notifications" },
    ],
  },
  {
    label: "MemberOps",
    links: [
      { href: "/programs", label: "Programs" },
      { href: "/people", label: "People" },
      { href: "/teams", label: "Teams" },
      // Temporary shared reports destination until MemberOps-specific reporting routes are split out.
      { href: "/reports", label: "Membership Lifecycle" },
    ],
  },
  {
    label: "EntryOps",
    links: [
      { href: "/entries", label: "Entries" },
      { href: "/entries/inbox", label: "Inbox" },
      // Temporary shared reports destination until EntryOps-specific reporting routes are split out.
      { href: "/reports", label: "Entry Reports" },
    ],
  },
  {
    label: "FieldOps / ResourceOps",
    links: [
      { href: "/field-ops", label: "FieldOps" },
      { href: "/field-ops/facilities", label: "Facilities" },
      { href: "/field-ops/bookings", label: "Bookings" },
      // Temporary shared reports destination until FieldOps/ResourceOps-specific reporting routes are split out.
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    label: "GearOps",
    links: [
      { href: "/gear-ops", label: "GearOps" },
      { href: "/gear-ops/categories", label: "Categories" },
      { href: "/gear-ops/items", label: "Items" },
      // Temporary shared reports destination until GearOps-specific reporting routes are split out.
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    label: "AdminOps",
    links: [
      { href: "/reports", label: "Global Reports" },
      { href: "/account", label: "Account" },
    ],
  },
] as const;

export function isNavSidebarLinkActive(pathname: string, href: string): boolean {
  const isEntriesRoot = href === "/entries";
  const isEntryInboxPath = pathname.startsWith("/entries/inbox");

  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href + "/") && !(isEntriesRoot && isEntryInboxPath))
  );
}

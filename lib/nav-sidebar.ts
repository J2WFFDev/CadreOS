export type NavSidebarLink = {
  href: string;
  label: string;
};

export type NavSidebarGroup = {
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
    label: "MemberOps",
    // TODO: Replace with /member-ops when a dedicated MemberOps landing page is created.
    href: "/programs",
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
    // TODO: Replace with /entry-ops when a dedicated EntryOps landing page is created.
    href: "/entries",
    links: [
      { href: "/entries", label: "Entries" },
      { href: "/entries/inbox", label: "Inbox" },
      // Temporary shared reports destination until EntryOps-specific reporting routes are split out.
      { href: "/reports", label: "Entry Reports" },
    ],
  },
  {
    label: "FieldOps / ResourceOps",
    // TODO: Split into /field-ops and /resource-ops when ResourceOps becomes a standalone module.
    href: "/field-ops",
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
    href: "/gear-ops",
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
    // TODO: Replace with /admin when a dedicated AdminOps landing page is created.
    href: "/reports",
    links: [
      { href: "/admin/roles", label: "Roles & Permissions" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/prompts", label: "Prompts / Templates" },
      { href: "/reports", label: "Global Reports" },
      { href: "/admin/audit", label: "Audit / History" },
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

/** Returns true when any child link in the group is active for the given pathname. */
export function isNavSidebarGroupActive(pathname: string, group: NavSidebarGroup): boolean {
  return group.links.some((link) => isNavSidebarLinkActive(pathname, link.href));
}

export type NavSidebarLink = {
  href: string;
  label: string;
};

export type NavSidebarGroup = {
  label: string;
  links: readonly NavSidebarLink[];
};

// Navigation taxonomy alignment notes:
// - MemberOps is the canonical roster/member domain name.
// - Seasons stay nested within Program detail routes, so there is no standalone sidebar link.
// - Membership Lifecycle, Entry labels/views, Entry Reports, and several AdminOps surfaces do not
//   have dedicated routes yet; keep them documented in planning until purpose-built routes exist.
// - Current /field-ops facilities/resources/bookings routes are ResourceOps-shaped infrastructure
//   grouped under a temporary FieldOps / ResourceOps sidebar label to avoid breaking URLs.
export const NAV_SIDEBAR_GROUPS: readonly NavSidebarGroup[] = [
  {
    label: "Home",
    links: [
      { href: "/dashboard", label: "Home" },
      { href: "/feed", label: "Feed" },
      { href: "/assigned", label: "Assigned to Me" },
      { href: "/today", label: "Today" },
      { href: "/upcoming", label: "Upcoming" },
      { href: "/events", label: "Events" },
      { href: "/notifications", label: "Notifications" },
    ],
  },
  {
    label: "MemberOps",
    links: [
      { href: "/people", label: "People" },
      { href: "/programs", label: "Programs" },
      { href: "/teams", label: "Teams" },
    ],
  },
  {
    label: "EntryOps",
    links: [
      { href: "/entries", label: "Entries" },
      { href: "/entries/inbox", label: "Inbox" },
    ],
  },
  {
    label: "FieldOps / ResourceOps",
    links: [
      { href: "/field-ops", label: "FieldOps" },
      { href: "/field-ops/facilities", label: "Facilities" },
      { href: "/field-ops/resources", label: "Resources" },
      { href: "/field-ops/bookings", label: "Bookings" },
    ],
  },
  {
    label: "GearOps",
    links: [
      { href: "/gear-ops", label: "GearOps" },
      { href: "/gear-ops/reports", label: "Reports" },
    ],
  },
  {
    label: "AdminOps",
    links: [
      { href: "/prompts", label: "Prompts & Templates" },
      { href: "/reports", label: "Global Reports" },
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

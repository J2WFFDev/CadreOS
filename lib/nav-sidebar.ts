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
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/feed", label: "Feed" },
      { href: "/assigned", label: "Assigned to Me" },
      { href: "/notifications", label: "Notifications" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    label: "Roster",
    links: [
      { href: "/people", label: "People" },
      { href: "/programs", label: "Programs" },
      { href: "/teams", label: "Teams" },
    ],
  },
  {
    label: "Schedule",
    links: [
      { href: "/today", label: "Today" },
      { href: "/upcoming", label: "Upcoming" },
      { href: "/events", label: "Events" },
    ],
  },
  {
    label: "Operations",
    links: [
      { href: "/field-ops", label: "FieldOps" },
      { href: "/gear-ops", label: "GearOps" },
    ],
  },
  {
    label: "Records",
    links: [
      { href: "/notes", label: "Notes" },
      { href: "/tasks", label: "Tasks" },
      { href: "/decisions", label: "Decisions" },
      { href: "/journals", label: "Journals" },
      { href: "/entries/inbox", label: "Entry Inbox" },
      { href: "/entries", label: "All Entries" },
    ],
  },
  {
    label: "Profile",
    links: [{ href: "/account", label: "Account" }],
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

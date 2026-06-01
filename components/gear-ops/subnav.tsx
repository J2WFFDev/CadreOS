import Link from "next/link";

/**
 * GearOps subnav — semantic groups make it easier to locate field vs. admin links.
 *
 * Groups:
 * - Field ops: Overview, Items, Scan/Mobile, Kits
 * - Event/planning: Reports, Event Templates
 * - Locations & audit: Locations, Audits, Labels
 * - Admin: Categories, Admin
 */

type SubnavKey =
  | "overview"
  | "items"
  | "reservations"
  | "scan"
  | "kits"
  | "bulk"
  | "reports"
  | "event-templates"
  | "locations"
  | "audits"
  | "labels"
  | "categories"
  | "admin";

type SubnavGroup = {
  label: string;
  links: { href: string; label: string; key: SubnavKey }[];
};

const GEAR_OPS_GROUPS: SubnavGroup[] = [
  {
    label: "Field",
    links: [
      { href: "/gear-ops", label: "Overview", key: "overview" },
      { href: "/gear-ops/items", label: "Items", key: "items" },
      { href: "/gear-ops/reservations", label: "Reservations", key: "reservations" },
      { href: "/gear-ops/scan", label: "Scan", key: "scan" },
      { href: "/gear-ops/kits", label: "Kits", key: "kits" },
      { href: "/gear-ops/bulk", label: "Bulk Ops", key: "bulk" },
    ],
  },
  {
    label: "Events",
    links: [
      { href: "/gear-ops/reports", label: "Reports", key: "reports" },
      { href: "/gear-ops/event-templates", label: "Event Templates", key: "event-templates" },
    ],
  },
  {
    label: "Ops",
    links: [
      { href: "/gear-ops/locations", label: "Locations", key: "locations" },
      { href: "/gear-ops/audits", label: "Audits", key: "audits" },
      { href: "/gear-ops/labels", label: "Labels", key: "labels" },
    ],
  },
  {
    label: "Admin",
    links: [
      { href: "/gear-ops/categories", label: "Categories", key: "categories" },
      { href: "/gear-ops/admin", label: "Settings", key: "admin" },
    ],
  },
];

export function GearOpsSubnav({ current }: { current: SubnavKey }) {
  return (
    <nav aria-label="GearOps sections" className="space-y-1.5">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {GEAR_OPS_GROUPS.map((group) => (
          <div key={group.label} className="flex items-center gap-1">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-600 hidden sm:inline">
              {group.label}
            </span>
            {group.links.map((link) => {
              const isActive = link.key === current;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-md border px-3 py-1.5 text-sm transition ${
                    isActive
                      ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                      : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

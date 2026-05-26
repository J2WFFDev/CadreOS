import Link from "next/link";

const GEAR_OPS_LINKS = [
  { href: "/gear-ops", label: "Overview", key: "overview" },
  { href: "/gear-ops/categories", label: "Categories", key: "categories" },
  { href: "/gear-ops/items", label: "Items", key: "items" },
  { href: "/gear-ops/reports", label: "Reports", key: "reports" },
  { href: "/gear-ops/labels", label: "Labels", key: "labels" },
  { href: "/gear-ops/scan", label: "Scan / Mobile", key: "scan" },
  { href: "/gear-ops/locations", label: "Locations", key: "locations" },
  { href: "/gear-ops/kits", label: "Kits", key: "kits" },
  { href: "/gear-ops/audits", label: "Audits", key: "audits" },
] as const;

export function GearOpsSubnav({
  current,
}: {
  current: (typeof GEAR_OPS_LINKS)[number]["key"];
}) {
  return (
    <nav aria-label="GearOps sections" className="flex flex-wrap gap-2">
      {GEAR_OPS_LINKS.map((link) => {
        const isActive = link.key === current;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

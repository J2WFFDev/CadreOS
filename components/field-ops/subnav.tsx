import Link from "next/link";

const FIELD_OPS_LINKS = [
  { href: "/field-ops/facilities", label: "Facilities", key: "facilities" },
  { href: "/field-ops/bookings", label: "Bookings", key: "bookings" },
] as const;

export function FieldOpsSubnav({
  current,
}: {
  current: (typeof FIELD_OPS_LINKS)[number]["key"];
}) {
  return (
    <nav aria-label="FieldOps sections" className="flex flex-wrap gap-2">
      {FIELD_OPS_LINKS.map((link) => {
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

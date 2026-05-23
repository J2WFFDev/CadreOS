import Link from "next/link";

type ReviewFocusStat = {
  label: string;
  value: number | string;
  href?: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  helper?: string;
};

type ReviewFocusLink = {
  label: string;
  href: string;
};

type ReviewFocusPanelProps = {
  title: string;
  description: string;
  stats: ReviewFocusStat[];
  links?: ReviewFocusLink[];
  activeFilters?: string[];
  defaultScope?: string;
  guidance?: string;
};

const STAT_TONE_CLASS_NAMES: Record<NonNullable<ReviewFocusStat["tone"]>, string> = {
  neutral: "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40",
  info: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  danger: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
  success: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
};

export function ReviewFocusPanel({
  title,
  description,
  stats,
  links,
  activeFilters,
  defaultScope,
  guidance,
}: ReviewFocusPanelProps) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>

      {activeFilters && activeFilters.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {activeFilters.map((filter) => (
            <span key={filter} className="rounded-full border px-2 py-1">
              {filter}
            </span>
          ))}
        </div>
      ) : defaultScope ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{defaultScope}</p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const className = `rounded-lg border p-3 ${STAT_TONE_CLASS_NAMES[stat.tone ?? "neutral"]}`;
          const content = (
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{stat.label}</p>
              <p className="mt-2 text-xl font-semibold">{stat.value}</p>
              {stat.helper ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{stat.helper}</p> : null}
            </>
          );

          return stat.href ? (
            <Link key={stat.label} href={stat.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={stat.label} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      {links && links.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {links.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href} className="rounded-full border px-2 py-1">
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}

      {guidance ? <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{guidance}</p> : null}
    </div>
  );
}

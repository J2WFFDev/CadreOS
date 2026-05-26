/**
 * GearDashboardCard — a metric summary tile for the GearOps landing and reports pages.
 *
 * Supports:
 * - A numeric value with a tone-colored accent bar
 * - An optional href that makes the entire card a link
 * - An optional concern level that colours the count
 * - An optional subtitle for additional context
 */

import Link from "next/link";

import { type LifecycleTone } from "@/lib/gear-ops-ui";

export function GearDashboardCard({
  label,
  value,
  subtitle,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  href?: string;
  tone?: LifecycleTone;
}) {
  const accent = toneToAccentClass(tone);
  const content = (
    <article className="relative overflow-hidden rounded-lg border bg-white p-4 dark:bg-zinc-900">
      {/* Tone accent bar along the left edge */}
      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${accent}`} aria-hidden="true" />
      <p className="pl-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 pl-2 text-2xl font-semibold tracking-tight ${valueTextClass(tone)}`}>
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1 pl-2 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      ) : null}
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-lg transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
      {content}
    </Link>
  );
}

function toneToAccentClass(tone: LifecycleTone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-400 dark:bg-emerald-600";
    case "warning":
      return "bg-amber-400 dark:bg-amber-600";
    case "danger":
      return "bg-rose-400 dark:bg-rose-600";
    case "info":
      return "bg-blue-400 dark:bg-blue-600";
    default:
      return "bg-zinc-200 dark:bg-zinc-700";
  }
}

function valueTextClass(tone: LifecycleTone): string {
  switch (tone) {
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "danger":
      return "text-rose-700 dark:text-rose-400";
    case "success":
      return "text-emerald-700 dark:text-emerald-400";
    case "info":
      return "text-blue-700 dark:text-blue-400";
    default:
      return "text-zinc-900 dark:text-zinc-50";
  }
}

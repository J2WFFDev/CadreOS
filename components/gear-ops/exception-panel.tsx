/**
 * GearExceptionPanel — renders a scannable list of operational exceptions.
 *
 * Each exception has a severity level, a title, a detail line, and an optional
 * action link. Exceptions are grouped by severity (critical → warning → info).
 *
 * Used on the GearOps landing page and reports page to surface items that need
 * attention without forcing users to drill into every list.
 */

import Link from "next/link";

import { toneToBoxClass, type LifecycleTone } from "@/lib/gear-ops-ui";

export type GearException = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href?: string;
  actionLabel?: string;
};

const SEV_ORDER = { critical: 0, warning: 1, info: 2 } as const;

function severityToTone(severity: GearException["severity"]): LifecycleTone {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    case "info":
      return "info";
  }
}

function severityLabel(severity: GearException["severity"]): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "info":
      return "Notice";
  }
}

export function GearExceptionPanel({
  exceptions,
  title = "Operational exceptions",
  emptyMessage = "No exceptions detected.",
  maxVisible = 8,
}: {
  exceptions: GearException[];
  title?: string;
  emptyMessage?: string;
  maxVisible?: number;
}) {
  const sorted = [...exceptions].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  );
  const visible = sorted.slice(0, maxVisible);
  const overflow = sorted.length - visible.length;

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">{title}</h3>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((ex) => {
            const tone = severityToTone(ex.severity);
            return (
              <li
                key={ex.id}
                className={`rounded-lg border px-3 py-2.5 text-sm ${toneToBoxClass(tone)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">
                        {severityLabel(ex.severity)}
                      </span>
                      {ex.title}
                    </p>
                    <p className="text-xs opacity-80">{ex.detail}</p>
                  </div>
                  {ex.href ? (
                    <Link
                      href={ex.href}
                      className="shrink-0 rounded-md border border-current px-2.5 py-1 text-xs font-medium opacity-80 hover:opacity-100"
                    >
                      {ex.actionLabel ?? "View"}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {overflow > 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          +{overflow} more exception{overflow === 1 ? "" : "s"} — see reports for full list.
        </p>
      ) : null}
    </div>
  );
}

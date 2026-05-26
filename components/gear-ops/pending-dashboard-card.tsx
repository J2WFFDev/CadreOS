"use client";

import { summarizeGearPendingActions } from "@/lib/gear-offline";
import { useGearOffline } from "@/components/gear-ops/offline-provider";

export function GearPendingDashboardCard() {
  const { actions } = useGearOffline();
  const summary = summarizeGearPendingActions(actions);
  const unresolved = summary.pendingCount + summary.failedCount + summary.reviewCount;

  return (
    <article className="relative overflow-hidden rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${unresolved > 0 ? "bg-amber-400 dark:bg-amber-600" : "bg-emerald-400 dark:bg-emerald-600"}`} aria-hidden="true" />
      <p className="pl-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pending field actions</p>
      <p className={`mt-2 pl-2 text-2xl font-semibold tracking-tight ${unresolved > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
        {unresolved}
      </p>
      <p className="mt-1 pl-2 text-xs text-zinc-500 dark:text-zinc-400">
        {summary.reviewCount} need review · {summary.failedCount} failed · {summary.completedCount} locally confirmed
      </p>
    </article>
  );
}

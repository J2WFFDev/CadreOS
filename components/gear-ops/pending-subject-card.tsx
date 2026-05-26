"use client";

import { useMemo } from "react";

import { getGearPendingActionStatusLabel, type GearPendingActionSubjectType } from "@/lib/gear-offline";
import { useGearOffline } from "@/components/gear-ops/offline-provider";

export function GearPendingSubjectCard({
  subjectType,
  subjectId,
  title,
  emptyMessage,
}: {
  subjectType: GearPendingActionSubjectType;
  subjectId: string;
  title: string;
  emptyMessage: string;
}) {
  const { getActionsForSubject } = useGearOffline();
  const actions = useMemo(
    () => getActionsForSubject(subjectType, subjectId).filter((action) => action.status !== "COMPLETED"),
    [getActionsForSubject, subjectId, subjectType],
  );

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <h3 className="text-lg font-medium">{title}</h3>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {actions.map((action) => (
            <div key={action.id} className="rounded-md border border-dashed p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{action.label}</p>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{getGearPendingActionStatusLabel(action.status)}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Local only until the server confirms it. Confirmed history stays in the standard activity sections.
              </p>
              {action.lastError ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{action.lastError}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

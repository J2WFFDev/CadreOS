import type { ReactNode } from "react";
import Link from "next/link";

import { formatDateTime } from "@/lib/follow-up-tasks";
import { type OperationalHistoryItem } from "@/lib/operational-history";

const KIND_LABELS: Record<OperationalHistoryItem["kind"], string> = {
  task: "Task",
  note: "Note",
  attendance: "Attendance",
  event: "Event",
  roster: "Roster",
  assignment: "Assignment",
};

const KIND_BADGE_CLASS_NAMES: Record<OperationalHistoryItem["kind"], string> = {
  task: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  note: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  attendance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  event: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  roster: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  assignment: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

export function OperationalHistoryPanel(props: {
  id?: string;
  title: string;
  description?: string;
  emptyMessage: string;
  items: OperationalHistoryItem[];
  action?: {
    href: string;
    label: string;
  };
  footer?: ReactNode;
}) {
  return (
    <div id={props.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-medium">{props.title}</h3>
          {props.description ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{props.description}</p>
          ) : null}
        </div>
        {props.action ? (
          <Link href={props.action.href} className="text-sm underline">
            {props.action.label}
          </Link>
        ) : null}
      </div>

      {props.items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{props.emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {props.items.map((item) => (
            <div key={item.id} className="border-b pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASS_NAMES[item.kind]}`}
                >
                  {KIND_LABELS[item.kind]}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.changeLabel}</span>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {item.communicationClassification.categoryLabel}
                </span>
                {item.notificationCandidateEvaluation.isCandidate ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {item.notificationCandidateEvaluation.candidateLabel}
                  </span>
                ) : null}
                {item.unresolvedLabel ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {item.unresolvedLabel}
                  </span>
                ) : null}
              </div>
              <Link href={item.href} className="mt-2 block font-medium underline">
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.summary}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Changed: {formatDateTime(item.changedAt)}</span>
                <span>
                  {item.actor.label}:{" "}
                  {item.actor.name ? (
                    item.actor.href ? (
                      <Link href={item.actor.href} className="underline">
                        {item.actor.name}
                      </Link>
                    ) : (
                      item.actor.name
                    )
                  ) : (
                    "not stored"
                  )}
                </span>
              </div>
              {item.contexts.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {item.contexts.map((context) =>
                    context.href ? (
                      <Link key={`${item.id}-${context.label}-${context.value}`} href={context.href} className="rounded-full border px-2 py-1">
                        {context.label}: {context.value}
                      </Link>
                    ) : (
                      <span
                        key={`${item.id}-${context.label}-${context.value}`}
                        className="rounded-full border px-2 py-1"
                      >
                        {context.label}: {context.value}
                      </span>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {props.footer ? <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{props.footer}</div> : null}
    </div>
  );
}

// Phase 12D — Internal Operational Awareness Panel
//
// Read-only internal awareness panel grouped by candidate category.
// This component is intentionally informational-only and must not be
// extended with action queues, Inbox semantics, Feed semantics, or
// delivery behavior.

import Link from "next/link";

import { formatDateTime } from "@/lib/follow-up-tasks";
import { type OperationalAwarenessView } from "@/lib/operational-awareness";

export function OperationalAwarenessPanel(props: { awarenessView: OperationalAwarenessView }) {
  const { awarenessView } = props;

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="space-y-1">
        <h3 className="text-base font-medium">Internal operational awareness</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Read-only internal awareness summary grouped by candidate category. This view surfaces
          classification metadata from current operational workflows only. It is informational
          context — not an Inbox, Feed, action queue, or delivery mechanism.
        </p>
      </div>

      {awarenessView.totalCandidateCount === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No awareness candidates detected across recent operational activity.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {awarenessView.categories.map((category) => (
            <div key={category.candidateType}>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{category.label}</h4>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {category.items.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {category.description}
              </p>
              <div className="mt-2 space-y-2">
                {category.items.map((item) => (
                  <div key={item.id} className="rounded border px-3 py-2 text-sm">
                    <Link href={item.href} className="font-medium underline">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.summary}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Changed: {formatDateTime(item.changedAt)}</span>
                      {item.actorLabel ? <span>{item.actorLabel}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
        Internal-only awareness context derived from existing operational workflows. Deferred: Inbox
        runtime, Feed runtime, delivery channels, reminders, messaging/chat, guardian communication,
        escalation workflows.
      </p>
    </div>
  );
}

import Link from "next/link";

import { formatDateTime } from "@/lib/follow-up-tasks";
import {
  OPERATIONAL_READINESS_EVALUATION_STATUS,
  type OperationalReadinessEvaluationStatus,
} from "@/lib/operational-readiness-evaluation";
import { type OperationalIntelligenceAwarenessView } from "@/lib/operational-intelligence-awareness";

const STATUS_CLASS_NAMES: Record<OperationalReadinessEvaluationStatus, string> = {
  [OPERATIONAL_READINESS_EVALUATION_STATUS.CLEAR]:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  [OPERATIONAL_READINESS_EVALUATION_STATUS.MONITOR]:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  [OPERATIONAL_READINESS_EVALUATION_STATUS.NEEDS_REVIEW]:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
};

function formatSummaryKinds(kinds: string[]) {
  if (kinds.length === 0) {
    return "No linked classifications";
  }

  return kinds
    .map((kind) => kind.replaceAll("_", " "))
    .map((kind) => kind.charAt(0).toUpperCase() + kind.slice(1))
    .join(" · ");
}

export function OperationalIntelligenceAwarenessPanel(props: {
  awarenessView: OperationalIntelligenceAwarenessView;
}) {
  const { awarenessView } = props;

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="space-y-1">
        <h3 className="text-base font-medium">Operational Intelligence awareness</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lightweight, read-only, internal staff awareness derived from existing summary classifications
          and readiness metadata. This view is informational only — not AI output, recommendations,
          automation, autonomous behavior, Inbox behavior, or Feed behavior.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{awarenessView.totalSourceItemCount} authorized source items reviewed</span>
        <span>{awarenessView.totalMatchedItemCount} awareness-linked summary matches</span>
        <span>Needs review: {awarenessView.countsByStatus.needs_review}</span>
        <span>Monitor: {awarenessView.countsByStatus.monitor}</span>
        <span>Generated: {formatDateTime(awarenessView.generatedAt)}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {awarenessView.awarenessItems.map((item) => (
          <div key={item.awareness} className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">{item.label}</h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS_NAMES[item.status]}`}
              >
                {item.statusLabel}
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold">{item.matchedItemCount} matched item(s)</p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{item.summary}</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Linked classifications: {formatSummaryKinds(item.linkedClassifications)}
            </p>

            <div className="mt-3">
              <Link href={item.href} className="text-xs underline">
                Review source workflow
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
        Deferred: AI-generated intelligence/recommendations, autonomous prioritization, escalation
        workflows, automated task generation, automation behavior, guardian-facing intelligence, and
        Feed/Inbox runtime behavior.
      </p>
    </div>
  );
}

import Link from "next/link";

import { formatDateTime } from "@/lib/follow-up-tasks";
import {
  OPERATIONAL_READINESS_EVALUATION_STATUS,
  type OperationalReadinessEvaluationStatus,
  type OperationalReadinessEvaluationView,
} from "@/lib/operational-readiness-evaluation";

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
    return "No matched source kinds yet";
  }

  return kinds
    .map((kind) => kind.replaceAll("_", " "))
    .map((kind) => kind.charAt(0).toUpperCase() + kind.slice(1))
    .join(" · ");
}

export function OperationalReadinessEvaluationPanel(props: {
  readinessView: OperationalReadinessEvaluationView;
}) {
  const { readinessView } = props;

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="space-y-1">
        <h3 className="text-base font-medium">Internal readiness evaluation</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lightweight, internal-only readiness heuristics derived from existing authorized workflow data.
          These evaluations are informational only — not AI output, recommendations, workflow automation,
          guardian intelligence, Inbox behavior, or Feed behavior.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{readinessView.totalSourceItemCount} authorized source items reviewed</span>
        <span>{readinessView.totalTriggeredConcernCount} readiness concerns currently triggered</span>
        <span>Needs review: {readinessView.countsByStatus.needs_review}</span>
        <span>Monitor: {readinessView.countsByStatus.monitor}</span>
        <span>Generated: {formatDateTime(readinessView.generatedAt)}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {readinessView.evaluations.map((evaluation) => (
          <div key={evaluation.concern} className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">{evaluation.label}</h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{evaluation.description}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS_NAMES[evaluation.status]}`}
              >
                {evaluation.statusLabel}
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold">{evaluation.matchedItemCount} matched item(s)</p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{evaluation.heuristicSummary}</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{evaluation.heuristicReason}</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Source kinds: {formatSummaryKinds(evaluation.sourceKinds)}
            </p>

            <div className="mt-3">
              <Link href={evaluation.href} className="text-xs underline">
                Review source workflow
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
        Deferred: AI-generated readiness analysis, recommendations, automated prioritization, workflow
        automation, autonomous actions, guardian-facing intelligence, and Feed/Inbox runtime behavior.
      </p>
    </div>
  );
}

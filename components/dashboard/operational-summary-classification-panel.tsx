import Link from "next/link";

import { formatDateTime } from "@/lib/follow-up-tasks";
import { type OperationalSummaryClassificationView } from "@/lib/operational-summary-classification";

function formatSummaryKinds(kinds: string[]) {
  if (kinds.length === 0) {
    return "No matched source kinds yet";
  }

  return kinds
    .map((kind) => kind.replaceAll("_", " "))
    .map((kind) => kind.charAt(0).toUpperCase() + kind.slice(1))
    .join(" · ");
}

export function OperationalSummaryClassificationPanel(props: {
  summaryView: OperationalSummaryClassificationView;
}) {
  const { summaryView } = props;

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="space-y-1">
        <h3 className="text-base font-medium">Operational summary classifications</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Internal-only summary categorization derived from already-authorized operational history. These
          classifications are informational context only — not AI summaries, recommendations, automation,
          Inbox behavior, or Feed behavior.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{summaryView.totalSourceItemCount} authorized source items reviewed</span>
        <span>{summaryView.totalMatchedItemCount} summary classification matches</span>
        <span>Generated: {formatDateTime(summaryView.generatedAt)}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summaryView.classifications.map((classification) => (
          <div key={classification.classification} className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">{classification.label}</h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{classification.description}</p>
              </div>
              <span className="inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium">
                {classification.itemCount}
              </span>
            </div>

            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">{classification.ruleSummary}</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Source kinds: {formatSummaryKinds(classification.sourceKinds)}
            </p>

            <div className="mt-3">
              <Link href={classification.href} className="text-xs underline">
                Review source workflow
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
        Deferred: AI-generated summaries, automated recommendations, workflow automation, autonomous
        actions, guardian-facing intelligence, and Feed/Inbox runtime behavior.
      </p>
    </div>
  );
}

// Phase 13C — Internal Readiness Evaluation Foundation
//
// Purpose:
//   Provide a lightweight, internal-only readiness-evaluation layer derived from
//   already-authorized operational summary classifications and history data.
//
// What this is NOT:
//   - Not AI-generated readiness output.
//   - Not a recommendation engine.
//   - Not workflow automation.
//   - Not autonomous operational behavior.
//   - Not guardian-facing intelligence behavior.
//   - Not Feed or Inbox runtime behavior.
//
// Deferred behavior:
//   - AI-generated readiness analysis.
//   - Recommendation runtime behavior.
//   - Workflow automation / escalation.
//   - Guardian-facing intelligence surfaces.
//   - Feed / Inbox runtime behavior.

import { type InternalNotificationCandidateType } from "@/lib/communication-classification";
import { type OperationalHistoryItem } from "@/lib/operational-history";
import {
  buildOperationalSummaryClassificationView,
  OPERATIONAL_SUMMARY_CLASSIFICATION,
  type OperationalSummaryClassification,
  type OperationalSummaryClassificationType,
  type OperationalSummaryClassificationView,
} from "@/lib/operational-summary-classification";

export const OPERATIONAL_READINESS_EVALUATION = {
  OPERATIONAL_READINESS_CONCERN: "operational_readiness_concern",
  FOLLOW_UP_BACKLOG_CONCERN: "follow_up_backlog_concern",
  ATTENDANCE_REVIEW_CONCERN: "attendance_review_concern",
  STAFFING_LOAD_VISIBILITY_CONCERN: "staffing_load_visibility_concern",
  UNRESOLVED_OPERATIONAL_ISSUE_CONCERN: "unresolved_operational_issue_concern",
} as const;

export type OperationalReadinessEvaluationType =
  (typeof OPERATIONAL_READINESS_EVALUATION)[keyof typeof OPERATIONAL_READINESS_EVALUATION];

export const OPERATIONAL_READINESS_EVALUATION_STATUS = {
  CLEAR: "clear",
  MONITOR: "monitor",
  NEEDS_REVIEW: "needs_review",
} as const;

export type OperationalReadinessEvaluationStatus =
  (typeof OPERATIONAL_READINESS_EVALUATION_STATUS)[keyof typeof OPERATIONAL_READINESS_EVALUATION_STATUS];

export type OperationalReadinessEvaluation = {
  concern: OperationalReadinessEvaluationType;
  label: string;
  description: string;
  heuristicSummary: string;
  heuristicReason: string;
  status: OperationalReadinessEvaluationStatus;
  statusLabel: string;
  matchedItemCount: number;
  sourceKinds: OperationalHistoryItem["kind"][];
  candidateTypes: InternalNotificationCandidateType[];
  linkedClassifications: OperationalSummaryClassificationType[];
  href: string;
  internalOnly: true;
  informationalOnly: true;
  aiDeferred: true;
  recommendationDeferred: true;
  automationDeferred: true;
  guardianIntelligenceDeferred: true;
};

export type OperationalReadinessEvaluationView = {
  evaluations: OperationalReadinessEvaluation[];
  totalSourceItemCount: number;
  totalTriggeredConcernCount: number;
  countsByStatus: Record<OperationalReadinessEvaluationStatus, number>;
  generatedAt: Date;
  internalOnly: true;
  informationalOnly: true;
  aiDeferred: true;
  recommendationDeferred: true;
  automationDeferred: true;
  guardianIntelligenceDeferred: true;
  isInbox: false;
  isFeed: false;
  hasAutonomousBehavior: false;
};

type EvaluationDefinition = {
  label: string;
  description: string;
  heuristicSummary: string;
  href: string;
  linkedClassifications: OperationalSummaryClassificationType[];
  monitorAtCount: number;
  needsReviewAtCount: number;
};

const EVALUATION_ORDER: OperationalReadinessEvaluationType[] = [
  OPERATIONAL_READINESS_EVALUATION.OPERATIONAL_READINESS_CONCERN,
  OPERATIONAL_READINESS_EVALUATION.FOLLOW_UP_BACKLOG_CONCERN,
  OPERATIONAL_READINESS_EVALUATION.ATTENDANCE_REVIEW_CONCERN,
  OPERATIONAL_READINESS_EVALUATION.STAFFING_LOAD_VISIBILITY_CONCERN,
  OPERATIONAL_READINESS_EVALUATION.UNRESOLVED_OPERATIONAL_ISSUE_CONCERN,
];

const EVALUATION_DEFINITIONS: Record<OperationalReadinessEvaluationType, EvaluationDefinition> = {
  [OPERATIONAL_READINESS_EVALUATION.OPERATIONAL_READINESS_CONCERN]: {
    label: "Operational readiness concern",
    description: "Highlights upcoming operational readiness context already flagged in existing event-linked workflows.",
    heuristicSummary:
      "Count-based heuristic over readiness summary candidates; informational only, with no AI analysis or action-taking behavior.",
    href: "/events?operationalIndicator=upcoming_operational_concern",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.READINESS_SUMMARY_CANDIDATE],
    monitorAtCount: 1,
    needsReviewAtCount: 2,
  },
  [OPERATIONAL_READINESS_EVALUATION.FOLLOW_UP_BACKLOG_CONCERN]: {
    label: "Follow-up backlog concern",
    description: "Tracks unresolved follow-up workload already present in current follow-up task workflows.",
    heuristicSummary:
      "Count-based heuristic over unresolved follow-up workload; this does not recommend prioritization or create tasks automatically.",
    href: "/tasks?resolution=unresolved",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.FOLLOW_UP_WORKLOAD_SUMMARY],
    monitorAtCount: 1,
    needsReviewAtCount: 3,
  },
  [OPERATIONAL_READINESS_EVALUATION.ATTENDANCE_REVIEW_CONCERN]: {
    label: "Attendance review concern",
    description: "Surfaces attendance review workload already captured through attendance and event review workflows.",
    heuristicSummary:
      "Count-based heuristic over attendance concern summaries; informational only, with no reminder dispatch or escalation behavior.",
    href: "/events?operationalIndicator=attendance_not_reviewed_recently",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.ATTENDANCE_CONCERN_SUMMARY],
    monitorAtCount: 1,
    needsReviewAtCount: 2,
  },
  [OPERATIONAL_READINESS_EVALUATION.STAFFING_LOAD_VISIBILITY_CONCERN]: {
    label: "Staffing/load visibility concern",
    description: "Keeps roster and assignment/load context visible for staff review without inferring staffing decisions.",
    heuristicSummary:
      "Count-based heuristic over assignment/load visibility summaries; this is visibility metadata only and does not automate staffing actions.",
    href: "/teams?readiness=needs_attention",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.ASSIGNMENT_LOAD_VISIBILITY_SUMMARY],
    monitorAtCount: 1,
    needsReviewAtCount: 4,
  },
  [OPERATIONAL_READINESS_EVALUATION.UNRESOLVED_OPERATIONAL_ISSUE_CONCERN]: {
    label: "Unresolved operational issue concern",
    description: "Consolidates unresolved operational workload already present across task, note, attendance, and event history.",
    heuristicSummary:
      "Count-based heuristic over unresolved operational workload; no automated prioritization, escalation, or task generation is introduced.",
    href: "/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.UNRESOLVED_OPERATIONAL_WORKLOAD_SUMMARY],
    monitorAtCount: 1,
    needsReviewAtCount: 3,
  },
};

function getStatusFromCount(
  count: number,
  monitorAtCount: number,
  needsReviewAtCount: number,
): OperationalReadinessEvaluationStatus {
  if (count >= needsReviewAtCount) {
    return OPERATIONAL_READINESS_EVALUATION_STATUS.NEEDS_REVIEW;
  }

  if (count >= monitorAtCount) {
    return OPERATIONAL_READINESS_EVALUATION_STATUS.MONITOR;
  }

  return OPERATIONAL_READINESS_EVALUATION_STATUS.CLEAR;
}

function getStatusLabel(status: OperationalReadinessEvaluationStatus) {
  if (status === OPERATIONAL_READINESS_EVALUATION_STATUS.NEEDS_REVIEW) {
    return "Needs review";
  }

  if (status === OPERATIONAL_READINESS_EVALUATION_STATUS.MONITOR) {
    return "Monitor";
  }

  return "Clear";
}

function getHeuristicReason(input: {
  count: number;
  linkedClassifications: OperationalSummaryClassificationType[];
}) {
  if (input.count === 0) {
    return "No authorized items currently match this readiness heuristic.";
  }

  const classificationLabel =
    input.linkedClassifications.length === 1 ? "summary classification" : "summary classifications";

  return `${input.count} authorized item${input.count === 1 ? "" : "s"} currently match the linked ${classificationLabel}.`;
}

function collectClassificationMetadata(
  classifications: OperationalSummaryClassification[],
  linkedClassifications: OperationalSummaryClassificationType[],
) {
  const matchedClassifications = linkedClassifications
    .map((classification) => classifications.find((item) => item.classification === classification))
    .filter((classification): classification is OperationalSummaryClassification => Boolean(classification));

  return {
    matchedItemCount: matchedClassifications.reduce((sum, classification) => sum + classification.itemCount, 0),
    sourceKinds: Array.from(new Set(matchedClassifications.flatMap((classification) => classification.sourceKinds))),
    candidateTypes: Array.from(
      new Set(matchedClassifications.flatMap((classification) => classification.candidateTypes)),
    ),
  };
}

/**
 * Pure readiness-evaluation helper derived from already-authorized operational
 * history and summary-classification data.
 *
 * Callers must apply organization scoping and staff authorization before
 * invoking this helper.
 */
export function buildOperationalReadinessEvaluationView(input: {
  items: OperationalHistoryItem[];
  summaryView?: OperationalSummaryClassificationView;
}): OperationalReadinessEvaluationView {
  const summaryView = input.summaryView ?? buildOperationalSummaryClassificationView(input.items);

  const evaluations = EVALUATION_ORDER.map((concern) => {
    const definition = EVALUATION_DEFINITIONS[concern];
    const metadata = collectClassificationMetadata(
      summaryView.classifications,
      definition.linkedClassifications,
    );
    const status = getStatusFromCount(
      metadata.matchedItemCount,
      definition.monitorAtCount,
      definition.needsReviewAtCount,
    );

    return {
      concern,
      label: definition.label,
      description: definition.description,
      heuristicSummary: definition.heuristicSummary,
      heuristicReason: getHeuristicReason({
        count: metadata.matchedItemCount,
        linkedClassifications: definition.linkedClassifications,
      }),
      status,
      statusLabel: getStatusLabel(status),
      matchedItemCount: metadata.matchedItemCount,
      sourceKinds: metadata.sourceKinds,
      candidateTypes: metadata.candidateTypes,
      linkedClassifications: definition.linkedClassifications,
      href: definition.href,
      internalOnly: true as const,
      informationalOnly: true as const,
      aiDeferred: true as const,
      recommendationDeferred: true as const,
      automationDeferred: true as const,
      guardianIntelligenceDeferred: true as const,
    };
  });

  const countsByStatus = evaluations.reduce<Record<OperationalReadinessEvaluationStatus, number>>(
    (totals, evaluation) => {
      totals[evaluation.status] += 1;
      return totals;
    },
    {
      [OPERATIONAL_READINESS_EVALUATION_STATUS.CLEAR]: 0,
      [OPERATIONAL_READINESS_EVALUATION_STATUS.MONITOR]: 0,
      [OPERATIONAL_READINESS_EVALUATION_STATUS.NEEDS_REVIEW]: 0,
    },
  );

  return {
    evaluations,
    totalSourceItemCount: summaryView.totalSourceItemCount,
    totalTriggeredConcernCount: evaluations.filter(
      (evaluation) => evaluation.status !== OPERATIONAL_READINESS_EVALUATION_STATUS.CLEAR,
    ).length,
    countsByStatus,
    generatedAt: new Date(),
    internalOnly: true as const,
    informationalOnly: true as const,
    aiDeferred: true as const,
    recommendationDeferred: true as const,
    automationDeferred: true as const,
    guardianIntelligenceDeferred: true as const,
    isInbox: false as const,
    isFeed: false as const,
    hasAutonomousBehavior: false as const,
  };
}

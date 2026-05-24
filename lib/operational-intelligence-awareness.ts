// Phase 13D — Internal Operational Intelligence Awareness View
//
// Purpose:
//   Provide a lightweight, read-only, internal-only operational intelligence
//   awareness layer derived from already-authorized Phase 13B summary
//   classifications and Phase 13C readiness evaluations.
//
// What this is NOT:
//   - Not AI-generated intelligence behavior.
//   - Not a recommendation engine.
//   - Not workflow automation.
//   - Not autonomous operational action-taking.
//   - Not guardian-facing intelligence behavior.
//   - Not Feed or Inbox runtime behavior.
//
// Deferred behavior:
//   - AI-generated intelligence/recommendation behavior.
//   - Automated prioritization, escalation, and workflow automation.
//   - Feed / Inbox runtime behavior.
//   - Guardian-facing intelligence behavior.

import {
  OPERATIONAL_READINESS_EVALUATION,
  OPERATIONAL_READINESS_EVALUATION_STATUS,
  type OperationalReadinessEvaluation,
  type OperationalReadinessEvaluationStatus,
  type OperationalReadinessEvaluationType,
  type OperationalReadinessEvaluationView,
} from "@/lib/operational-readiness-evaluation";
import {
  OPERATIONAL_SUMMARY_CLASSIFICATION,
  type OperationalSummaryClassification,
  type OperationalSummaryClassificationType,
  type OperationalSummaryClassificationView,
} from "@/lib/operational-summary-classification";

export const OPERATIONAL_INTELLIGENCE_AWARENESS = {
  OPERATIONAL_READINESS_VISIBILITY: "operational_readiness_visibility",
  FOLLOW_UP_WORKLOAD_VISIBILITY: "follow_up_workload_visibility",
  UNRESOLVED_OPERATIONAL_CONCERN_VISIBILITY: "unresolved_operational_concern_visibility",
  STAFFING_LOAD_VISIBILITY: "staffing_load_visibility",
  ATTENDANCE_REVIEW_VISIBILITY: "attendance_review_visibility",
} as const;

export type OperationalIntelligenceAwarenessType =
  (typeof OPERATIONAL_INTELLIGENCE_AWARENESS)[keyof typeof OPERATIONAL_INTELLIGENCE_AWARENESS];

export type OperationalIntelligenceAwarenessItem = {
  awareness: OperationalIntelligenceAwarenessType;
  label: string;
  description: string;
  summary: string;
  status: OperationalReadinessEvaluationStatus;
  statusLabel: string;
  matchedItemCount: number;
  linkedClassifications: OperationalSummaryClassificationType[];
  linkedReadinessConcern: OperationalReadinessEvaluationType;
  href: string;
  internalOnly: true;
  informationalOnly: true;
  readOnly: true;
  aiDeferred: true;
  recommendationDeferred: true;
  automationDeferred: true;
  guardianIntelligenceDeferred: true;
};

export type OperationalIntelligenceAwarenessView = {
  awarenessItems: OperationalIntelligenceAwarenessItem[];
  totalSourceItemCount: number;
  totalMatchedItemCount: number;
  countsByStatus: Record<OperationalReadinessEvaluationStatus, number>;
  generatedAt: Date;
  internalOnly: true;
  informationalOnly: true;
  readOnly: true;
  aiDeferred: true;
  recommendationDeferred: true;
  automationDeferred: true;
  guardianIntelligenceDeferred: true;
  isInbox: false;
  isFeed: false;
  hasAutonomousBehavior: false;
};

type AwarenessDefinition = {
  label: string;
  description: string;
  linkedClassifications: OperationalSummaryClassificationType[];
  linkedReadinessConcern: OperationalReadinessEvaluationType;
};

const AWARENESS_ORDER: OperationalIntelligenceAwarenessType[] = [
  OPERATIONAL_INTELLIGENCE_AWARENESS.OPERATIONAL_READINESS_VISIBILITY,
  OPERATIONAL_INTELLIGENCE_AWARENESS.FOLLOW_UP_WORKLOAD_VISIBILITY,
  OPERATIONAL_INTELLIGENCE_AWARENESS.UNRESOLVED_OPERATIONAL_CONCERN_VISIBILITY,
  OPERATIONAL_INTELLIGENCE_AWARENESS.STAFFING_LOAD_VISIBILITY,
  OPERATIONAL_INTELLIGENCE_AWARENESS.ATTENDANCE_REVIEW_VISIBILITY,
];

const AWARENESS_DEFINITIONS: Record<OperationalIntelligenceAwarenessType, AwarenessDefinition> = {
  [OPERATIONAL_INTELLIGENCE_AWARENESS.OPERATIONAL_READINESS_VISIBILITY]: {
    label: "Operational readiness visibility",
    description:
      "Read-only visibility into current readiness-related context already captured in authorized workflow history.",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.READINESS_SUMMARY_CANDIDATE],
    linkedReadinessConcern: OPERATIONAL_READINESS_EVALUATION.OPERATIONAL_READINESS_CONCERN,
  },
  [OPERATIONAL_INTELLIGENCE_AWARENESS.FOLLOW_UP_WORKLOAD_VISIBILITY]: {
    label: "Follow-up workload visibility",
    description: "Read-only visibility into unresolved follow-up task workload already present in current workflows.",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.FOLLOW_UP_WORKLOAD_SUMMARY],
    linkedReadinessConcern: OPERATIONAL_READINESS_EVALUATION.FOLLOW_UP_BACKLOG_CONCERN,
  },
  [OPERATIONAL_INTELLIGENCE_AWARENESS.UNRESOLVED_OPERATIONAL_CONCERN_VISIBILITY]: {
    label: "Unresolved operational concern visibility",
    description: "Read-only visibility into unresolved operational concerns across existing task, note, and event history.",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.UNRESOLVED_OPERATIONAL_WORKLOAD_SUMMARY],
    linkedReadinessConcern: OPERATIONAL_READINESS_EVALUATION.UNRESOLVED_OPERATIONAL_ISSUE_CONCERN,
  },
  [OPERATIONAL_INTELLIGENCE_AWARENESS.STAFFING_LOAD_VISIBILITY]: {
    label: "Staffing/load visibility",
    description: "Read-only visibility into assignment and staffing-load context from current roster/role change signals.",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.ASSIGNMENT_LOAD_VISIBILITY_SUMMARY],
    linkedReadinessConcern: OPERATIONAL_READINESS_EVALUATION.STAFFING_LOAD_VISIBILITY_CONCERN,
  },
  [OPERATIONAL_INTELLIGENCE_AWARENESS.ATTENDANCE_REVIEW_VISIBILITY]: {
    label: "Attendance review visibility",
    description: "Read-only visibility into attendance review context already identified in event and attendance workflows.",
    linkedClassifications: [OPERATIONAL_SUMMARY_CLASSIFICATION.ATTENDANCE_CONCERN_SUMMARY],
    linkedReadinessConcern: OPERATIONAL_READINESS_EVALUATION.ATTENDANCE_REVIEW_CONCERN,
  },
};

function getStatusLabel(status: OperationalReadinessEvaluationStatus) {
  if (status === OPERATIONAL_READINESS_EVALUATION_STATUS.NEEDS_REVIEW) {
    return "Needs review";
  }

  if (status === OPERATIONAL_READINESS_EVALUATION_STATUS.MONITOR) {
    return "Monitor";
  }

  return "Clear";
}

function collectClassificationCount(
  classifications: OperationalSummaryClassification[],
  linkedClassifications: OperationalSummaryClassificationType[],
) {
  return linkedClassifications.reduce((sum, classificationType) => {
    const classification = classifications.find((item) => item.classification === classificationType);
    return sum + (classification?.itemCount ?? 0);
  }, 0);
}

function buildAwarenessSummary(input: {
  matchedItemCount: number;
  statusLabel: string;
}) {
  return `${input.matchedItemCount} authorized summary item${input.matchedItemCount === 1 ? "" : "s"} currently mapped to this awareness area; readiness state: ${input.statusLabel.toLowerCase()}.`;
}

/**
 * Pure awareness transformation derived from already-authorized summary and
 * readiness metadata. Callers must enforce organization scoping and staff
 * authorization before invoking this helper.
 */
export function buildOperationalIntelligenceAwarenessView(input: {
  summaryView: OperationalSummaryClassificationView;
  readinessView: OperationalReadinessEvaluationView;
}): OperationalIntelligenceAwarenessView {
  const awarenessItems = AWARENESS_ORDER.map((awareness) => {
    const definition = AWARENESS_DEFINITIONS[awareness];
    const linkedReadiness = input.readinessView.evaluations.find(
      (evaluation): evaluation is OperationalReadinessEvaluation =>
        evaluation.concern === definition.linkedReadinessConcern,
    );
    const status = linkedReadiness?.status ?? OPERATIONAL_READINESS_EVALUATION_STATUS.CLEAR;
    const statusLabel = linkedReadiness?.statusLabel ?? getStatusLabel(status);
    const matchedItemCount = collectClassificationCount(
      input.summaryView.classifications,
      definition.linkedClassifications,
    );
    const href = linkedReadiness?.href ?? "/";

    return {
      awareness,
      label: definition.label,
      description: definition.description,
      summary: buildAwarenessSummary({
        matchedItemCount,
        statusLabel,
      }),
      status,
      statusLabel,
      matchedItemCount,
      linkedClassifications: definition.linkedClassifications,
      linkedReadinessConcern: definition.linkedReadinessConcern,
      href,
      internalOnly: true as const,
      informationalOnly: true as const,
      readOnly: true as const,
      aiDeferred: true as const,
      recommendationDeferred: true as const,
      automationDeferred: true as const,
      guardianIntelligenceDeferred: true as const,
    };
  });

  const countsByStatus = awarenessItems.reduce<Record<OperationalReadinessEvaluationStatus, number>>(
    (totals, item) => {
      totals[item.status] += 1;
      return totals;
    },
    {
      [OPERATIONAL_READINESS_EVALUATION_STATUS.CLEAR]: 0,
      [OPERATIONAL_READINESS_EVALUATION_STATUS.MONITOR]: 0,
      [OPERATIONAL_READINESS_EVALUATION_STATUS.NEEDS_REVIEW]: 0,
    },
  );

  return {
    awarenessItems,
    totalSourceItemCount: input.summaryView.totalSourceItemCount,
    totalMatchedItemCount: awarenessItems.reduce((sum, item) => sum + item.matchedItemCount, 0),
    countsByStatus,
    generatedAt: new Date(),
    internalOnly: true as const,
    informationalOnly: true as const,
    readOnly: true as const,
    aiDeferred: true as const,
    recommendationDeferred: true as const,
    automationDeferred: true as const,
    guardianIntelligenceDeferred: true as const,
    isInbox: false as const,
    isFeed: false as const,
    hasAutonomousBehavior: false as const,
  };
}

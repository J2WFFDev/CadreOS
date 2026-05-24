// Phase 13B — Operational Summary Classification Foundation
//
// Purpose:
//   Provide a lightweight, internal-only operational summary classification layer
//   derived from already-authorized operational history data.
//
// What this is NOT:
//   - Not AI-generated summary text.
//   - Not a recommendation engine.
//   - Not workflow automation.
//   - Not autonomous action-taking.
//   - Not guardian-facing intelligence behavior.
//   - Not Feed or Inbox runtime behavior.
//
// Deferred behavior:
//   - AI-generated summary behavior.
//   - Recommendation runtime behavior.
//   - Workflow automation / escalation.
//   - Guardian-facing intelligence surfaces.
//   - Feed / Inbox runtime behavior.

import {
  INTERNAL_NOTIFICATION_CANDIDATE_TYPE,
  type InternalNotificationCandidateType,
} from "@/lib/communication-classification";
import { type OperationalHistoryItem } from "@/lib/operational-history";

export const OPERATIONAL_SUMMARY_CLASSIFICATION = {
  READINESS_SUMMARY_CANDIDATE: "readiness_summary_candidate",
  ATTENDANCE_CONCERN_SUMMARY: "attendance_concern_summary",
  UNRESOLVED_OPERATIONAL_WORKLOAD_SUMMARY: "unresolved_operational_workload_summary",
  FOLLOW_UP_WORKLOAD_SUMMARY: "follow_up_workload_summary",
  ASSIGNMENT_LOAD_VISIBILITY_SUMMARY: "assignment_load_visibility_summary",
} as const;

export type OperationalSummaryClassificationType =
  (typeof OPERATIONAL_SUMMARY_CLASSIFICATION)[keyof typeof OPERATIONAL_SUMMARY_CLASSIFICATION];

export type OperationalSummaryClassification = {
  classification: OperationalSummaryClassificationType;
  label: string;
  description: string;
  ruleSummary: string;
  href: string;
  itemCount: number;
  sourceKinds: OperationalHistoryItem["kind"][];
  candidateTypes: InternalNotificationCandidateType[];
  internalOnly: true;
  informationalOnly: true;
  aiDeferred: true;
  recommendationDeferred: true;
  automationDeferred: true;
  guardianIntelligenceDeferred: true;
};

export type OperationalSummaryClassificationView = {
  classifications: OperationalSummaryClassification[];
  totalSourceItemCount: number;
  totalMatchedItemCount: number;
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

type ClassificationDefinition = {
  label: string;
  description: string;
  ruleSummary: string;
  href: string;
  matches: (item: OperationalHistoryItem) => boolean;
};

const CLASSIFICATION_ORDER: OperationalSummaryClassificationType[] = [
  OPERATIONAL_SUMMARY_CLASSIFICATION.READINESS_SUMMARY_CANDIDATE,
  OPERATIONAL_SUMMARY_CLASSIFICATION.ATTENDANCE_CONCERN_SUMMARY,
  OPERATIONAL_SUMMARY_CLASSIFICATION.UNRESOLVED_OPERATIONAL_WORKLOAD_SUMMARY,
  OPERATIONAL_SUMMARY_CLASSIFICATION.FOLLOW_UP_WORKLOAD_SUMMARY,
  OPERATIONAL_SUMMARY_CLASSIFICATION.ASSIGNMENT_LOAD_VISIBILITY_SUMMARY,
];

const CLASSIFICATION_DEFINITIONS: Record<OperationalSummaryClassificationType, ClassificationDefinition> = {
  [OPERATIONAL_SUMMARY_CLASSIFICATION.READINESS_SUMMARY_CANDIDATE]: {
    label: "Readiness summary candidate",
    description: "Highlights authorized operational history already marked as readiness-impacting context.",
    ruleSummary: "Counts event-linked items already carrying readiness concern metadata; informational only.",
    href: "/events?operationalIndicator=upcoming_operational_concern",
    matches: (item) =>
      item.notificationCandidateEvaluation.candidateType === INTERNAL_NOTIFICATION_CANDIDATE_TYPE.READINESS_CONCERN,
  },
  [OPERATIONAL_SUMMARY_CLASSIFICATION.ATTENDANCE_CONCERN_SUMMARY]: {
    label: "Attendance concern summary",
    description: "Groups attendance-linked concern items from current attendance capture workflows.",
    ruleSummary: "Counts authorized attendance history items already flagged for review; no recommendation behavior.",
    href: "/events?operationalIndicator=attendance_not_reviewed_recently",
    matches: (item) =>
      item.notificationCandidateEvaluation.candidateType === INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ATTENDANCE_REVIEW,
  },
  [OPERATIONAL_SUMMARY_CLASSIFICATION.UNRESOLVED_OPERATIONAL_WORKLOAD_SUMMARY]: {
    label: "Unresolved operational workload summary",
    description: "Surfaces unresolved workload already present across task, note, and event workflows.",
    ruleSummary: "Counts authorized unresolved task, note, and event history items without inferring severity or action.",
    href: "/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved",
    matches: (item) =>
      Boolean(item.unresolvedLabel) && ["task", "note", "event"].includes(item.kind),
  },
  [OPERATIONAL_SUMMARY_CLASSIFICATION.FOLLOW_UP_WORKLOAD_SUMMARY]: {
    label: "Follow-up workload summary",
    description: "Tracks current follow-up task workload from existing unresolved follow-up records.",
    ruleSummary: "Counts authorized unresolved follow-up task items only; no automated assignment or reminder behavior.",
    href: "/tasks?resolution=unresolved",
    matches: (item) => item.kind === "task" && Boolean(item.unresolvedLabel),
  },
  [OPERATIONAL_SUMMARY_CLASSIFICATION.ASSIGNMENT_LOAD_VISIBILITY_SUMMARY]: {
    label: "Assignment/load visibility summary",
    description: "Provides visibility into recent roster and assignment updates that may affect workload coverage.",
    ruleSummary: "Counts authorized roster and assignment history items already classified as assignment/update awareness.",
    href: "/teams?readiness=needs_attention",
    matches: (item) =>
      item.notificationCandidateEvaluation.candidateType ===
      INTERNAL_NOTIFICATION_CANDIDATE_TYPE.ASSIGNMENT_UPDATE_AWARENESS,
  },
};

/**
 * Pure transformation over already-authorized operational history items.
 * Callers must apply organization scoping and staff authorization before
 * invoking this helper.
 */
export function buildOperationalSummaryClassificationView(
  items: OperationalHistoryItem[],
): OperationalSummaryClassificationView {
  const dedupedItems = Array.from(new Map(items.map((item) => [item.id, item])).values());

  const classifications = CLASSIFICATION_ORDER.map((classification) => {
    const definition = CLASSIFICATION_DEFINITIONS[classification];
    const matchedItems = dedupedItems.filter(definition.matches);

    return {
      classification,
      label: definition.label,
      description: definition.description,
      ruleSummary: definition.ruleSummary,
      href: definition.href,
      itemCount: matchedItems.length,
      sourceKinds: Array.from(new Set(matchedItems.map((item) => item.kind))),
      candidateTypes: Array.from(
        new Set(
          matchedItems.flatMap((item) =>
            item.notificationCandidateEvaluation.candidateType
              ? [item.notificationCandidateEvaluation.candidateType]
              : [],
          ),
        ),
      ),
      internalOnly: true as const,
      informationalOnly: true as const,
      aiDeferred: true as const,
      recommendationDeferred: true as const,
      automationDeferred: true as const,
      guardianIntelligenceDeferred: true as const,
    };
  });

  return {
    classifications,
    totalSourceItemCount: dedupedItems.length,
    totalMatchedItemCount: classifications.reduce((sum, classification) => sum + classification.itemCount, 0),
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

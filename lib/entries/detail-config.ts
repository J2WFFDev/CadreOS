import { EntryType } from "@prisma/client";

export type EntryDetailConfig = {
  summaryHeading: string;
  emptySummary: string;
  titleLabel: string;
  contentLabel: string;
  contentHint: string | null;
  statusLabel: string;
  priorityLabel: string;
  metadataDateLabel: string | null;
  dateFieldLabel: string | null;
  guidance: string | null;
};

const DEFAULT_ENTRY_DETAIL_CONFIG: EntryDetailConfig = {
  summaryHeading: "Summary",
  emptySummary: "No details captured yet.",
  titleLabel: "Title",
  contentLabel: "Content",
  contentHint: null,
  statusLabel: "Status",
  priorityLabel: "Priority",
  metadataDateLabel: "Date",
  dateFieldLabel: null,
  guidance: null,
};

export function getEntryDetailConfig(type: EntryType): EntryDetailConfig {
  if (type === EntryType.DECISION) {
    return {
      summaryHeading: "Decision Overview",
      emptySummary: "No decision context or rationale recorded yet.",
      titleLabel: "Decision statement",
      contentLabel: "Context / Rationale",
      contentHint: "Record the context, rationale, and decision notes here.",
      statusLabel: "Decision status",
      priorityLabel: "Priority",
      metadataDateLabel: "Effective date",
      dateFieldLabel: "Effective / Decision Date",
      guidance: "Capture the decision statement, context, rationale, status, and any linked scope on this entry.",
    };
  }

  if (type === EntryType.TASK || type === EntryType.FOLLOW_UP) {
    return {
      ...DEFAULT_ENTRY_DETAIL_CONFIG,
      metadataDateLabel: "Due",
      dateFieldLabel: "Due date",
    };
  }

  return DEFAULT_ENTRY_DETAIL_CONFIG;
}

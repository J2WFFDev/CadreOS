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
      metadataDateLabel: null,
      dateFieldLabel: null,
      guidance: "Capture the structured decision statement, context, ownership, and maturity outcome details on this entry.",
    };
  }

  if (type === EntryType.EVENT) {
    return {
      summaryHeading: "Event details",
      emptySummary: "No event details captured yet.",
      titleLabel: "Event title",
      contentLabel: "Event description / details",
      contentHint: "Capture logistics, prep, outcomes, and event notes.",
      statusLabel: "Event status",
      priorityLabel: "Priority",
      metadataDateLabel: "Start",
      dateFieldLabel: null,
      guidance: "Capture event scheduling metadata, calendar scope, and recurrence details for this entry.",
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

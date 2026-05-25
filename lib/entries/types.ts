export const ENTRY_TYPES = ["TASK", "NOTE", "EVENT", "DECISION", "JOURNAL", "HABIT", "OBSERVATION"] as const;

export type EntryTypeValue = (typeof ENTRY_TYPES)[number];

export type EntryPriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type EntryStatusValue = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "ARCHIVED";

export type EntryVisibilityValue = "STAFF_ONLY" | "TEAM_STAFF" | "ORGANIZATION_SCOPED";

export type EntryQuickAddParseResult = {
  inferredType: "TASK" | "NOTE";
  title: string;
  content: string;
  tags: string[];
  priority: EntryPriorityValue;
  dueDate: Date | null;
  dueTime: string | null;
  recurrenceRule: string | null;
  assigneeHandle: string | null;
};

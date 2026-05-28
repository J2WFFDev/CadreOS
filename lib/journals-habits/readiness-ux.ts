import { HabitStatus } from "@prisma/client";

export type PromptAssignmentDueState = "overdue" | "due_soon" | "open" | "closed";

export function classifyHabitOperationalReadiness(
  status: HabitStatus,
  completionCount: number,
): string {
  if (status === HabitStatus.ARCHIVED) return "Archived";
  if (status === HabitStatus.PAUSED) return "Paused";
  if (completionCount <= 0) return "Needs first check-in";
  return "On track";
}

export function labelForPromptAssignmentReadiness(state: PromptAssignmentDueState): string {
  if (state === "overdue") return "At risk";
  if (state === "due_soon") return "Due soon";
  if (state === "closed") return "Complete";
  return "On track";
}

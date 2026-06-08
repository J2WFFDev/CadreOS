export type HabitAccessFailureCode =
  | "HABIT_NOT_FOUND"
  | "HABIT_VISIBILITY_DENIED"
  | "HABIT_CHECK_IN_DENIED"
  | "HABIT_ARCHIVE_DENIED"
  | "HABIT_RESTORE_DENIED"
  | "HABIT_COMPLETE_DENIED"
  | "HABIT_PAUSE_DENIED";

export function habitAccessErrorMessage(code: string | null): string | null {
  if (code === "HABIT_NOT_FOUND" || code === "HABIT_VISIBILITY_DENIED") {
    return "This habit could not be found or you do not have access to it.";
  }
  if (code === "HABIT_CHECK_IN_DENIED") {
    return "You can view this habit, but you do not have permission to record a check-in.";
  }
  if (code === "HABIT_ARCHIVE_DENIED") {
    return "You can view this habit, but you do not have permission to archive it.";
  }
  if (code === "HABIT_RESTORE_DENIED") {
    return "You can view this habit, but you do not have permission to restore it.";
  }
  if (code === "HABIT_COMPLETE_DENIED") {
    return "You can view this habit, but you do not have permission to complete it.";
  }
  if (code === "HABIT_PAUSE_DENIED") {
    return "You can view this habit, but you do not have permission to pause or resume it.";
  }
  return null;
}

export function logHabitAccessFailure(input: {
  workflow: string;
  habitId: string;
  organizationId: string;
  actorPersonId: string | null;
  reasonCode: HabitAccessFailureCode;
}): void {
  console.warn("[habit.access]", input);
}

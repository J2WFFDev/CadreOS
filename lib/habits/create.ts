import { HabitFrequency, HabitTrackingMode } from "@prisma/client";

import {
  MAX_HABIT_DESCRIPTION_LENGTH,
  MAX_HABIT_TITLE_LENGTH,
  normalizeHabitScheduleDays,
  normalizeCompletedOn,
  normalizeTrackingMode,
} from "@/lib/habits/policy";

export type HabitCreateFormInput = {
  title: string;
  description: string | null;
  athletePersonId: string;
  assignedToTeamId: string | null;
  frequency: HabitFrequency | null;
  interval: number | null;
  daysOfWeek: string | null;
  startDate: Date | null;
  endDate: Date | null;
  trackingMode: HabitTrackingMode;
  targetCount: number | null;
  targetUnit: string | null;
};

export function normalizeHabitFrequency(raw: string): HabitFrequency | null {
  if (raw === "DAILY") return HabitFrequency.DAILY;
  if (raw === "WEEKLY") return HabitFrequency.WEEKLY;
  if (raw === "CUSTOM") return HabitFrequency.CUSTOM;
  return null;
}

function parseOptionalDate(raw: string): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInt(raw: string): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeHabitCreateFormInput(formData: FormData): HabitCreateFormInput {
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_HABIT_TITLE_LENGTH);
  const description =
    String(formData.get("description") ?? "")
      .trim()
      .slice(0, MAX_HABIT_DESCRIPTION_LENGTH) || null;
  const athletePersonId = String(formData.get("athletePersonId") ?? "").trim();
  const assignedToTeamId = String(formData.get("assignedToTeamId") ?? "").trim() || null;
  const frequency = normalizeHabitFrequency(String(formData.get("frequency") ?? "").trim());
  const daysOfWeek = normalizeHabitScheduleDays(String(formData.get("daysOfWeek") ?? ""));
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const trackingMode = normalizeTrackingMode(String(formData.get("trackingMode") ?? "").trim());
  const targetCount = parsePositiveInt(String(formData.get("targetCount") ?? "").trim());
  const targetUnit = String(formData.get("targetUnit") ?? "").trim() || null;
  const interval = parsePositiveInt(String(formData.get("interval") ?? "").trim());

  const startDate = parseOptionalDate(startDateRaw);
  const endDate = parseOptionalDate(endDateRaw);

  return {
    title,
    description,
    athletePersonId,
    assignedToTeamId,
    frequency,
    interval: frequency ? (interval ?? 1) : null,
    daysOfWeek,
    startDate: frequency ? (startDate ?? normalizeCompletedOn(new Date())) : null,
    endDate,
    trackingMode,
    targetCount: trackingMode === HabitTrackingMode.COUNT ? targetCount : null,
    targetUnit: trackingMode === HabitTrackingMode.COUNT ? targetUnit : null,
  };
}

export function getHabitCreateValidationError(input: HabitCreateFormInput): "missing_title" | "missing_athlete" | null {
  if (!input.title) return "missing_title";
  if (!input.athletePersonId) return "missing_athlete";
  return null;
}

export function buildHabitCreateData(input: HabitCreateFormInput, scope: { organizationId: string; actorPersonId: string }) {
  return {
    organizationId: scope.organizationId,
    title: input.title,
    description: input.description,
    athletePersonId: input.athletePersonId,
    assignedToTeamId: input.assignedToTeamId,
    createdByPersonId: scope.actorPersonId,
    trackingMode: input.trackingMode,
    targetCount: input.targetCount,
    targetUnit: input.targetUnit,
    ...(input.frequency && input.startDate
      ? {
          schedules: {
            create: {
              frequency: input.frequency,
              interval: input.interval,
              daysOfWeek: input.daysOfWeek,
              startDate: normalizeCompletedOn(input.startDate),
              endDate: input.endDate ? normalizeCompletedOn(input.endDate) : null,
            },
          },
        }
      : {}),
  };
}

export async function createHabitActivitySafely(input: {
  createActivity: (args: {
    organizationId: string;
    habitId: string;
    actorPersonId: string;
  }) => Promise<unknown>;
  organizationId: string;
  habitId: string;
  actorPersonId: string | null;
  logError: (error: unknown) => void;
}): Promise<boolean> {
  if (!input.organizationId || !input.habitId || !input.actorPersonId) return false;
  try {
    await input.createActivity({
      organizationId: input.organizationId,
      habitId: input.habitId,
      actorPersonId: input.actorPersonId,
    });
    return true;
  } catch (error) {
    input.logError(error);
    return false;
  }
}

export function getHabitCreateErrorMessage(code: string | null): string | null {
  if (code === "missing_title") return "Habit title is required.";
  if (code === "missing_athlete") return "Select an athlete before creating a habit.";
  if (code === "schema_unavailable") return "Habit create is unavailable because required Habit schema is missing. Run the latest migrations and retry.";
  if (code === "create_failed") return "Unable to create habit right now. Please retry.";
  return null;
}

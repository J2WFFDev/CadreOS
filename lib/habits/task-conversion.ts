import { HabitFrequency, HabitTrackingMode } from "@prisma/client";

import { normalizeCompletedOn } from "@/lib/habits/policy";

export type TaskToHabitSource = {
  title: string;
  content: string | null;
  assignedToPersonId: string | null;
  createdByPersonId: string | null;
  teamId: string | null;
  taskRecurrenceRule: string | null;
};

export function resolveTaskToHabitAthletePersonId(input: {
  assignedToPersonId: string | null;
  createdByPersonId: string | null;
  actorPersonId: string;
}): string {
  return input.assignedToPersonId ?? input.createdByPersonId ?? input.actorPersonId;
}

export function resolveTaskToHabitSchedule(input: {
  taskRecurrenceRule: string | null;
  dueDate: Date | null;
  now?: Date;
}): {
  frequency: HabitFrequency;
  interval: number;
  daysOfWeek: string | null;
  startDate: Date;
  endDate: Date | null;
} | null {
  const rule = input.taskRecurrenceRule?.trim().toUpperCase() ?? "";
  const frequency =
    rule === "FREQ=DAILY"
      ? HabitFrequency.DAILY
      : rule === "FREQ=WEEKLY"
        ? HabitFrequency.WEEKLY
        : null;

  if (!frequency) return null;

  return {
    frequency,
    interval: 1,
    daysOfWeek: null,
    startDate: normalizeCompletedOn(input.dueDate ?? input.now ?? new Date()),
    endDate: null,
  };
}

export function buildTaskToHabitCreateData(
  source: TaskToHabitSource,
  scope: {
    organizationId: string;
    actorPersonId: string;
  },
  options?: {
    dueDate?: Date | null;
    now?: Date;
  },
) {
  const athletePersonId = resolveTaskToHabitAthletePersonId({
    assignedToPersonId: source.assignedToPersonId,
    createdByPersonId: source.createdByPersonId,
    actorPersonId: scope.actorPersonId,
  });
  const schedule = resolveTaskToHabitSchedule({
    taskRecurrenceRule: source.taskRecurrenceRule,
    dueDate: options?.dueDate ?? null,
    now: options?.now,
  });

  return {
    organizationId: scope.organizationId,
    title: source.title,
    description: source.content,
    athletePersonId,
    assignedToTeamId: source.teamId,
    createdByPersonId: source.createdByPersonId ?? scope.actorPersonId,
    trackingMode: HabitTrackingMode.CHECKOFF,
    targetCount: null,
    targetUnit: null,
    ...(schedule
      ? {
          schedules: {
            create: schedule,
          },
        }
      : {}),
  };
}

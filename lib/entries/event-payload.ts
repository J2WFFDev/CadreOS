export const EVENT_TYPE_VALUES = [
  "PRACTICE",
  "MATCH",
  "MEETING",
  "TRAINING",
  "FUNDRAISER",
  "VOLUNTEER_EVENT",
  "MAINTENANCE",
  "OTHER",
] as const;
export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];

export const EVENT_CALENDAR_SCOPE_VALUES = ["PERSONAL", "ORGANIZATION", "PROGRAM", "TEAM"] as const;
export type EventCalendarScopeValue = (typeof EVENT_CALENDAR_SCOPE_VALUES)[number];

export const EVENT_RECURRENCE_FREQUENCY_VALUES = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as const;
export type EventRecurrenceFrequencyValue = (typeof EVENT_RECURRENCE_FREQUENCY_VALUES)[number];

export const EVENT_RECURRENCE_END_VALUES = ["NEVER", "ON_DATE", "AFTER_OCCURRENCES"] as const;
export type EventRecurrenceEndValue = (typeof EVENT_RECURRENCE_END_VALUES)[number];

export type EventEntryRecurrence = {
  frequency: EventRecurrenceFrequencyValue;
  interval: number | null;
  customRule: string;
  endCondition: EventRecurrenceEndValue;
  endDate: string | null;
  occurrenceCount: number | null;
};

export type EventEntryPayload = {
  eventType: EventTypeValue;
  startDateTimeLocal: string | null;
  endDateTimeLocal: string | null;
  timezone: string;
  location: string;
  calendarScope: EventCalendarScopeValue;
  programId: string | null;
  teamId: string | null;
  recurrence: EventEntryRecurrence;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function createEmptyEventEntryPayload(): EventEntryPayload {
  return {
    eventType: "OTHER",
    startDateTimeLocal: null,
    endDateTimeLocal: null,
    timezone: "UTC",
    location: "",
    calendarScope: "PERSONAL",
    programId: null,
    teamId: null,
    recurrence: {
      frequency: "NONE",
      interval: null,
      customRule: "",
      endCondition: "NEVER",
      endDate: null,
      occurrenceCount: null,
    },
  };
}

export function parseEventEntryPayload(payloadJson: string | null | undefined): EventEntryPayload {
  if (!payloadJson) return createEmptyEventEntryPayload();

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return createEmptyEventEntryPayload();

    const recurrenceInput =
      parsed.recurrence && typeof parsed.recurrence === "object" && !Array.isArray(parsed.recurrence)
        ? (parsed.recurrence as Record<string, unknown>)
        : {};

    return {
      eventType: normalizeEventType(asOptionalString(parsed.eventType)) ?? "OTHER",
      startDateTimeLocal: normalizeDateTimeLocal(asOptionalString(parsed.startDateTimeLocal)),
      endDateTimeLocal: normalizeDateTimeLocal(asOptionalString(parsed.endDateTimeLocal)),
      timezone: normalizeTimezone(asOptionalString(parsed.timezone)) ?? "UTC",
      location: asOptionalString(parsed.location),
      calendarScope: normalizeEventCalendarScope(asOptionalString(parsed.calendarScope)) ?? "PERSONAL",
      programId: normalizeOptionalId(parsed.programId),
      teamId: normalizeOptionalId(parsed.teamId),
      recurrence: {
        frequency: normalizeEventRecurrenceFrequency(asOptionalString(recurrenceInput.frequency)) ?? "NONE",
        interval: normalizePositiveInteger(recurrenceInput.interval),
        customRule: asOptionalString(recurrenceInput.customRule),
        endCondition: normalizeEventRecurrenceEnd(asOptionalString(recurrenceInput.endCondition)) ?? "NEVER",
        endDate: normalizeDateOnly(asOptionalString(recurrenceInput.endDate)),
        occurrenceCount: normalizePositiveInteger(recurrenceInput.occurrenceCount),
      },
    };
  } catch {
    return createEmptyEventEntryPayload();
  }
}

export function serializeEventEntryPayload(payload: EventEntryPayload) {
  return JSON.stringify(payload);
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateTimeLocal(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATETIME_LOCAL_PATTERN.test(trimmed) ? trimmed : null;
}

export function normalizeDateOnly(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeEventType(value: string | null | undefined): EventTypeValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return EVENT_TYPE_VALUES.includes(normalized as EventTypeValue) ? (normalized as EventTypeValue) : null;
}

export function normalizeEventCalendarScope(value: string | null | undefined): EventCalendarScopeValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return EVENT_CALENDAR_SCOPE_VALUES.includes(normalized as EventCalendarScopeValue) ? (normalized as EventCalendarScopeValue) : null;
}

export function normalizeEventRecurrenceFrequency(value: string | null | undefined): EventRecurrenceFrequencyValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return EVENT_RECURRENCE_FREQUENCY_VALUES.includes(normalized as EventRecurrenceFrequencyValue)
    ? (normalized as EventRecurrenceFrequencyValue)
    : null;
}

export function normalizeEventRecurrenceEnd(value: string | null | undefined): EventRecurrenceEndValue | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return EVENT_RECURRENCE_END_VALUES.includes(normalized as EventRecurrenceEndValue) ? (normalized as EventRecurrenceEndValue) : null;
}

function normalizeTimezone(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

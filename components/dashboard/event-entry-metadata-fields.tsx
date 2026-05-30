"use client";

import { useMemo, useState } from "react";

import { formatEnumLabel } from "@/lib/follow-up-tasks";
import {
  EVENT_CALENDAR_SCOPE_VALUES,
  EVENT_RECURRENCE_END_VALUES,
  EVENT_RECURRENCE_FREQUENCY_VALUES,
  EVENT_TIMEZONE_VALUES,
  EVENT_TYPE_VALUES,
  type EventCalendarScopeValue,
  type EventEntryPayload,
  type EventRecurrenceEndValue,
} from "@/lib/entries/event-payload";

type EventEntryMetadataFieldsProps = {
  payload: EventEntryPayload;
  programs: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; programId: string }>;
  timezoneDefault: string;
};

const SCOPE_HELP_TEXT: Record<EventCalendarScopeValue, string> = {
  PERSONAL: "Personal scope applies to your calendar only.",
  ORGANIZATION: "Organization scope applies to the organization calendar.",
  PROGRAM: "Program scope applies to a selected program calendar.",
  TEAM: "Team scope applies to a selected team calendar.",
};

export function EventEntryMetadataFields({ payload, programs, teams, timezoneDefault }: EventEntryMetadataFieldsProps) {
  const [calendarScope, setCalendarScope] = useState<EventCalendarScopeValue>(payload.calendarScope);
  const [endCondition, setEndCondition] = useState<EventRecurrenceEndValue>(payload.recurrence.endCondition);
  const [timezone, setTimezone] = useState<string>(payload.timezone || timezoneDefault);

  const timezoneOptions = useMemo(() => {
    const next = new Set<string>(EVENT_TIMEZONE_VALUES);
    next.add(timezoneDefault);
    if (timezone) next.add(timezone);
    return Array.from(next);
  }, [timezone, timezoneDefault]);

  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-semibold">Event metadata</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="eventType" className="text-sm font-medium">
            Event type
          </label>
          <select id="eventType" name="eventType" defaultValue={payload.eventType} className="w-full rounded-md border px-3 py-2 text-sm">
            {EVENT_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="eventTimezone" className="text-sm font-medium">
            Timezone
          </label>
          <select
            id="eventTimezone"
            name="eventTimezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {timezoneOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="eventStartDateTime" className="text-sm font-medium">
            Start date/time
          </label>
          <input
            id="eventStartDateTime"
            name="eventStartDateTime"
            type="datetime-local"
            defaultValue={payload.startDateTimeLocal ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="eventEndDateTime" className="text-sm font-medium">
            End date/time
          </label>
          <input
            id="eventEndDateTime"
            name="eventEndDateTime"
            type="datetime-local"
            defaultValue={payload.endDateTimeLocal ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="eventLocation" className="text-sm font-medium">
          Location
        </label>
        <input id="eventLocation" name="eventLocation" defaultValue={payload.location} className="w-full rounded-md border px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="eventCalendarScope" className="text-sm font-medium">
          Calendar scope
        </label>
        <select
          id="eventCalendarScope"
          name="eventCalendarScope"
          value={calendarScope}
          onChange={(event) => setCalendarScope(event.target.value as EventCalendarScopeValue)}
          className="w-full rounded-md border px-3 py-2 text-sm sm:w-[32rem]"
        >
          {EVENT_CALENDAR_SCOPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {value === "PERSONAL"
                ? "Personal — appears on your calendar"
                : value === "ORGANIZATION"
                  ? "Organization — appears on the organization calendar"
                  : value === "PROGRAM"
                    ? "Program — appears on a selected program calendar"
                    : "Team — appears on a selected team calendar"}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{SCOPE_HELP_TEXT[calendarScope]}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Member/group assignment, invitations, and RSVP workflows are future scope.
        </p>
      </div>
      {calendarScope === "PROGRAM" ? (
        <div className="space-y-1">
          <label htmlFor="eventProgramId" className="text-sm font-medium">
            Program (required for Program scope)
          </label>
          <select
            id="eventProgramId"
            name="eventProgramId"
            required
            defaultValue={payload.programId ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm sm:w-96"
          >
            <option value="">— Select program —</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {calendarScope === "TEAM" ? (
        <div className="space-y-1">
          <label htmlFor="eventTeamId" className="text-sm font-medium">
            Team (required for Team scope)
          </label>
          <select id="eventTeamId" name="eventTeamId" required defaultValue={payload.teamId ?? ""} className="w-full rounded-md border px-3 py-2 text-sm sm:w-96">
            <option value="">— Select team —</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-semibold">Recurrence</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="eventRecurrenceFrequency" className="text-sm font-medium">
              Repeat
            </label>
            <select
              id="eventRecurrenceFrequency"
              name="eventRecurrenceFrequency"
              defaultValue={payload.recurrence.frequency}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {EVENT_RECURRENCE_FREQUENCY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value === "NONE" ? "Does not repeat" : formatEnumLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="eventRecurrenceInterval" className="text-sm font-medium">
              Interval
            </label>
            <input
              id="eventRecurrenceInterval"
              name="eventRecurrenceInterval"
              type="number"
              min={1}
              defaultValue={payload.recurrence.interval?.toString() ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="eventRecurrenceCustomRule" className="text-sm font-medium">
            Custom/simple rule
          </label>
          <input
            id="eventRecurrenceCustomRule"
            name="eventRecurrenceCustomRule"
            defaultValue={payload.recurrence.customRule}
            placeholder="Optional simple recurrence note"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Recurrence end</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {EVENT_RECURRENCE_END_VALUES.map((value) => (
              <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="eventRecurrenceEndCondition"
                  value={value}
                  checked={endCondition === value}
                  onChange={() => setEndCondition(value)}
                />
                <span>{value === "ON_DATE" ? "On date" : value === "AFTER_OCCURRENCES" ? "After N occurrences" : "Never"}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="eventRecurrenceEndDate" className="text-sm font-medium">
              End date
            </label>
            <input
              id="eventRecurrenceEndDate"
              name="eventRecurrenceEndDate"
              type="date"
              required={endCondition === "ON_DATE"}
              disabled={endCondition !== "ON_DATE"}
              defaultValue={payload.recurrence.endDate ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="eventRecurrenceOccurrenceCount" className="text-sm font-medium">
              Occurrences
            </label>
            <input
              id="eventRecurrenceOccurrenceCount"
              name="eventRecurrenceOccurrenceCount"
              type="number"
              min={1}
              required={endCondition === "AFTER_OCCURRENCES"}
              disabled={endCondition !== "AFTER_OCCURRENCES"}
              defaultValue={payload.recurrence.occurrenceCount?.toString() ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
            />
          </div>
        </div>
      </fieldset>
    </fieldset>
  );
}

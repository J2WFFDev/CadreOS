import Link from "next/link";
import { AttendanceStatus, RSVPStatus } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { db } from "@/lib/db";
import {
  compareFollowUpTasks,
  formatDateTime,
  formatEnumLabel,
  getTaskStatusBadgeClassName,
  isTaskOverdue,
} from "@/lib/follow-up-tasks";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function EventDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query event details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let event:
    | {
        id: string;
        title: string;
        eventType: string;
        status: string;
        startsAt: Date;
        endsAt: Date | null;
        location: string | null;
        program: { id: string; name: string };
        team: { id: string; name: string; roster: Array<{ personId: string }> } | null;
        createdBy: { id: string; firstName: string; lastName: string } | null;
        tasks: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          assignee: { id: string; firstName: string; lastName: string };
          sourceNote: { id: string; body: string } | null;
        }>;
        rsvps: Array<{
          id: string;
          status: RSVPStatus;
          reason: string | null;
          respondedAt: Date;
          person: { id: string; firstName: string; lastName: string };
        }>;
        attendance: Array<{
          id: string;
          status: AttendanceStatus;
          reasonCode: string | null;
          markedAt: Date;
          person: { id: string; firstName: string; lastName: string };
          markedBy: { id: string; firstName: string; lastName: string } | null;
        }>;
      }
    | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];
  let queryErrorMessage = "Unable to load event details right now. Please try again later.";

  try {
    [event, people] = await Promise.all([
      db.event.findFirst({
        where: {
          id: eventId,
          organizationId: scope.organizationId,
        },
        include: {
          program: { select: { id: true, name: true } },
          team: {
            select: {
              id: true,
              name: true,
              roster: {
                select: {
                  personId: true,
                },
              },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              dueAt: true,
              assignee: { select: { id: true, firstName: true, lastName: true } },
              sourceNote: { select: { id: true, body: true } },
            },
          },
          rsvps: {
            select: {
              id: true,
              status: true,
              reason: true,
              respondedAt: true,
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: [{ respondedAt: "desc" }],
          },
          attendance: {
            select: {
              id: true,
              status: true,
              reasonCode: true,
              markedAt: true,
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              markedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: [{ markedAt: "desc" }],
          },
        },
      }),
      db.person.findMany({
        where: {
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage =
        "Database schema is not available yet. Run database setup before loading RSVP and attendance details.";
    }
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {queryErrorMessage}
          </p>
        </div>
      </section>
    );
  }

  if (!event) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Event not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const rsvpPersonId = readSearchParam(resolvedSearchParams, "rsvpPersonId");
  const rawRsvpStatus = readSearchParam(resolvedSearchParams, "rsvpStatus");
  const rsvpStatus = Object.values(RSVPStatus).includes(rawRsvpStatus as RSVPStatus)
    ? (rawRsvpStatus as RSVPStatus)
    : RSVPStatus.MAYBE;
  const rsvpReason = readSearchParam(resolvedSearchParams, "rsvpReason");
  const rsvpError = readSearchParam(resolvedSearchParams, "rsvpError");
  const attendancePersonId = readSearchParam(resolvedSearchParams, "attendancePersonId");
  const rawAttendanceStatus = readSearchParam(resolvedSearchParams, "attendanceStatus");
  const attendanceStatus = Object.values(AttendanceStatus).includes(rawAttendanceStatus as AttendanceStatus)
    ? (rawAttendanceStatus as AttendanceStatus)
    : AttendanceStatus.PRESENT;
  const attendanceReasonCode = readSearchParam(resolvedSearchParams, "attendanceReasonCode");
  const attendanceError = readSearchParam(resolvedSearchParams, "attendanceError");
  const rosterPersonIds = new Set(event.team?.roster.map((membership) => membership.personId) ?? []);
  const eventTasks = [...event.tasks].sort(compareFollowUpTasks);
  const attendancePeople = [...people].sort((a, b) => {
    const rosterWeightA = rosterPersonIds.has(a.id) ? 0 : 1;
    const rosterWeightB = rosterPersonIds.has(b.id) ? 0 : 1;

    if (rosterWeightA !== rosterWeightB) {
      return rosterWeightA - rosterWeightB;
    }

    const lastNameComparison = a.lastName.localeCompare(b.lastName);

    if (lastNameComparison !== 0) {
      return lastNameComparison;
    }

    return a.firstName.localeCompare(b.firstName);
  });

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/events" label="Events" />
        <h2 className="text-2xl font-semibold tracking-tight">{event.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/events/${event.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit event
          </Link>
          <Link
            href={`/tasks/new?sourceEventId=${event.id}`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Create follow-up task
          </Link>
          <Link
            href={`/notes/new?eventId=${event.id}`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Add note
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Event type</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(event.eventType)}</dd>
          </div>
          <div>
            <dt className="font-medium">Status</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(event.status)}</dd>
          </div>
          <div>
            <dt className="font-medium">Program</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{event.program.name}</dd>
          </div>
          <div>
            <dt className="font-medium">Team</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{event.team?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Starts</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(event.startsAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Ends</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(event.endsAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Location</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{event.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Created by</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {event.createdBy ? `${event.createdBy.firstName} ${event.createdBy.lastName}` : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Related tasks</h3>
          <Link href={`/tasks/new?sourceEventId=${event.id}`} className="text-sm underline">
            Create follow-up task
          </Link>
        </div>
        {eventTasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No follow-up tasks are linked to this event yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {eventTasks.map((task) => (
              <li key={task.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/tasks/${task.id}`} className="font-medium underline">
                    {task.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(task.status)}`}
                  >
                    {formatEnumLabel(task.status)}
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm ${
                    isTaskOverdue(task) ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Assignee:{" "}
                  <Link href={`/people/${task.assignee.id}`} className="underline">
                    {task.assignee.firstName} {task.assignee.lastName}
                  </Link>
                  {" · "}Due: {formatDateTime(task.dueAt)}
                  {isTaskOverdue(task) ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      Overdue
                    </span>
                  ) : null}
                </p>
                {task.sourceNote ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Note:{" "}
                    <Link href={`/notes/${task.sourceNote.id}`} className="underline">
                      {task.sourceNote.body.length > 90 ? `${task.sourceNote.body.slice(0, 90)}…` : task.sourceNote.body}
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">RSVPs (Intent / Availability)</h3>
        {event.rsvps.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No RSVPs have been submitted for this event yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
              <thead>
                <tr className="text-left text-zinc-600 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Person</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 font-medium">Responded at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {event.rsvps.map((rsvp) => (
                  <tr key={rsvp.id}>
                    <td className="py-2 pr-4">{rsvp.person.firstName} {rsvp.person.lastName}</td>
                    <td className="py-2 pr-4">{formatEnumLabel(rsvp.status)}</td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{rsvp.reason ?? "—"}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{formatDateTime(rsvp.respondedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <h3 className="text-lg font-semibold">Attendance (Actual Participation)</h3>
        {event.attendance.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No attendance has been marked for this event yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
              <thead>
                <tr className="text-left text-zinc-600 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Person</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Reason code</th>
                  <th className="py-2 pr-4 font-medium">Marked at</th>
                  <th className="py-2 font-medium">Marked by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {event.attendance.map((attendanceRecord) => (
                  <tr key={attendanceRecord.id}>
                    <td className="py-2 pr-4">
                      {attendanceRecord.person.firstName} {attendanceRecord.person.lastName}
                    </td>
                    <td className="py-2 pr-4">{formatEnumLabel(attendanceRecord.status)}</td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{attendanceRecord.reasonCode ?? "—"}</td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{formatDateTime(attendanceRecord.markedAt)}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      {attendanceRecord.markedBy
                        ? `${attendanceRecord.markedBy.firstName} ${attendanceRecord.markedBy.lastName}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Add or update RSVP</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Submit availability intent now; attendance will be recorded in a later phase.
        </p>

        {rsvpError ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">{rsvpError}</p>
          </div>
        ) : null}

        {people.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No people are available in the active organization yet.
          </p>
        ) : (
          <form action={`/events/${event.id}/rsvp`} method="post" className="mt-3 space-y-4">
            <div className="space-y-1">
              <label htmlFor="personId" className="text-sm font-medium">
                Person
              </label>
              <select id="personId" name="personId" defaultValue={rsvpPersonId} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select a person</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "rsvpPersonIdError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "rsvpPersonIdError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="status" className="text-sm font-medium">
                RSVP status
              </label>
              <select id="status" name="status" defaultValue={rsvpStatus} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.values(RSVPStatus).map((value) => (
                  <option key={value} value={value}>
                    {formatEnumLabel(value)}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "rsvpStatusError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "rsvpStatusError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason (optional)
              </label>
              <textarea
                id="reason"
                name="reason"
                defaultValue={rsvpReason}
                rows={3}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {readSearchParam(resolvedSearchParams, "rsvpReasonError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "rsvpReasonError")}</p>
              ) : null}
            </div>

            <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
              Save RSVP
            </button>
          </form>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Add or update attendance</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Attendance captures what actually happened after RSVP intent. Marked-by attribution now requires a linked
          Clerk UserAccount → Person mapping.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {event.team
            ? "Team roster people are listed first; all people in the active organization remain selectable."
            : "This event is not linked to a team, so all people in the active organization are selectable."}
        </p>

        {attendanceError ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">{attendanceError}</p>
          </div>
        ) : null}

        {attendancePeople.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No people are available in the active organization yet.
          </p>
        ) : (
          <form action={`/events/${event.id}/attendance`} method="post" className="mt-3 space-y-4">
            <div className="space-y-1">
              <label htmlFor="attendancePersonId" className="text-sm font-medium">
                Person
              </label>
              <select
                id="attendancePersonId"
                name="personId"
                defaultValue={attendancePersonId}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Select a person</option>
                {attendancePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                    {rosterPersonIds.has(person.id) ? " (team roster)" : ""}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "attendancePersonIdError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "attendancePersonIdError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="attendanceStatus" className="text-sm font-medium">
                Attendance status
              </label>
              <select
                id="attendanceStatus"
                name="status"
                defaultValue={attendanceStatus}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {Object.values(AttendanceStatus).map((value) => (
                  <option key={value} value={value}>
                    {formatEnumLabel(value)}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "attendanceStatusError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "attendanceStatusError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="reasonCode" className="text-sm font-medium">
                Reason code (optional)
              </label>
              <input
                id="reasonCode"
                name="reasonCode"
                defaultValue={attendanceReasonCode}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {readSearchParam(resolvedSearchParams, "attendanceReasonCodeError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "attendanceReasonCodeError")}</p>
              ) : null}
            </div>

            <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
              Save attendance
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

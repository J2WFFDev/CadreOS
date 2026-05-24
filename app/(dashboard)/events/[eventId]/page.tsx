import Link from "next/link";
import { AttendanceStatus, NoteVisibility, RSVPStatus } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { OperationalHistoryPanel } from "@/components/dashboard/operational-history-panel";
import {
  canReadStaffOnlyContent,
  canReadTeamScopedContent,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  compareFollowUpTasks,
  formatDateTime,
  formatEnumLabel,
  getTaskStatusBadgeClassName,
  isTaskOverdue,
} from "@/lib/follow-up-tasks";
import { getOrganizationScope } from "@/lib/organization-context";
import { getOperationalHistory } from "@/lib/operational-history";
import {
  buildSupportedTaskSourceNoteVisibilityWhere,
  hasResolvedFollowUpTaskOperationalVisibility,
  SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
} from "@/lib/operational-visibility";
import { isSchemaUnavailableError } from "@/lib/workflows";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

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
        <div id="relationship-summary" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadStaffOnlyContent(actorRoleContext)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view event operational workflows.
          </p>
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
        team:
          | {
              id: string;
              name: string;
              program: {
                seasons: Array<{
                  id: string;
                  name: string;
                  startDate: Date | null;
                  endDate: Date | null;
                }>;
              };
              roster: Array<{
                seasonId: string;
                person: { id: string; firstName: string; lastName: string };
              }>;
            }
          | null;
        createdBy: { id: string; firstName: string; lastName: string } | null;
        tasks: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          sourceEventId: string | null;
          assignee: { id: string; firstName: string; lastName: string };
          sourceNote: {
            id: string;
            body: string;
            visibility: NoteVisibility;
            eventId: string | null;
            teamId: string | null;
            team: { programId: string } | null;
            event: { teamId: string | null; programId: string } | null;
          } | null;
        }>;
        notes: Array<{
          id: string;
          body: string;
          createdAt: Date;
          author: { id: string; firstName: string; lastName: string };
          tasks: Array<{ id: string; status: string }>;
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
              program: {
                select: {
                  seasons: {
                    where: { organizationId: scope.organizationId },
                    select: {
                      id: true,
                      name: true,
                      startDate: true,
                      endDate: true,
                    },
                    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
                  },
                },
              },
              roster: {
                where: { organizationId: scope.organizationId },
                select: {
                  seasonId: true,
                  person: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          tasks: {
            where: buildSupportedTaskSourceNoteVisibilityWhere(),
            select: {
              id: true,
              title: true,
              status: true,
              dueAt: true,
              sourceEventId: true,
              assignee: { select: { id: true, firstName: true, lastName: true } },
              sourceNote: {
                select: {
                  id: true,
                  body: true,
                  visibility: true,
                  eventId: true,
                  teamId: true,
                  team: { select: { programId: true } },
                  event: { select: { teamId: true, programId: true } },
                },
              },
            },
          },
          notes: {
            where: { visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY },
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { id: true, firstName: true, lastName: true } },
              tasks: { select: { id: true, status: true } },
            },
            orderBy: [{ createdAt: "desc" }],
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
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
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

  if (!canReadTeamScopedContent(actorRoleContext, event.team?.id ?? null, event.program.id)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this team-scoped event workflow.
          </p>
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
  const attendanceViewParam = readSearchParam(resolvedSearchParams, "attendanceView");
  const attendanceView =
    attendanceViewParam === "all" ||
    attendanceViewParam === "present" ||
    attendanceViewParam === "late" ||
    attendanceViewParam === "excused_absent" ||
    attendanceViewParam === "unexcused_absent"
      ? attendanceViewParam
      : "all";
  const selectedAttendanceSeason = event.team
    ? selectSeededOrCurrentSeason(event.team.program.seasons)
    : null;
  const rosterMembershipsForAttendance =
    event.team && selectedAttendanceSeason
      ? event.team.roster.filter((membership) => membership.seasonId === selectedAttendanceSeason.id)
      : event.team?.roster ?? [];
  const rosterMembers = Array.from(new Map(rosterMembershipsForAttendance.map((membership) => [membership.person.id, membership.person])).values());
  const rosterPersonIds = new Set(rosterMembers.map((person) => person.id));
  const attendanceByPersonId = new Map(event.attendance.map((record) => [record.person.id, record]));
  const missingRosterAttendance = rosterMembers.filter((person) => !attendanceByPersonId.has(person.id));
  const eventTasks = event.tasks
    .filter((task) =>
      hasResolvedFollowUpTaskOperationalVisibility({
        sourceNoteId: task.sourceNote?.id ?? null,
        sourceEventId: task.sourceEventId,
        sourceNoteVisibility: task.sourceNote?.visibility,
        sourceNoteEventId: task.sourceNote?.eventId ?? null,
        sourceNoteTeamId: task.sourceNote?.teamId ?? null,
        sourceNoteEventTeamId: task.sourceNote?.event?.teamId ?? null,
        sourceEventTeamId: event.team?.id ?? null,
        sourceNoteTeamProgramId: task.sourceNote?.team?.programId ?? null,
        sourceNoteEventProgramId: task.sourceNote?.event?.programId ?? null,
        sourceEventProgramId: event.program.id,
      }),
    )
    .sort(compareFollowUpTasks);
  const eventNotes = [...event.notes].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const attendancePeopleSorted = [...people].sort((a, b) => {
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
  const attendancePeople =
    event.team && selectedAttendanceSeason
      ? attendancePeopleSorted.filter((person) => rosterPersonIds.has(person.id))
      : attendancePeopleSorted;
  const filteredAttendance = event.attendance.filter((record) => {
    if (attendanceView === "all") {
      return true;
    }

    if (attendanceView === "present") {
      return record.status === AttendanceStatus.PRESENT;
    }

    if (attendanceView === "late") {
      return record.status === AttendanceStatus.LATE;
    }

    if (attendanceView === "excused_absent") {
      return record.status === AttendanceStatus.EXCUSED_ABSENT;
    }

    return record.status === AttendanceStatus.UNEXCUSED_ABSENT;
  });
  const attendanceCapturedCount = event.attendance.length;
  const expectedAttendanceCount = rosterMembers.length;
  const attendanceMissingCount = missingRosterAttendance.length;
  const lateAttendanceCount = event.attendance.filter((record) => record.status === AttendanceStatus.LATE).length;
  const unexcusedAbsentAttendanceCount = event.attendance.filter(
    (record) => record.status === AttendanceStatus.UNEXCUSED_ABSENT,
  ).length;
  const attendanceConcernCount = attendanceMissingCount + lateAttendanceCount + unexcusedAbsentAttendanceCount;
  const openTaskCount = eventTasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
  const followUpRequired = attendanceMissingCount > 0 || openTaskCount > 0;
  const [eventOperationalHistory, unresolvedEventOperationalHistory] = await Promise.all([
    getOperationalHistory({
      organizationId: scope.organizationId,
      eventId: event.id,
      limit: 8,
      sinceDays: 30,
    }),
    getOperationalHistory({
      organizationId: scope.organizationId,
      eventId: event.id,
      limit: 5,
      sinceDays: 30,
      unresolvedOnly: true,
    }),
  ]);
  const attendanceIndicator = expectedAttendanceCount === 0
    ? attendanceCapturedCount > 0
      ? "Attendance captured (no team roster expectation)"
      : "Attendance expectation not set (event has no team roster context)"
    : attendanceMissingCount > 0
      ? `Attendance missing for part of ${selectedAttendanceSeason ? `${selectedAttendanceSeason.name} ` : ""}team roster`
      : `Attendance captured for all ${selectedAttendanceSeason ? `${selectedAttendanceSeason.name} ` : ""}rostered team members`;
  const fieldOpsBookingHref = `/field-ops/bookings/new?eventId=${event.id}`;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/events" label="Events" />
        <h2 className="text-2xl font-semibold tracking-tight">{event.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/events/${event.id}/edit`}
            className="inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit event
          </Link>
          <Link href="#attendance-workflow" className="inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Attendance workflow
          </Link>
          <Link
            href={`/tasks/new?sourceEventId=${event.id}`}
            className="inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Create follow-up task
          </Link>
          <Link
            href={`/notes/new?eventId=${event.id}`}
            className="inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Add note
          </Link>
          <Link href={fieldOpsBookingHref} className="inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Request FieldOps booking
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
            <dd className="text-zinc-600 dark:text-zinc-400">
              {event.team ? (
                <Link href={`/teams/${event.team.id}`} className="underline">
                  {event.team.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
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

      <div id="operational-alignment" className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
        <h3 className="text-lg font-semibold">Operational alignment summary</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Attendance captured</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{attendanceCapturedCount}</dd>
          </div>
          <div>
            <dt className="font-medium">Expected team attendance</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{expectedAttendanceCount || "Not set"}</dd>
          </div>
          <div>
            <dt className="font-medium">Attendance missing</dt>
            <dd className={attendanceMissingCount > 0 ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}>
              {attendanceMissingCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Linked notes / tasks</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {eventNotes.length} notes · {eventTasks.length} tasks
            </dd>
          </div>
          <div>
            <dt className="font-medium">Open linked tasks</dt>
            <dd className={openTaskCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {openTaskCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Attendance concerns</dt>
            <dd className={attendanceConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {attendanceConcernCount}
              {attendanceConcernCount > 0 ? " (missing, late, or unexcused absent)" : ""}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Operational indicator</dt>
            <dd>
              {followUpRequired ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Follow-up required
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Operationally clear
                </span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{attendanceIndicator}.</p>
        {attendanceConcernCount > 0 ? (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Attendance concern follow-up is recommended. Capture a linked{" "}
            <Link href={`/notes/new?eventId=${event.id}`} className="underline">
              note
            </Link>{" "}
            and create a{" "}
            <Link href={`/tasks/new?sourceEventId=${event.id}`} className="underline">
              follow-up task
            </Link>
            .
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Relationship workflow navigation</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use these links to continue event-linked attendance, note, follow-up, and recent-change review without leaving operational context.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="#attendance-workflow" className="rounded-full border px-2 py-1">
            Attendance workflow
          </Link>
          <Link href={`/notes?eventId=${event.id}`} className="rounded-full border px-2 py-1">
            Event notes
          </Link>
          <Link href={`/notes?eventId=${event.id}&readinessIndicator=needs_review`} className="rounded-full border px-2 py-1">
            Notes needing review
          </Link>
          <Link href={`/tasks?eventId=${event.id}&resolution=unresolved`} className="rounded-full border px-2 py-1">
            Unresolved event tasks
          </Link>
          <Link href={`/tasks?eventId=${event.id}&ownershipIndicator=stale_unresolved`} className="rounded-full border px-2 py-1">
            Stale unresolved tasks
          </Link>
          <Link href={`/tasks?eventId=${event.id}&changedWindow=last_7d`} className="rounded-full border px-2 py-1">
            Recent related activity
          </Link>
          <Link href={`/notes/new?eventId=${event.id}`} className="rounded-full border px-2 py-1">
            Add event note
          </Link>
          <Link href={`/tasks/new?sourceEventId=${event.id}`} className="rounded-full border px-2 py-1">
            New event follow-up
          </Link>
          <Link href="#operational-history" className="rounded-full border px-2 py-1">
            Event change history
          </Link>
          {event.team ? (
            <Link
              href={`/events?teamId=${event.team.id}&operationalIndicator=upcoming_operational_concern`}
              className="rounded-full border px-2 py-1"
            >
              Team upcoming concerns
            </Link>
          ) : null}
        </div>
      </div>

      <OperationalHistoryPanel
        id="operational-history"
        title="Operational history"
        description="Recent event-linked activity across attendance, notes, tasks, and event updates."
        emptyMessage="No recent event-linked operational history was found in the current review window."
        items={eventOperationalHistory}
        action={{ href: `/tasks?eventId=${event.id}&resolution=unresolved`, label: "Open event tasks" }}
        footer={
          unresolvedEventOperationalHistory.length > 0 ? (
            <span>
              Unresolved recent activity: {unresolvedEventOperationalHistory.length}. Use this event history with the
              attendance, notes, and task sections below to maintain continuity.
            </span>
          ) : (
            <span>No unresolved recent event activity is currently flagged.</span>
          )
        }
      />

      <div id="related-notes" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Related notes</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/notes?eventId=${event.id}`} className="underline">
              View event notes
            </Link>
            <span className="text-zinc-500 dark:text-zinc-400">•</span>
            <Link href={`/notes/new?eventId=${event.id}`} className="underline">
              Add note
            </Link>
          </div>
        </div>
        {eventNotes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No observation notes are linked to this event yet. Capture attendance concerns or operational context with an
            event-linked note.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {eventNotes.map((note) => {
              const openLinkedTaskCount = note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
              return (
                <li key={note.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/notes/${note.id}`} className="font-medium underline">
                      {note.body.length > 120 ? `${note.body.slice(0, 120)}…` : note.body}
                    </Link>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {formatDateTime(note.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Author: <Link href={`/people/${note.author.id}`} className="underline">{note.author.firstName} {note.author.lastName}</Link>
                    {" · "}Linked tasks: {note.tasks.length}
                    {openLinkedTaskCount > 0 ? ` (${openLinkedTaskCount} open)` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div id="related-tasks" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Related tasks</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/tasks" className="underline">
              Open tasks workflow
            </Link>
            <span className="text-zinc-500 dark:text-zinc-400">•</span>
            <Link href={`/tasks/new?sourceEventId=${event.id}`} className="underline">
              Create follow-up task
            </Link>
          </div>
        </div>
        {eventTasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No follow-up tasks are linked to this event yet. Create one when attendance gaps or note context need tracked
            resolution.
          </p>
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
                    <td className="py-2 pr-4">
                      <Link href={`/people/${rsvp.person.id}`} className="underline">
                        {rsvp.person.firstName} {rsvp.person.lastName}
                      </Link>
                    </td>
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

      <div id="attendance-workflow" className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Attendance (Actual Participation)</h3>
          <form method="get" className="flex items-center gap-2 text-sm">
            <input type="hidden" name="rsvpPersonId" value={rsvpPersonId} />
            <input type="hidden" name="rsvpStatus" value={rsvpStatus} />
            <input type="hidden" name="rsvpReason" value={rsvpReason} />
            <input type="hidden" name="attendancePersonId" value={attendancePersonId} />
            <input type="hidden" name="attendanceStatus" value={attendanceStatus} />
            <input type="hidden" name="attendanceReasonCode" value={attendanceReasonCode} />
            <label htmlFor="attendanceView" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Attendance filter
            </label>
            <select
              id="attendanceView"
              name="attendanceView"
              defaultValue={attendanceView}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="excused_absent">Excused absent</option>
              <option value="unexcused_absent">Unexcused absent</option>
            </select>
            <button type="submit" className="rounded-md border px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Apply
            </button>
            {attendanceView !== "all" ? (
              <Link href={`/events/${event.id}`} className="rounded-md border px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Captured records: {attendanceCapturedCount}
          {expectedAttendanceCount > 0 ? ` · Missing from team roster: ${attendanceMissingCount}` : " · Team roster expectation not configured"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span>Operational continuity:</span>
          <Link href="#related-notes" className="underline">
            related notes
          </Link>
          <span>•</span>
          <Link href="#related-tasks" className="underline">
            related tasks
          </Link>
          <span>•</span>
          <Link href={`/notes/new?eventId=${event.id}`} className="underline">
            add attendance concern note
          </Link>
          <span>•</span>
          <Link href={`/tasks/new?sourceEventId=${event.id}`} className="underline">
            create follow-up task
          </Link>
        </div>

        {filteredAttendance.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {attendanceView === "all"
              ? "No attendance has been marked for this event yet."
              : "No attendance records match the selected attendance filter."}
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
                {filteredAttendance.map((attendanceRecord) => (
                  <tr key={attendanceRecord.id}>
                    <td className="py-2 pr-4">
                      <Link href={`/people/${attendanceRecord.person.id}`} className="underline">
                        {attendanceRecord.person.firstName} {attendanceRecord.person.lastName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{formatEnumLabel(attendanceRecord.status)}</td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{attendanceRecord.reasonCode ?? "—"}</td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{formatDateTime(attendanceRecord.markedAt)}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      {attendanceRecord.markedBy ? (
                        <Link href={`/people/${attendanceRecord.markedBy.id}`} className="underline">
                          {attendanceRecord.markedBy.firstName} {attendanceRecord.markedBy.lastName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {expectedAttendanceCount > 0 ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
            <h4 className="text-sm font-medium">Missing attendance from current team roster</h4>
            {missingRosterAttendance.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">No roster-linked attendance is missing.</p>
            ) : (
              <>
                <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {missingRosterAttendance.map((person) => (
                    <li key={person.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/people/${person.id}`} className="underline">
                        {person.firstName} {person.lastName}
                      </Link>
                      <span className="text-zinc-400 dark:text-zinc-500">•</span>
                      <Link
                        href={`/events/${event.id}?attendancePersonId=${person.id}&attendanceStatus=${AttendanceStatus.PRESENT}#attendance-capture-form`}
                        className="underline"
                      >
                        Mark present
                      </Link>
                      <span className="text-zinc-400 dark:text-zinc-500">•</span>
                      <Link
                        href={`/events/${event.id}?attendancePersonId=${person.id}&attendanceStatus=${AttendanceStatus.UNEXCUSED_ABSENT}#attendance-capture-form`}
                        className="underline"
                      >
                        Mark absent
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Missing attendance is an unresolved operational item. Capture context in{" "}
                  <Link href={`/notes/new?eventId=${event.id}`} className="underline">
                    notes
                  </Link>{" "}
                  and track action in{" "}
                  <Link href={`/tasks/new?sourceEventId=${event.id}`} className="underline">
                    follow-up tasks
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Add or update RSVP</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Submit availability intent now; attendance will be recorded separately.
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
            ? selectedAttendanceSeason
              ? `Attendance capture is scoped to ${selectedAttendanceSeason.name} team roster members.`
              : "No active/seeded team season was resolved, so all people in the active organization remain selectable."
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
          <form id="attendance-capture-form" action={`/events/${event.id}/attendance`} method="post" className="mt-3 space-y-4">
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

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
        <strong className="font-medium">Current limitations:</strong> Attendance expectations use the selected current/seeded team season when available for linked teams; full date-snapshot roster modeling, approval flows, reminders, and notifications remain deferred.
      </div>
    </section>
  );
}

import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

type SearchParams = Record<string, string | string[] | undefined>;

type AttendanceCoverage = "complete" | "partial" | "missing" | "captured" | "not_applicable";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function getAttendanceCoverage(
  expectedAttendanceCount: number,
  capturedAttendanceCount: number,
  missingAttendanceCount: number,
): AttendanceCoverage {
  if (expectedAttendanceCount === 0) {
    return capturedAttendanceCount > 0 ? "captured" : "not_applicable";
  }

  if (capturedAttendanceCount === 0) {
    return "missing";
  }

  if (missingAttendanceCount > 0) {
    return "partial";
  }

  return "complete";
}

function getCoverageLabel(value: AttendanceCoverage) {
  if (value === "not_applicable") {
    return "Not expected";
  }

  return formatEnumLabel(value);
}

function getCoverageBadgeClassName(value: AttendanceCoverage) {
  if (value === "complete" || value === "captured") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  }

  if (value === "partial") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  }

  if (value === "missing") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }

  return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query events right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const statusFilter = readSearchParam(resolvedSearchParams, "status");
  const teamIdFilter = readSearchParam(resolvedSearchParams, "teamId");
  const ownerPersonIdFilter = readSearchParam(resolvedSearchParams, "ownerPersonId");
  const attendanceFilterParam = readSearchParam(resolvedSearchParams, "attendance");
  const attendanceFilter =
    attendanceFilterParam === "complete" ||
    attendanceFilterParam === "partial" ||
    attendanceFilterParam === "missing" ||
    attendanceFilterParam === "captured" ||
    attendanceFilterParam === "not_applicable"
      ? (attendanceFilterParam as AttendanceCoverage)
      : "";
  const linkFilterParam = readSearchParam(resolvedSearchParams, "links");
  const linkFilter =
    linkFilterParam === "notes" ||
    linkFilterParam === "tasks" ||
    linkFilterParam === "notes_or_tasks" ||
    linkFilterParam === "follow_up_required"
      ? linkFilterParam
      : "";
  const accountabilityFilterParam = readSearchParam(resolvedSearchParams, "accountability");
  const accountabilityFilter =
    accountabilityFilterParam === "unresolved_follow_up" || accountabilityFilterParam === "missing_responsible_team"
      ? accountabilityFilterParam
      : "";

  let events:
    | Array<{
        id: string;
        title: string;
        eventType: string;
        status: string;
        startsAt: Date;
        endsAt: Date | null;
        location: string | null;
        createdBy: { id: string; firstName: string; lastName: string };
        program: { id: string; name: string };
        team: { id: string; name: string; roster: Array<{ personId: string }> } | null;
        _count: { attendance: number; notes: number; tasks: number };
        tasks: Array<{ status: string }>;
      }>
    | null = null;
  let teams: Array<{ id: string; name: string }> = [];
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];

  try {
    const now = new Date();
    const [fetchedEvents, fetchedTeams, fetchedPeople] = await Promise.all([
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(statusFilter ? { status: statusFilter as never } : {}),
          ...(teamIdFilter ? { teamId: teamIdFilter } : {}),
          ...(ownerPersonIdFilter ? { createdByPersonId: ownerPersonIdFilter } : {}),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          program: { select: { id: true, name: true } },
          team: {
            select: {
              id: true,
              name: true,
              roster: {
                where: { organizationId: scope.organizationId },
                select: { personId: true },
              },
            },
          },
          _count: {
            select: {
              attendance: true,
              notes: true,
              tasks: true,
            },
          },
          tasks: {
            select: { status: true },
          },
        },
        orderBy: [
          {
            startsAt: "desc",
          },
        ],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    const upcomingEvents = fetchedEvents
      .filter((event) => event.startsAt >= now)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    const pastEvents = fetchedEvents
      .filter((event) => event.startsAt < now)
      .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());

    events = [...upcomingEvents, ...pastEvents];
    teams = fetchedTeams;
    people = fetchedPeople;
  } catch {
    events = null;
  }

  if (!events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <ErrorMessage message="Unable to load events right now. Please try again later." />
      </section>
    );
  }

  const displayedEvents = events.filter((event) => {
    const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
    const capturedAttendanceCount = event._count.attendance;
    const missingAttendanceCount = Math.max(expectedAttendanceCount - capturedAttendanceCount, 0);
    const attendanceCoverage = getAttendanceCoverage(
      expectedAttendanceCount,
      capturedAttendanceCount,
      missingAttendanceCount,
    );
    const openTaskCount = event.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
    const followUpRequired = missingAttendanceCount > 0 || openTaskCount > 0;

    if (attendanceFilter && attendanceCoverage !== attendanceFilter) {
      return false;
    }

    if (linkFilter === "notes" && event._count.notes === 0) {
      return false;
    }

    if (linkFilter === "tasks" && event._count.tasks === 0) {
      return false;
    }

    if (linkFilter === "notes_or_tasks" && event._count.notes === 0 && event._count.tasks === 0) {
      return false;
    }

    if (linkFilter === "follow_up_required" && missingAttendanceCount === 0 && openTaskCount === 0) {
      return false;
    }

    if (accountabilityFilter === "unresolved_follow_up" && !followUpRequired) {
      return false;
    }

    if (accountabilityFilter === "missing_responsible_team" && (event.team || !followUpRequired)) {
      return false;
    }

    return true;
  });

  const hasActiveFilters = Boolean(
    statusFilter || teamIdFilter || ownerPersonIdFilter || attendanceFilter || linkFilter || accountabilityFilter,
  );

  return (
    <section className="space-y-4">
      <PageHeader
        title="Events"
        description="Schedule events, capture attendance, and review linked notes and follow-up tasks."
        actions={
          <Link href="/events/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New event
          </Link>
        }
      />

      <form method="GET" className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <label htmlFor="status" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status
            </label>
            <select id="status" name="status" defaultValue={statusFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="teamId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Team
            </label>
            <select id="teamId" name="teamId" defaultValue={teamIdFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="ownerPersonId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Responsible person
            </label>
            <select
              id="ownerPersonId"
              name="ownerPersonId"
              defaultValue={ownerPersonIdFilter}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All responsible people</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="attendance" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Attendance capture
            </label>
            <select id="attendance" name="attendance" defaultValue={attendanceFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All attendance states</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="missing">Missing</option>
              <option value="captured">Captured (no team roster expectation)</option>
              <option value="not_applicable">Not expected (no team roster)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="links" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Linked context
            </label>
            <select id="links" name="links" defaultValue={linkFilter} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All link states</option>
              <option value="notes">Has linked notes</option>
              <option value="tasks">Has linked tasks</option>
              <option value="notes_or_tasks">Has linked notes or tasks</option>
              <option value="follow_up_required">Follow-up required</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="accountability" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Accountability
            </label>
            <select
              id="accountability"
              name="accountability"
              defaultValue={accountabilityFilter}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All accountability states</option>
              <option value="unresolved_follow_up">Unresolved event follow-up</option>
              <option value="missing_responsible_team">Missing responsible team context</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          {hasActiveFilters ? (
            <Link href="/events" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {displayedEvents.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No events match the selected filters."
              : "No events have been scheduled yet."
          }
          actionHref={hasActiveFilters ? "/events" : "/events/new"}
          actionLabel={hasActiveFilters ? "Clear filters" : "Schedule the first event"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Responsible person</th>
                <th className="px-4 py-3 font-medium">Attendance</th>
                <th className="px-4 py-3 font-medium">Notes / Tasks</th>
                <th className="px-4 py-3 font-medium">Operational indicator</th>
              </tr>
            </thead>
            <tbody>
              {displayedEvents.map((event) => {
                const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
                const capturedAttendanceCount = event._count.attendance;
                const missingAttendanceCount = Math.max(expectedAttendanceCount - capturedAttendanceCount, 0);
                const attendanceCoverage = getAttendanceCoverage(
                  expectedAttendanceCount,
                  capturedAttendanceCount,
                  missingAttendanceCount,
                );
                const openTaskCount = event.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
                const followUpRequired = missingAttendanceCount > 0 || openTaskCount > 0;

                return (
                  <tr key={event.id} className="border-b align-top last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/events/${event.id}`} className="underline">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatEnumLabel(event.eventType)}</td>
                    <td className="px-4 py-3">{formatEnumLabel(event.status)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(event.startsAt)}</td>
                    <td className="px-4 py-3">{event.program.name}</td>
                    <td className="px-4 py-3">{event.team?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/people/${event.createdBy.id}`} className="underline">
                        {event.createdBy.firstName} {event.createdBy.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCoverageBadgeClassName(attendanceCoverage)}`}
                      >
                        {getCoverageLabel(attendanceCoverage)}
                      </span>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Captured: {capturedAttendanceCount}
                        {expectedAttendanceCount > 0
                          ? ` · Missing: ${missingAttendanceCount} · Expected: ${expectedAttendanceCount}`
                          : " · No team roster expectation"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      Notes: {event._count.notes} · Tasks: {event._count.tasks}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {followUpRequired ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Unresolved follow-up
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Operationally clear
                          </span>
                        )}
                        {followUpRequired && !event.team ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            Missing responsible team
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

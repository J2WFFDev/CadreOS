import { TaskStatus } from "@prisma/client";
import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/phase1c/workflows";

export const dynamic = "force-dynamic";

const RECENT_NOTE_WINDOW_DAYS = 30;

const NAVIGATION_CARDS = [
  {
    href: "/people",
    title: "People",
    description: "Review athletes, guardians, coaches, and operators.",
  },
  {
    href: "/programs",
    title: "Programs",
    description: "Check active programs and organization structure.",
  },
  {
    href: "/teams",
    title: "Teams",
    description: "See team groupings and roster destinations.",
  },
  {
    href: "/events",
    title: "Events",
    description: "Track upcoming sessions, games, and event status.",
  },
  {
    href: "/notes",
    title: "Notes",
    description: "Review the latest operational and coaching notes.",
  },
  {
    href: "/tasks",
    title: "Tasks",
    description: "Monitor open follow-up work and accountability.",
  },
] as const;

const TASK_STATUS_SORT_WEIGHT: Record<string, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
};

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function sortOpenTasks<T extends { status: string; dueAt: Date | null; title: string }>(tasks: T[]) {
  tasks.sort((left, right) => {
    const statusDifference =
      (TASK_STATUS_SORT_WEIGHT[left.status] ?? Number.MAX_SAFE_INTEGER) -
      (TASK_STATUS_SORT_WEIGHT[right.status] ?? Number.MAX_SAFE_INTEGER);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const leftDueAt = left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDueAt = right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (leftDueAt !== rightDueAt) {
      return leftDueAt - rightDueAt;
    }

    return left.title.localeCompare(right.title);
  });

  return tasks;
}

function renderNavigationCards() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {NAVIGATION_CARDS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="rounded-lg border bg-white p-4 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <p className="text-base font-medium">{card.title}</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{card.description}</p>
        </Link>
      ))}
    </div>
  );
}

function renderEmptyList(message: string) {
  return <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>;
}

export default async function DashboardPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Coach Action Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Phase 2F turns the dashboard into a read-only operational command center for coaches and
            program operators.
          </p>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load dashboard data right now."}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-base font-medium">Read-only operations</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The dashboard stays available even when the schema is unavailable, but it does not expose
            create or edit actions in this phase.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-medium">Navigation</h3>
          {renderNavigationCards()}
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Coach Action Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Phase 2F turns the dashboard into a read-only operational command center for coaches and
            program operators.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet. Dashboard summaries will appear after an active
            organization is available.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-medium">Navigation</h3>
          {renderNavigationCards()}
        </div>
      </section>
    );
  }

  const recentNotesThreshold = new Date(Date.now() - RECENT_NOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let dashboardData:
    | {
        counts: {
          programs: number;
          teams: number;
          people: number;
          upcomingEvents: number;
          openTasks: number;
          recentNotes: number;
        };
        upcomingEvents: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          program: { id: string; name: string };
          team: { id: string; name: string } | null;
        }>;
        openTasks: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          assignee: { id: string; firstName: string; lastName: string };
        }>;
        recentNotes: Array<{
          id: string;
          body: string;
          createdAt: Date;
          athlete: { id: string; firstName: string; lastName: string } | null;
          team: { id: string; name: string } | null;
          event: { id: string; title: string } | null;
        }>;
        recentRsvpEvent: {
          id: string;
          title: string;
          startsAt: Date;
          _count: { rsvps: number };
        } | null;
        recentAttendanceEvent: {
          id: string;
          title: string;
          startsAt: Date;
          _count: { attendance: number };
        } | null;
      }
    | null = null;
  let queryErrorMessage = "Unable to load dashboard data right now. Please try again later.";

  try {
    const now = new Date();

    const [
      programCount,
      teamCount,
      peopleCount,
      upcomingEventCount,
      openTaskCount,
      recentNoteCount,
      upcomingEvents,
      openTasks,
      recentNotes,
      recentRsvpEvent,
      recentAttendanceEvent,
    ] = await Promise.all([
      db.program.count({
        where: { organizationId: scope.organizationId },
      }),
      db.team.count({
        where: { organizationId: scope.organizationId },
      }),
      db.person.count({
        where: { organizationId: scope.organizationId },
      }),
      db.event.count({
        where: {
          organizationId: scope.organizationId,
          startsAt: { gte: now },
        },
      }),
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
        },
      }),
      db.observationNote.count({
        where: {
          organizationId: scope.organizationId,
          createdAt: { gte: recentNotesThreshold },
        },
      }),
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          startsAt: { gte: now },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          program: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 5,
      }),
      db.followUpTask.findMany({
        where: {
          organizationId: scope.organizationId,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        take: 25,
      }),
      db.observationNote.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          body: true,
          createdAt: true,
          athlete: { select: { id: true, firstName: true, lastName: true } },
          team: { select: { id: true, name: true } },
          event: { select: { id: true, title: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 5,
      }),
      db.event.findFirst({
        where: {
          organizationId: scope.organizationId,
          rsvps: { some: {} },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          _count: { select: { rsvps: true } },
        },
        orderBy: [{ startsAt: "desc" }],
      }),
      db.event.findFirst({
        where: {
          organizationId: scope.organizationId,
          attendance: { some: {} },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          _count: { select: { attendance: true } },
        },
        orderBy: [{ startsAt: "desc" }],
      }),
    ]);

    dashboardData = {
      counts: {
        programs: programCount,
        teams: teamCount,
        people: peopleCount,
        upcomingEvents: upcomingEventCount,
        openTasks: openTaskCount,
        recentNotes: recentNoteCount,
      },
      upcomingEvents,
      openTasks: sortOpenTasks(openTasks).slice(0, 5),
      recentNotes,
      recentRsvpEvent,
      recentAttendanceEvent,
    };
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading the dashboard.";
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Coach Action Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Phase 2F turns the dashboard into a read-only operational command center for coaches and
            program operators.
          </p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-sm dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">Organization</p>
          <p className="mt-1 font-medium">{scope.organizationName ?? scope.organizationId}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Read-only operations</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This dashboard summarizes live operational data and links to detail screens, but it does not
          add create or edit forms directly on the dashboard.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Navigation</h3>
        {renderNavigationCards()}
      </div>

      {!dashboardData ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Programs", value: dashboardData.counts.programs, sublabel: null },
              { label: "Teams", value: dashboardData.counts.teams, sublabel: null },
              { label: "People", value: dashboardData.counts.people, sublabel: null },
              { label: "Upcoming events", value: dashboardData.counts.upcomingEvents, sublabel: null },
              { label: "Open tasks", value: dashboardData.counts.openTasks, sublabel: null },
              {
                label: "Recent notes",
                value: dashboardData.counts.recentNotes,
                sublabel: `Last ${RECENT_NOTE_WINDOW_DAYS} days`,
              },
            ].map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                {metric.sublabel ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{metric.sublabel}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Upcoming events</h3>
                <Link href="/events" className="text-sm underline">
                  View all
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.upcomingEvents.length === 0
                  ? renderEmptyList("No upcoming events are scheduled for this organization.")
                  : dashboardData.upcomingEvents.map((event) => (
                      <div key={event.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/events/${event.id}`} className="font-medium underline">
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(event.startsAt)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Program: {event.program.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Team: {event.team ? event.team.name : "Unassigned"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Status: {formatEnumLabel(event.status)}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Open follow-up tasks</h3>
                <Link href="/tasks" className="text-sm underline">
                  View all
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.openTasks.length === 0
                  ? renderEmptyList("No open or in-progress tasks are assigned right now.")
                  : dashboardData.openTasks.map((task) => (
                      <div key={task.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/tasks/${task.id}`} className="font-medium underline">
                          {task.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Status: {formatEnumLabel(task.status)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Assignee:{" "}
                          <Link href={`/people/${task.assignee.id}`} className="underline">
                            {task.assignee.firstName} {task.assignee.lastName}
                          </Link>
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Due: {formatDateTime(task.dueAt)}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Recent notes</h3>
                <Link href="/notes" className="text-sm underline">
                  View all
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.recentNotes.length === 0
                  ? renderEmptyList("No notes have been recorded for this organization yet.")
                  : dashboardData.recentNotes.map((note) => (
                      <div key={note.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/notes/${note.id}`} className="font-medium underline">
                          {note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Created: {formatDateTime(note.createdAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {note.athlete ? (
                            <Link href={`/people/${note.athlete.id}`} className="rounded-full border px-2 py-1">
                              Person: {note.athlete.firstName} {note.athlete.lastName}
                            </Link>
                          ) : null}
                          {note.team ? (
                            <Link href={`/teams/${note.team.id}`} className="rounded-full border px-2 py-1">
                              Team: {note.team.name}
                            </Link>
                          ) : null}
                          {note.event ? (
                            <Link href={`/events/${note.event.id}`} className="rounded-full border px-2 py-1">
                              Event: {note.event.title}
                            </Link>
                          ) : null}
                          {!note.athlete && !note.team && !note.event ? (
                            <span className="text-zinc-600 dark:text-zinc-400">No linked record</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h3 className="text-base font-medium">RSVP snapshot</h3>
              {dashboardData.recentRsvpEvent ? (
                <div className="mt-4 space-y-1">
                  <Link href={`/events/${dashboardData.recentRsvpEvent.id}`} className="font-medium underline">
                    {dashboardData.recentRsvpEvent.title}
                  </Link>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Event date: {formatDateTime(dashboardData.recentRsvpEvent.startsAt)}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    RSVP count: {dashboardData.recentRsvpEvent._count.rsvps}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  No RSVP activity has been recorded yet.
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h3 className="text-base font-medium">Attendance snapshot</h3>
              {dashboardData.recentAttendanceEvent ? (
                <div className="mt-4 space-y-1">
                  <Link
                    href={`/events/${dashboardData.recentAttendanceEvent.id}`}
                    className="font-medium underline"
                  >
                    {dashboardData.recentAttendanceEvent.title}
                  </Link>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Event date: {formatDateTime(dashboardData.recentAttendanceEvent.startsAt)}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Attendance count: {dashboardData.recentAttendanceEvent._count.attendance}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  No attendance records have been captured yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

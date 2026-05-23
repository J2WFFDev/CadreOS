import { ApprovalStatus, RoleType, ScopeType, TaskStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError, selectSeededOrCurrentSeason } from "@/lib/workflows";

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
    href: "/field-ops",
    title: "FieldOps",
    description: "Review facilities, resources, and bookings across the organization.",
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
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Operational overview for coaches and program operators.
          </p>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load dashboard data right now."}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-medium">Quick links</h3>
          {renderNavigationCards()}
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Operational overview for coaches and program operators.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet. Dashboard summaries will appear after an active
            organization is available.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-medium">Quick links</h3>
          {renderNavigationCards()}
        </div>
      </section>
    );
  }

  if (scope.auth.unresolvedPersonLink) {
    redirect("/account/link-person");
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  const currentTime = new Date();
  const recentNotesThreshold = new Date(
    currentTime.getTime() - RECENT_NOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  let dashboardData:
    | {
        counts: {
          programs: number;
          teams: number;
          people: number;
          upcomingEvents: number;
          attendanceNeedingReview: number;
          overdueTasks: number;
          recentNotes: number;
          pendingFieldOpsApprovals: number;
          athletesMissingGuardianLinkage: number;
          teamsWithOperationalGaps: number;
        };
        upcomingEvents: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          program: { id: string; name: string };
          team: { id: string; name: string } | null;
        }>;
        attendanceNeedingReview: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          team: { id: string; name: string };
          expectedAttendanceCount: number;
          capturedAttendanceCount: number;
          missingAttendanceCount: number;
        }>;
        overdueTasks: Array<{
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
        athletesMissingGuardianLinkage: Array<{
          id: string;
          firstName: string;
          lastName: string;
          roster: Array<{ team: { id: string; name: string } }>;
        }>;
        teamOperationalGaps: Array<{
          id: string;
          name: string;
          selectedSeasonName: string | null;
          selectedSeasonRosterCount: number;
          membersMissingAssignments: number;
        }>;
        pendingFieldOpsApprovals: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          facility: { id: string; name: string };
          resource: { id: string; name: string };
        }>;
      }
    | null = null;
  let queryErrorMessage = "Unable to load dashboard data right now. Please try again later.";

  try {
    const [
      programCount,
      teamCount,
      peopleCount,
      upcomingEventCount,
      recentNoteCount,
      upcomingEvents,
      attendanceReviewEvents,
      overdueTaskCount,
      overdueTasks,
      recentNotes,
      athletesMissingGuardianLinkageCount,
      athletesMissingGuardianLinkage,
      teamsForGapReview,
      pendingFieldOpsApprovalsCount,
      pendingFieldOpsApprovals,
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
          startsAt: { gte: currentTime },
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
          startsAt: { gte: currentTime },
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
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          startsAt: { lte: currentTime },
          teamId: { not: null },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          team: {
            select: {
              id: true,
              name: true,
              roster: {
                where: { organizationId: scope.organizationId, rosterRole: RoleType.ATHLETE },
                select: { personId: true },
              },
            },
          },
          _count: { select: { attendance: true } },
        },
        orderBy: [{ startsAt: "desc" }],
        take: 30,
      }),
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          dueAt: { lt: currentTime },
        },
      }),
      db.followUpTask.findMany({
        where: {
          organizationId: scope.organizationId,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          dueAt: { lt: currentTime },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: 5,
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
      canViewGuardianRelationshipDetails
        ? db.person.count({
            where: {
              organizationId: scope.organizationId,
              roster: { some: { organizationId: scope.organizationId, rosterRole: RoleType.ATHLETE } },
              athleteLinks: { none: { organizationId: scope.organizationId } },
            },
          })
        : Promise.resolve(0),
      canViewGuardianRelationshipDetails
        ? db.person.findMany({
            where: {
              organizationId: scope.organizationId,
              roster: { some: { organizationId: scope.organizationId, rosterRole: RoleType.ATHLETE } },
              athleteLinks: { none: { organizationId: scope.organizationId } },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              roster: {
                where: { organizationId: scope.organizationId, rosterRole: RoleType.ATHLETE },
                select: {
                  team: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            take: 5,
          })
        : Promise.resolve([]),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          name: true,
          program: {
            select: {
              seasons: {
                where: { organizationId: scope.organizationId },
                select: { id: true, name: true, startDate: true, endDate: true },
                orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
              },
            },
          },
          roster: {
            where: { organizationId: scope.organizationId },
            select: { seasonId: true, personId: true },
          },
          roles: {
            where: { scopeType: ScopeType.TEAM },
            select: { personId: true },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          approvalStatus: ApprovalStatus.PENDING,
        },
      }),
      db.resourceBooking.findMany({
        where: {
          organizationId: scope.organizationId,
          approvalStatus: ApprovalStatus.PENDING,
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          facility: { select: { id: true, name: true } },
          resource: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
    ]);

    const attendanceNeedingReview: Array<{
      id: string;
      title: string;
      startsAt: Date;
      status: string;
      team: { id: string; name: string };
      expectedAttendanceCount: number;
      capturedAttendanceCount: number;
      missingAttendanceCount: number;
    }> = [];
    for (const event of attendanceReviewEvents) {
      if (!event.team) {
        continue;
      }

      const expectedAttendanceCount = new Set(event.team.roster.map((membership) => membership.personId)).size;
      const capturedAttendanceCount = event._count.attendance;
      const missingAttendanceCount = Math.max(expectedAttendanceCount - capturedAttendanceCount, 0);

      if (expectedAttendanceCount === 0 || missingAttendanceCount === 0) {
        continue;
      }

      attendanceNeedingReview.push({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        status: event.status,
        team: { id: event.team.id, name: event.team.name },
        expectedAttendanceCount,
        capturedAttendanceCount,
        missingAttendanceCount,
      });
    }

    attendanceNeedingReview.sort((left, right) => {
      if (left.missingAttendanceCount !== right.missingAttendanceCount) {
        return right.missingAttendanceCount - left.missingAttendanceCount;
      }

      return right.startsAt.getTime() - left.startsAt.getTime();
    });

    if (attendanceNeedingReview.length > 5) {
      attendanceNeedingReview.length = 5;
    }

    const teamOperationalGaps = teamsForGapReview
      .map((team) => {
        const selectedSeason = selectSeededOrCurrentSeason(team.program.seasons);
        const selectedSeasonRoster = selectedSeason
          ? team.roster.filter((membership) => membership.seasonId === selectedSeason.id)
          : [];
        const selectedSeasonRosterPersonIds = new Set(selectedSeasonRoster.map((membership) => membership.personId));
        const roleAssignmentPersonIds = new Set(team.roles.map((assignment) => assignment.personId));

        let membersMissingAssignments = 0;
        selectedSeasonRosterPersonIds.forEach((personId) => {
          if (!roleAssignmentPersonIds.has(personId)) {
            membersMissingAssignments += 1;
          }
        });

        return {
          id: team.id,
          name: team.name,
          selectedSeasonName: selectedSeason?.name ?? null,
          selectedSeasonRosterCount: selectedSeasonRosterPersonIds.size,
          membersMissingAssignments,
        };
      })
      .filter((team) => team.selectedSeasonRosterCount === 0 || team.membersMissingAssignments > 0)
      .sort((left, right) => {
        if (left.membersMissingAssignments !== right.membersMissingAssignments) {
          return right.membersMissingAssignments - left.membersMissingAssignments;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 5);

    dashboardData = {
      counts: {
        programs: programCount,
        teams: teamCount,
        people: peopleCount,
        upcomingEvents: upcomingEventCount,
        attendanceNeedingReview: attendanceNeedingReview.length,
        overdueTasks: overdueTaskCount,
        recentNotes: recentNoteCount,
        pendingFieldOpsApprovals: pendingFieldOpsApprovalsCount,
        athletesMissingGuardianLinkage: athletesMissingGuardianLinkageCount,
        teamsWithOperationalGaps: teamOperationalGaps.length,
      },
      upcomingEvents,
      attendanceNeedingReview,
      overdueTasks: sortOpenTasks(overdueTasks),
      recentNotes,
      athletesMissingGuardianLinkage,
      teamOperationalGaps,
      pendingFieldOpsApprovals,
    };
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading the dashboard.";
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Lightweight coach/admin operational dashboard using current CadreOS workflows.
          </p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-sm dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">Organization</p>
          <p className="mt-1 font-medium">{scope.organizationName ?? scope.organizationId}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-medium">Quick links</h3>
        {renderNavigationCards()}
      </div>

      {!dashboardData ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Programs", value: dashboardData.counts.programs, href: "/programs" },
              { label: "Teams", value: dashboardData.counts.teams, href: "/teams" },
              { label: "People", value: dashboardData.counts.people, href: "/people" },
              {
                label: "Upcoming events",
                value: dashboardData.counts.upcomingEvents,
                href: "/events",
              },
              {
                label: "Attendance needing review",
                value: dashboardData.counts.attendanceNeedingReview,
                href: "/events?attendance=missing",
              },
              {
                label: "Overdue follow-up tasks",
                value: dashboardData.counts.overdueTasks,
                href: "/tasks?dueWindow=overdue",
              },
              {
                label: "Recent notes",
                value: dashboardData.counts.recentNotes,
                href: "/notes",
                sublabel: `Last ${RECENT_NOTE_WINDOW_DAYS} days`,
              },
              {
                label: "FieldOps pending approvals",
                value: dashboardData.counts.pendingFieldOpsApprovals,
                href: "/field-ops/bookings?approvalStatus=PENDING",
              },
              ...(canViewGuardianRelationshipDetails
                ? [
                    {
                      label: "Athletes missing guardian linkage",
                      value: dashboardData.counts.athletesMissingGuardianLinkage,
                      href: "/people",
                    },
                  ]
                : []),
              {
                label: "Teams with roster/assignment gaps",
                value: dashboardData.counts.teamsWithOperationalGaps,
                href: "/teams",
              },
            ].map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className="rounded-lg border bg-white p-4 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                {metric.sublabel ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{metric.sublabel}</p>
                ) : null}
              </Link>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Upcoming events</h3>
                <Link href="/events" className="text-sm underline">
                  View all
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.upcomingEvents.length === 0
                  ? renderEmptyList("No upcoming events are scheduled. Create one from the Events workflow.")
                  : dashboardData.upcomingEvents.map((event) => (
                      <div key={event.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/events/${event.id}`} className="font-medium underline">
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(event.startsAt)} · {formatEnumLabel(event.status)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Program: {event.program.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Team: {event.team ? event.team.name : "Unassigned"}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Attendance needing review</h3>
                <Link href="/events?attendance=missing" className="text-sm underline">
                  Review events
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.attendanceNeedingReview.length === 0
                  ? renderEmptyList("No attendance gaps detected for completed/past team events.")
                  : dashboardData.attendanceNeedingReview.map((event) => {
                      const reviewFilterHref =
                        event.capturedAttendanceCount === 0
                          ? "/events?attendance=missing"
                          : "/events?attendance=partial";

                      return (
                        <div key={event.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                          <Link href={`/events/${event.id}`} className="font-medium underline">
                            {event.title}
                          </Link>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {formatDateTime(event.startsAt)} · Team: {event.team.name}
                          </p>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            Attendance captured: {event.capturedAttendanceCount}/{event.expectedAttendanceCount} ({event.missingAttendanceCount} missing)
                          </p>
                          <div className="mt-2 flex gap-2 text-sm">
                            <Link href={reviewFilterHref} className="underline">
                              Open attendance filter
                            </Link>
                            <span className="text-zinc-500 dark:text-zinc-400">•</span>
                            <Link href={`/events/${event.id}/attendance`} className="underline">
                              Capture attendance
                            </Link>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Overdue follow-up tasks</h3>
                <Link href="/tasks?dueWindow=overdue" className="text-sm underline">
                  Review overdue
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.overdueTasks.length === 0
                  ? renderEmptyList("No overdue open/in-progress follow-up tasks right now.")
                  : dashboardData.overdueTasks.map((task) => (
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
                <h3 className="text-base font-medium">Recent operational notes</h3>
                <Link href="/notes" className="text-sm underline">
                  View all
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.recentNotes.length === 0
                  ? renderEmptyList("No notes have been recorded yet.")
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

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Athletes missing guardian linkage</h3>
                <Link href="/people" className="text-sm underline">
                  Open people
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {!canViewGuardianRelationshipDetails
                  ? renderEmptyList("Guardian relationship detail visibility is staff-role-gated for this account.")
                  : dashboardData.athletesMissingGuardianLinkage.length === 0
                    ? renderEmptyList("No athlete guardian-linkage gaps detected.")
                    : dashboardData.athletesMissingGuardianLinkage.map((person) => {
                        const teamLinks = person.roster
                          .map((membership) => membership.team)
                          .filter((team, index, teams) => teams.findIndex((item) => item.id === team.id) === index)
                          .slice(0, 3);

                        return (
                          <div key={person.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                            <Link href={`/people/${person.id}`} className="font-medium underline">
                              {person.firstName} {person.lastName}
                            </Link>
                            <div className="mt-2 flex flex-wrap gap-2 text-sm">
                              {teamLinks.length === 0 ? (
                                <span className="text-zinc-600 dark:text-zinc-400">No current team membership context.</span>
                              ) : (
                                teamLinks.map((team) => (
                                  <Link
                                    key={team.id}
                                    href={`/teams/${team.id}?guardianFilter=missing_guardian_linkage`}
                                    className="rounded-full border px-2 py-1"
                                  >
                                    Team: {team.name}
                                  </Link>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Team roster and assignment gaps</h3>
                <Link href="/teams" className="text-sm underline">
                  Open teams
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.teamOperationalGaps.length === 0
                  ? renderEmptyList("No selected-season roster or assignment gaps detected.")
                  : dashboardData.teamOperationalGaps.map((team) => (
                      <div key={team.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/teams/${team.id}`} className="font-medium underline">
                          {team.name}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Season: {team.selectedSeasonName ?? "No season context"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Selected-season roster members: {team.selectedSeasonRosterCount}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Role assignment gaps: {team.membersMissingAssignments}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Pending FieldOps approvals</h3>
                <Link href="/field-ops/bookings?approvalStatus=PENDING" className="text-sm underline">
                  Review pending
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.pendingFieldOpsApprovals.length === 0
                  ? renderEmptyList("No pending FieldOps approval requests.")
                  : dashboardData.pendingFieldOpsApprovals.map((booking) => (
                      <div key={booking.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/field-ops/bookings/${booking.id}`} className="font-medium underline">
                          {booking.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(booking.startsAt)} · {formatEnumLabel(booking.status)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {booking.facility.name} · {booking.resource.name}
                        </p>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

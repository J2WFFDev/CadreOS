import { ApprovalStatus, Prisma, RoleType, ScopeType, TaskStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OperationalAwarenessPanel } from "@/components/dashboard/operational-awareness-panel";
import { OperationalIntelligenceAwarenessPanel } from "@/components/dashboard/operational-intelligence-awareness-panel";
import { OperationalReadinessEvaluationPanel } from "@/components/dashboard/operational-readiness-evaluation-panel";
import { OperationalSummaryClassificationPanel } from "@/components/dashboard/operational-summary-classification-panel";
import { OperationalHistoryPanel } from "@/components/dashboard/operational-history-panel";
import { ReviewFocusPanel } from "@/components/dashboard/review-focus-panel";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import {
  buildSupportedTaskSourceNoteVisibilityWhere,
  SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
} from "@/lib/operational-visibility";
import { getOrganizationScope } from "@/lib/organization-context";
import { getOperationalHistory, type OperationalHistoryItem } from "@/lib/operational-history";
import { buildOperationalAwarenessView, type OperationalAwarenessView } from "@/lib/operational-awareness";
import {
  buildOperationalIntelligenceAwarenessView,
  type OperationalIntelligenceAwarenessView,
} from "@/lib/operational-intelligence-awareness";
import {
  buildOperationalReadinessEvaluationView,
  type OperationalReadinessEvaluationView,
} from "@/lib/operational-readiness-evaluation";
import {
  buildOperationalSummaryClassificationView,
  type OperationalSummaryClassificationView,
} from "@/lib/operational-summary-classification";
import { isSchemaUnavailableError, selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";

const RECENT_NOTE_WINDOW_DAYS = 30;
const RECENT_OPERATIONAL_CHANGE_WINDOW_DAYS = 7;
const STALE_UNRESOLVED_TASK_WINDOW_DAYS = 14;
const EVENT_REVIEW_LOOKAHEAD_DAYS = 14;

const OPERATIONAL_REVIEW_CADENCE = [
  {
    title: "Weekly coach review",
    description: "Review overdue and stale unresolved follow-up items with recent operational changes.",
    href: "/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved",
  },
  {
    title: "Event readiness review",
    description: "Check upcoming events with unresolved attendance or task concerns.",
    href: "/events?status=SCHEDULED&operationalIndicator=upcoming_operational_concern",
  },
  {
    title: "Operational notes readiness review",
    description: "Review stale notes and unresolved note-linked follow-up that needs attention.",
    href: "/notes?readinessIndicator=needs_review",
  },
  {
    title: "Ownership accountability review",
    description: "Review overdue owner-linked work and unresolved items with missing responsible context.",
    href: "/tasks?ownershipIndicator=overdue_owner_linked",
  },
  {
    title: "Roster readiness review",
    description: "Confirm teams with selected-season roster or assignment gaps are addressed.",
    href: "/teams?readiness=needs_attention&operationalIndicator=unresolved_too_long",
  },
] as const;

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

function buildScopedProgramWhere(
  organizationId: string,
  staffScopeResolution: ReturnType<typeof resolveStaffScopeResolution>,
): Prisma.ProgramWhereInput {
  return {
    organizationId,
    ...(staffScopeResolution.allowAllStaffScope
      ? {}
      : {
          OR: [
            ...(staffScopeResolution.allowedProgramIds.length > 0
              ? [{ id: { in: staffScopeResolution.allowedProgramIds } }]
              : []),
            ...(staffScopeResolution.allowedTeamIds.length > 0
              ? [{ teams: { some: { id: { in: staffScopeResolution.allowedTeamIds } } } }]
              : []),
          ],
        }),
  };
}

function buildScopedTeamWhere(
  organizationId: string,
  staffScopeResolution: ReturnType<typeof resolveStaffScopeResolution>,
): Prisma.TeamWhereInput {
  return {
    organizationId,
    ...(staffScopeResolution.allowAllStaffScope
      ? {}
      : {
          OR: [
            ...(staffScopeResolution.allowedTeamIds.length > 0
              ? [{ id: { in: staffScopeResolution.allowedTeamIds } }]
              : []),
            ...(staffScopeResolution.allowedProgramIds.length > 0
              ? [{ programId: { in: staffScopeResolution.allowedProgramIds } }]
              : []),
          ],
        }),
  };
}

function buildScopedPersonWhere(
  organizationId: string,
  staffScopeResolution: ReturnType<typeof resolveStaffScopeResolution>,
): Prisma.PersonWhereInput {
  return {
    organizationId,
    ...(staffScopeResolution.allowAllStaffScope
      ? {}
      : {
          OR: [
            ...(staffScopeResolution.allowedTeamIds.length > 0
              ? [{ roster: { some: { organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
              : []),
            ...(staffScopeResolution.allowedTeamIds.length > 0
              ? [{ roles: { some: { organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
              : []),
            ...(staffScopeResolution.allowedProgramIds.length > 0
              ? [{ roster: { some: { organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
              : []),
            ...(staffScopeResolution.allowedProgramIds.length > 0
              ? [{ roles: { some: { organizationId, programId: { in: staffScopeResolution.allowedProgramIds } } } }]
              : []),
            ...(staffScopeResolution.allowedProgramIds.length > 0
              ? [{ roles: { some: { organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
              : []),
          ],
        }),
  };
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

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "dashboard.access",
    entityType: "operationalDashboard",
  });

  if (!staffAccessDecision.allowed) {
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
            You do not have staff access to view operational dashboard workflows.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-medium">Quick links</h3>
          {renderNavigationCards()}
        </div>
      </section>
    );
  }

  const staffScopeResolution = resolveStaffScopeResolution(actorRoleContext);
  if (
    !staffScopeResolution.allowAllStaffScope &&
    (staffScopeResolution.hasAmbiguousScopeAssignments || !staffScopeResolution.hasExplicitScopedAccess)
  ) {
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
            Your role scope is incomplete for safe operational dashboard visibility. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  const scopedEventWhere = staffScopeResolution.allowAllStaffScope
    ? {}
    : {
        OR: [
          ...(staffScopeResolution.allowedTeamIds.length > 0
            ? [{ teamId: { in: staffScopeResolution.allowedTeamIds } }]
            : []),
          ...(staffScopeResolution.allowedProgramIds.length > 0
            ? [{ programId: { in: staffScopeResolution.allowedProgramIds } }]
            : []),
        ],
      };
  const scopedNoteWhere = staffScopeResolution.allowAllStaffScope
    ? {}
    : {
        OR: [
          ...(staffScopeResolution.allowedTeamIds.length > 0
            ? [{ teamId: { in: staffScopeResolution.allowedTeamIds } }]
            : []),
          ...(staffScopeResolution.allowedTeamIds.length > 0
            ? [{ event: { is: { teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
            : []),
          ...(staffScopeResolution.allowedProgramIds.length > 0
            ? [{ event: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
            : []),
          ...(staffScopeResolution.allowedProgramIds.length > 0
            ? [{ team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
            : []),
        ],
      };
  const scopedTaskWhere = staffScopeResolution.allowAllStaffScope
    ? buildSupportedTaskSourceNoteVisibilityWhere()
    : {
        AND: [
          buildSupportedTaskSourceNoteVisibilityWhere(),
          {
            OR: [
              ...(staffScopeResolution.allowedTeamIds.length > 0
                ? [{ sourceEvent: { is: { teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                : []),
              ...(staffScopeResolution.allowedTeamIds.length > 0
                ? [{ sourceNote: { is: { teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                : []),
              ...(staffScopeResolution.allowedTeamIds.length > 0
                ? [{ sourceNote: { is: { event: { is: { teamId: { in: staffScopeResolution.allowedTeamIds } } } } } }]
                : []),
              ...(staffScopeResolution.allowedProgramIds.length > 0
                ? [{ sourceEvent: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                : []),
              ...(staffScopeResolution.allowedProgramIds.length > 0
                ? [{ sourceNote: { is: { event: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                : []),
              ...(staffScopeResolution.allowedProgramIds.length > 0
                ? [{ sourceNote: { is: { team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                : []),
            ],
          },
        ],
      };
  const scopedProgramWhere = buildScopedProgramWhere(scope.organizationId, staffScopeResolution);
  const scopedTeamWhere = buildScopedTeamWhere(scope.organizationId, staffScopeResolution);
  const scopedPersonWhere = buildScopedPersonWhere(scope.organizationId, staffScopeResolution);
  const canViewOrganizationLevelFieldOpsApprovals = staffScopeResolution.allowAllStaffScope;

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
          blockedTasks: number;
          staleUnreviewedTasks: number;
          recentNotes: number;
          pendingFieldOpsApprovals: number;
          athletesMissingGuardianLinkage: number;
          teamsWithOperationalGaps: number;
          missingResponsibleFollowUps: number;
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
        blockedTasks: Array<{
          id: string;
          title: string;
          dueAt: Date | null;
          assignee: { id: string; firstName: string; lastName: string };
          updatedAt: Date;
        }>;
        staleUnreviewedTasks: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          updatedAt: Date;
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
        recentOperationalHistory: OperationalHistoryItem[];
        unresolvedOperationalHistory: OperationalHistoryItem[];
        operationalAwarenessView: OperationalAwarenessView;
        operationalSummaryClassificationView: OperationalSummaryClassificationView;
        operationalReadinessEvaluationView: OperationalReadinessEvaluationView;
        operationalIntelligenceAwarenessView: OperationalIntelligenceAwarenessView;
        unresolvedEventConcerns: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          team: { id: string; name: string } | null;
          missingAttendanceCount: number;
          openTaskCount: number;
        }>;
        notesNeedingAttention: Array<{
          id: string;
          body: string;
          updatedAt: Date;
          team: { id: string; name: string } | null;
          event: { id: string; title: string } | null;
          unresolvedTaskCount: number;
        }>;
        tasksMissingResponsibleContext: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          updatedAt: Date;
          assignee: { id: string; firstName: string; lastName: string };
        }>;
        eventsMissingResponsibleTeam: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          missingAttendanceCount: number;
          openTaskCount: number;
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
      blockedTaskCount,
      blockedTasks,
      staleUnreviewedTaskCount,
      staleUnreviewedTasks,
      missingResponsibleFollowUpCount,
      missingResponsibleFollowUps,
      recentNotes,
      eventOperationalConcerns,
      notesForAttentionReview,
      athletesMissingGuardianLinkageCount,
      athletesMissingGuardianLinkage,
      teamsForGapReview,
      pendingFieldOpsApprovalsCount,
      pendingFieldOpsApprovals,
      recentOperationalHistory,
      unresolvedOperationalHistory,
    ] = await Promise.all([
      db.program.count({
        where: scopedProgramWhere,
      }),
      db.team.count({
        where: scopedTeamWhere,
      }),
      db.person.count({
        where: scopedPersonWhere,
      }),
      db.event.count({
        where: {
          organizationId: scope.organizationId,
          ...scopedEventWhere,
          startsAt: { gte: currentTime },
        },
      }),
      db.observationNote.count({
        where: {
          organizationId: scope.organizationId,
          visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
          ...scopedNoteWhere,
          createdAt: { gte: recentNotesThreshold },
        },
      }),
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          ...scopedEventWhere,
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
          ...scopedEventWhere,
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
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          dueAt: { lt: currentTime },
        },
      }),
      db.followUpTask.findMany({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
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
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: TaskStatus.BLOCKED,
        },
      }),
      db.followUpTask.findMany({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: TaskStatus.BLOCKED,
        },
        select: {
          id: true,
          title: true,
          dueAt: true,
          updatedAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
      }),
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          updatedAt: {
            lt: new Date(currentTime.getTime() - STALE_UNRESOLVED_TASK_WINDOW_DAYS * 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.followUpTask.findMany({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          updatedAt: {
            lt: new Date(currentTime.getTime() - STALE_UNRESOLVED_TASK_WINDOW_DAYS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          updatedAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ updatedAt: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          sourceNoteId: null,
          sourceEventId: null,
          sourceInboxItemId: null,
        },
      }),
      db.followUpTask.findMany({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          sourceNoteId: null,
          sourceEventId: null,
          sourceInboxItemId: null,
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          updatedAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ updatedAt: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
      db.observationNote.findMany({
        where: {
          organizationId: scope.organizationId,
          visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
          ...scopedNoteWhere,
        },
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
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          ...scopedEventWhere,
          startsAt: {
            lte: new Date(currentTime.getTime() + EVENT_REVIEW_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
          },
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
          tasks: {
            select: { status: true },
          },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 30,
      }),
      db.observationNote.findMany({
        where: {
          organizationId: scope.organizationId,
          visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
          ...scopedNoteWhere,
          updatedAt: { gte: new Date(currentTime.getTime() - RECENT_NOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          body: true,
          updatedAt: true,
          team: { select: { id: true, name: true } },
          event: { select: { id: true, title: true } },
          tasks: { select: { status: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 20,
      }),
      canViewGuardianRelationshipDetails
        ? db.person.count({
            where: {
              ...scopedPersonWhere,
              roster: { some: { organizationId: scope.organizationId, rosterRole: RoleType.ATHLETE } },
              athleteLinks: { none: { organizationId: scope.organizationId } },
            },
          })
        : Promise.resolve(0),
      canViewGuardianRelationshipDetails
        ? db.person.findMany({
            where: {
              ...scopedPersonWhere,
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
        where: scopedTeamWhere,
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
      canViewOrganizationLevelFieldOpsApprovals
        ? db.resourceBooking.count({
            where: {
              organizationId: scope.organizationId,
              approvalStatus: ApprovalStatus.PENDING,
            },
          })
        : Promise.resolve(0),
      canViewOrganizationLevelFieldOpsApprovals
        ? db.resourceBooking.findMany({
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
          })
        : Promise.resolve([]),
      getOperationalHistory({
        organizationId: scope.organizationId,
        limit: 8,
        sinceDays: RECENT_OPERATIONAL_CHANGE_WINDOW_DAYS,
        allowAllStaffScope: staffScopeResolution.allowAllStaffScope,
        allowedTeamIds: staffScopeResolution.allowedTeamIds,
        allowedProgramIds: staffScopeResolution.allowedProgramIds,
      }),
      getOperationalHistory({
        organizationId: scope.organizationId,
        limit: 6,
        sinceDays: 30,
        unresolvedOnly: true,
        allowAllStaffScope: staffScopeResolution.allowAllStaffScope,
        allowedTeamIds: staffScopeResolution.allowedTeamIds,
        allowedProgramIds: staffScopeResolution.allowedProgramIds,
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

    const unresolvedEventConcerns = eventOperationalConcerns
      .map((event) => {
        const expectedAttendanceCount = new Set(event.team?.roster.map((membership) => membership.personId) ?? []).size;
        const capturedAttendanceCount = event._count.attendance;
        const missingAttendanceCount =
          event.team && expectedAttendanceCount > 0 ? Math.max(expectedAttendanceCount - capturedAttendanceCount, 0) : 0;
        const openTaskCount = event.tasks.filter(
          (task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED,
        ).length;

        return {
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          status: event.status,
          team: event.team ? { id: event.team.id, name: event.team.name } : null,
          missingAttendanceCount,
          openTaskCount,
        };
      })
      .filter((event) => event.missingAttendanceCount > 0 || event.openTaskCount > 0)
      .sort((left, right) => {
        const leftConcernWeight = left.missingAttendanceCount + left.openTaskCount;
        const rightConcernWeight = right.missingAttendanceCount + right.openTaskCount;
        if (leftConcernWeight !== rightConcernWeight) {
          return rightConcernWeight - leftConcernWeight;
        }

        return left.startsAt.getTime() - right.startsAt.getTime();
      })
      .slice(0, 5);
    const eventsMissingResponsibleTeam = unresolvedEventConcerns
      .filter((event) => !event.team)
      .map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        status: event.status,
        missingAttendanceCount: event.missingAttendanceCount,
        openTaskCount: event.openTaskCount,
      }))
      .slice(0, 5);

    const notesNeedingAttention = notesForAttentionReview
      .map((note) => ({
        id: note.id,
        body: note.body,
        updatedAt: note.updatedAt,
        team: note.team,
        event: note.event,
        unresolvedTaskCount: note.tasks.filter(
          (task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED,
        ).length,
      }))
      .filter((note) => note.unresolvedTaskCount > 0)
      .slice(0, 5);

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

    const combinedOperationalHistory = [
      ...recentOperationalHistory,
      ...unresolvedOperationalHistory.filter((item) => !recentOperationalHistory.some((recent) => recent.id === item.id)),
    ];

    const operationalSummaryClassificationView = buildOperationalSummaryClassificationView(combinedOperationalHistory);
    const operationalReadinessEvaluationView = buildOperationalReadinessEvaluationView({
      items: combinedOperationalHistory,
      summaryView: operationalSummaryClassificationView,
    });
    const operationalIntelligenceAwarenessView = buildOperationalIntelligenceAwarenessView({
      summaryView: operationalSummaryClassificationView,
      readinessView: operationalReadinessEvaluationView,
    });

    dashboardData = {
      counts: {
        programs: programCount,
        teams: teamCount,
        people: peopleCount,
        upcomingEvents: upcomingEventCount,
        attendanceNeedingReview: attendanceNeedingReview.length,
        overdueTasks: overdueTaskCount,
        blockedTasks: blockedTaskCount,
        staleUnreviewedTasks: staleUnreviewedTaskCount,
        recentNotes: recentNoteCount,
        pendingFieldOpsApprovals: pendingFieldOpsApprovalsCount,
        athletesMissingGuardianLinkage: athletesMissingGuardianLinkageCount,
        teamsWithOperationalGaps: teamOperationalGaps.length,
        missingResponsibleFollowUps: missingResponsibleFollowUpCount + eventsMissingResponsibleTeam.length,
      },
      upcomingEvents,
      attendanceNeedingReview,
      overdueTasks: sortOpenTasks(overdueTasks),
      blockedTasks,
      staleUnreviewedTasks: sortOpenTasks(staleUnreviewedTasks),
      tasksMissingResponsibleContext: sortOpenTasks(missingResponsibleFollowUps),
      recentNotes,
      athletesMissingGuardianLinkage,
      teamOperationalGaps,
      pendingFieldOpsApprovals,
      recentOperationalHistory,
      unresolvedOperationalHistory,
      operationalAwarenessView: buildOperationalAwarenessView(combinedOperationalHistory),
      operationalSummaryClassificationView,
      operationalReadinessEvaluationView,
      operationalIntelligenceAwarenessView,
      unresolvedEventConcerns,
      notesNeedingAttention,
      eventsMissingResponsibleTeam,
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

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Operational review cadence</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use these lightweight review passes to maintain weekly operational continuity.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {OPERATIONAL_REVIEW_CADENCE.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-lg border p-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Relationship summary continuity</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Continue review workflows from dashboard into person, team, and event relationship summaries.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/people" className="rounded-full border px-2 py-1">
            Person summaries
          </Link>
          <Link href="/teams?readiness=needs_attention" className="rounded-full border px-2 py-1">
            Team summaries
          </Link>
          <Link href="/events?links=notes_or_tasks" className="rounded-full border px-2 py-1">
            Event summaries
          </Link>
          <Link href="/tasks?resolution=unresolved" className="rounded-full border px-2 py-1">
            Unresolved related items
          </Link>
          <Link href="/events?operationalIndicator=recently_active" className="rounded-full border px-2 py-1">
            Recent related activity
          </Link>
        </div>
      </div>

      {!dashboardData ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      ) : (
        <>
          <ReviewFocusPanel
            title="Operational review at a glance"
            description="Start here for a lighter review pass before opening the detailed sections below."
            defaultScope="Dashboard summary uses current resolved staff scope across task, note, attendance, event, roster, assignment, and permitted FieldOps approval data only."
            stats={[
              {
                label: "Changed recently",
                value: dashboardData.recentOperationalHistory.length,
                href: "#recent-operational-history",
                tone: dashboardData.recentOperationalHistory.length > 0 ? "info" : "neutral",
                helper: `Last ${RECENT_OPERATIONAL_CHANGE_WINDOW_DAYS} days`,
              },
              {
                label: "Requires attention",
                value:
                  dashboardData.counts.staleUnreviewedTasks +
                  dashboardData.counts.missingResponsibleFollowUps +
                  dashboardData.counts.teamsWithOperationalGaps,
                href: "/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved",
                tone:
                  dashboardData.counts.staleUnreviewedTasks +
                    dashboardData.counts.missingResponsibleFollowUps +
                    dashboardData.counts.teamsWithOperationalGaps >
                  0
                    ? "warning"
                    : "success",
              },
              {
                label: "Unresolved in review lane",
                value: dashboardData.unresolvedOperationalHistory.length,
                href: "#unresolved-operational-history",
                tone: dashboardData.unresolvedOperationalHistory.length > 0 ? "warning" : "success",
              },
              {
                label: "May impact upcoming operations",
                value: dashboardData.unresolvedEventConcerns.length,
                href: "/events?operationalIndicator=upcoming_operational_concern",
                tone: dashboardData.unresolvedEventConcerns.length > 0 ? "danger" : "success",
              },
            ]}
            links={[
              { label: "Recent changes", href: "#recent-operational-history" },
              { label: "Unresolved review lane", href: "#unresolved-operational-history" },
              { label: "Upcoming readiness concerns", href: "/events?operationalIndicator=upcoming_operational_concern" },
              { label: "Roster / assignment concerns", href: "/teams?readiness=needs_attention" },
            ]}
            guidance="These groupings are lightweight review aids. They summarize current workflow data and do not introduce workflow automation, notifications, or predictive prioritization."
          />

          {/* Operational Priority Focus — lightweight triage view of what requires immediate review */}
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-base font-medium">Operational priority focus</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Lightweight triage summary. Use this to identify what requires immediate review, what needs
              attention, and what may impact upcoming operations.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Requires immediate review</p>
                <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
                  <li>
                    <Link href="/tasks?dueWindow=overdue" className="underline">
                      Overdue follow-up tasks: {dashboardData.counts.overdueTasks}
                    </Link>
                  </li>
                  <li>
                    <Link href="/tasks?status=BLOCKED&resolution=unresolved" className="underline">
                      Blocked follow-up tasks: {dashboardData.counts.blockedTasks}
                    </Link>
                  </li>
                  <li>
                    <Link href="/events?operationalIndicator=attendance_not_reviewed_recently" className="underline">
                      Attendance gaps needing review: {dashboardData.counts.attendanceNeedingReview}
                    </Link>
                  </li>
                </ul>
                {dashboardData.counts.overdueTasks === 0 &&
                  dashboardData.counts.blockedTasks === 0 &&
                  dashboardData.counts.attendanceNeedingReview === 0 ? (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">No urgent items currently flagged.</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Needs attention</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                  <li>
                    <Link href="/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved" className="underline">
                      Stale unresolved tasks: {dashboardData.counts.staleUnreviewedTasks}
                    </Link>
                  </li>
                  <li>
                    <Link href="/tasks?ownershipIndicator=missing_responsible_context" className="underline">
                      Missing responsible context: {dashboardData.counts.missingResponsibleFollowUps}
                    </Link>
                  </li>
                  <li>
                    <Link href="/teams?readiness=needs_attention" className="underline">
                      Teams with roster/assignment gaps: {dashboardData.counts.teamsWithOperationalGaps}
                    </Link>
                  </li>
                </ul>
                {dashboardData.counts.staleUnreviewedTasks === 0 &&
                  dashboardData.counts.missingResponsibleFollowUps === 0 &&
                  dashboardData.counts.teamsWithOperationalGaps === 0 ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">No items currently need attention.</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/30">
                <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">May impact upcoming operations</p>
                <ul className="mt-2 space-y-1 text-sm text-violet-700 dark:text-violet-400">
                  <li>
                    <Link href="/events?status=SCHEDULED" className="underline">
                      Upcoming scheduled events: {dashboardData.counts.upcomingEvents}
                    </Link>
                  </li>
                  <li>
                    <Link href="/events?links=follow_up_required" className="underline">
                      Events with unresolved follow-up: {dashboardData.unresolvedEventConcerns.length}
                    </Link>
                  </li>
                  <li>
                    <Link href="/events?operationalIndicator=upcoming_operational_concern" className="underline">
                      Upcoming events with operational concerns
                    </Link>
                  </li>
                </ul>
                {dashboardData.counts.upcomingEvents === 0 && dashboardData.unresolvedEventConcerns.length === 0 ? (
                  <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">No upcoming operational risks flagged.</p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Priority indicators are heuristic-based, derived from existing task status, attendance gaps, and event
              timing. No AI or automated prioritization is used. Deferred: reminders, notifications, workflow
              automation.
            </p>
          </div>

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
                href: "/events?operationalIndicator=attendance_not_reviewed_recently",
              },
              {
                label: "Overdue follow-up tasks",
                value: dashboardData.counts.overdueTasks,
                href: "/tasks?dueWindow=overdue",
              },
              {
                label: "Blocked follow-up tasks",
                value: dashboardData.counts.blockedTasks,
                href: "/tasks?status=BLOCKED&resolution=unresolved",
              },
              {
                label: "Stale unresolved tasks",
                value: dashboardData.counts.staleUnreviewedTasks,
                href: "/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved",
                sublabel: `No updates in ${STALE_UNRESOLVED_TASK_WINDOW_DAYS}+ days`,
              },
              {
                label: "Missing responsible follow-up context",
                value: dashboardData.counts.missingResponsibleFollowUps,
                href: "/tasks?ownershipIndicator=missing_responsible_context",
              },
              {
                label: "Recent notes",
                value: dashboardData.counts.recentNotes,
                href: "/notes",
                sublabel: `Last ${RECENT_NOTE_WINDOW_DAYS} days`,
              },
              ...(canViewOrganizationLevelFieldOpsApprovals
                ? [
                    {
                      label: "FieldOps pending approvals",
                      value: dashboardData.counts.pendingFieldOpsApprovals,
                      href: "/field-ops/bookings?approvalStatus=PENDING",
                    },
                  ]
                : []),
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
                href: "/teams?readiness=needs_attention",
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
                        <Link href={`/events/${event.id}#relationship-summary`} className="font-medium underline">
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
                <Link href="/events?operationalIndicator=attendance_not_reviewed_recently" className="text-sm underline">
                  Review events
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.attendanceNeedingReview.length === 0
                  ? renderEmptyList("No attendance gaps detected for completed/past team events.")
                  : dashboardData.attendanceNeedingReview.map((event) => {
                      const reviewFilterHref =
                        event.capturedAttendanceCount === 0
                          ? "/events?operationalIndicator=attendance_not_reviewed_recently&attendance=missing"
                          : "/events?operationalIndicator=needs_review&attendance=partial";

                      return (
                        <div key={event.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                          <Link href={`/events/${event.id}#relationship-summary`} className="font-medium underline">
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
                            <Link href={`/events/${event.id}#attendance-workflow`} className="underline">
                              Capture attendance
                            </Link>
                            <span className="text-zinc-500 dark:text-zinc-400">•</span>
                            <Link href={`/notes?eventId=${event.id}`} className="underline">
                              Event notes
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
                <h3 className="text-base font-medium">Blocked follow-up tasks</h3>
                <Link href="/tasks?status=BLOCKED&resolution=unresolved" className="text-sm underline">
                  Review blocked
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.blockedTasks.length === 0
                  ? renderEmptyList("No blocked follow-up tasks currently flagged.")
                  : dashboardData.blockedTasks.map((task) => (
                      <div key={task.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/tasks/${task.id}`} className="font-medium underline">
                          {task.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Assignee:{" "}
                          <Link href={`/people/${task.assignee.id}`} className="underline">
                            {task.assignee.firstName} {task.assignee.lastName}
                          </Link>
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Due: {formatDateTime(task.dueAt)}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Last changed: {formatDateTime(task.updatedAt)}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Stale unresolved follow-up items</h3>
                <Link href="/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved" className="text-sm underline">
                  Review unresolved
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.staleUnreviewedTasks.length === 0
                  ? renderEmptyList(`No unresolved tasks are stale past ${STALE_UNRESOLVED_TASK_WINDOW_DAYS} days.`)
                  : dashboardData.staleUnreviewedTasks.map((task) => (
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
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Due: {formatDateTime(task.dueAt)}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Last changed: {formatDateTime(task.updatedAt)}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Missing responsible follow-up context</h3>
                <Link href="/tasks?ownershipIndicator=missing_responsible_context" className="text-sm underline">
                  Review ownership gaps
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.tasksMissingResponsibleContext.length === 0 &&
                dashboardData.eventsMissingResponsibleTeam.length === 0 ? (
                  renderEmptyList("No unresolved ownership/accountability gaps are currently flagged.")
                ) : (
                  <>
                    {dashboardData.tasksMissingResponsibleContext.map((task) => (
                      <div key={task.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/tasks/${task.id}`} className="font-medium underline">
                          {task.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Status: {formatEnumLabel(task.status)} · Due: {formatDateTime(task.dueAt)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Assigned owner:{" "}
                          <Link href={`/people/${task.assignee.id}`} className="underline">
                            {task.assignee.firstName} {task.assignee.lastName}
                          </Link>
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Last changed: {formatDateTime(task.updatedAt)} · Source context missing
                        </p>
                      </div>
                    ))}
                    {dashboardData.eventsMissingResponsibleTeam.map((event) => (
                      <div key={event.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/events/${event.id}`} className="font-medium underline">
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(event.startsAt)} · {formatEnumLabel(event.status)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Missing attendance: {event.missingAttendanceCount} · Open tasks: {event.openTaskCount}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Responsible team context is missing.</p>
                      </div>
                    ))}
                  </>
                )}
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
                <h3 className="text-base font-medium">Recent notes needing attention</h3>
                <Link href="/notes" className="text-sm underline">
                  Review notes
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.notesNeedingAttention.length === 0
                  ? renderEmptyList("No recent notes currently have unresolved follow-up tasks.")
                  : dashboardData.notesNeedingAttention.map((note) => (
                      <div key={note.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/notes/${note.id}`} className="font-medium underline">
                          {note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Unresolved linked tasks: {note.unresolvedTaskCount}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Last changed: {formatDateTime(note.updatedAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-400">
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
                          <Link href={`/tasks?resolution=unresolved`} className="rounded-full border px-2 py-1">
                            Open unresolved tasks
                          </Link>
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
                            <Link href={`/people/${person.id}#relationship-summary`} className="font-medium underline">
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
                        <Link href={`/teams/${team.id}#relationship-summary`} className="font-medium underline">
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
                <h3 className="text-base font-medium">Unresolved event operational concerns</h3>
                <Link href="/events?links=follow_up_required" className="text-sm underline">
                  Review events
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                {dashboardData.unresolvedEventConcerns.length === 0
                  ? renderEmptyList("No unresolved event-level attendance/task concerns in the current review window.")
                  : dashboardData.unresolvedEventConcerns.map((event) => (
                      <div key={event.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Link href={`/events/${event.id}#relationship-summary`} className="font-medium underline">
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(event.startsAt)} · {formatEnumLabel(event.status)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Team: {event.team?.name ?? "Unassigned"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          Missing attendance: {event.missingAttendanceCount} · Open tasks: {event.openTaskCount}
                        </p>
                        <div className="mt-2 flex gap-2 text-sm">
                          <Link href={`/events/${event.id}#attendance-workflow`} className="underline">
                            Attendance workflow
                          </Link>
                          <span className="text-zinc-500 dark:text-zinc-400">•</span>
                          <Link href={`/tasks?eventId=${event.id}&resolution=unresolved`} className="underline">
                            Event unresolved tasks
                          </Link>
                        </div>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Pending FieldOps approvals</h3>
                {canViewOrganizationLevelFieldOpsApprovals ? (
                  <Link href="/field-ops/bookings?approvalStatus=PENDING" className="text-sm underline">
                    Review pending
                  </Link>
                ) : null}
              </div>
              <div className="mt-4 space-y-4">
                {!canViewOrganizationLevelFieldOpsApprovals
                  ? renderEmptyList(
                      "Pending FieldOps approval review remains organization-scoped until staff-safe non-org visibility rules are defined.",
                    )
                  : dashboardData.pendingFieldOpsApprovals.length === 0
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

            <OperationalHistoryPanel
              id="recent-operational-history"
              title="Recent operational history"
              description="Recent task, note, attendance, event, roster, and assignment changes using current workflow timestamps."
              emptyMessage={`No changes captured in the last ${RECENT_OPERATIONAL_CHANGE_WINDOW_DAYS} days.`}
              items={dashboardData.recentOperationalHistory}
              action={{ href: "/tasks?changedWindow=last_7d", label: "Open recent task updates" }}
              footer={
                <>
                  Roster and role-assignment history reflects current records only. Removal events and true last-updater
                  attribution remain deferred until dedicated audit/Entry-style history work is introduced.
                </>
              }
            />
            <OperationalHistoryPanel
              id="unresolved-operational-history"
              title="Unresolved operational history"
              description="Recent unresolved follow-up across existing task, note, attendance, and event workflows."
              emptyMessage="No unresolved recent operational activity is currently flagged."
              items={dashboardData.unresolvedOperationalHistory}
              action={{ href: "/tasks?resolution=unresolved&ownershipIndicator=stale_unresolved", label: "Review unresolved workflow" }}
            />
          </div>
          <OperationalSummaryClassificationPanel
            summaryView={dashboardData.operationalSummaryClassificationView}
          />
          <OperationalReadinessEvaluationPanel
            readinessView={dashboardData.operationalReadinessEvaluationView}
          />
          <OperationalIntelligenceAwarenessPanel
            awarenessView={dashboardData.operationalIntelligenceAwarenessView}
          />
          <OperationalAwarenessPanel awarenessView={dashboardData.operationalAwarenessView} />
        </>
      )}
    </section>
  );
}

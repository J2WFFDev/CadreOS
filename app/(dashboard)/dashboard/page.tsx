import {
  ApprovalStatus,
  AttendanceStatus,
  BookingStatus,
  ConsumableTransactionType,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  MemberLifecycleStatus,
  Prisma,
  RoleType,
  ScopeType,
  TaskStatus,
} from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OperationalAwarenessPanel } from "@/components/dashboard/operational-awareness-panel";
import { OperationalIntelligenceAwarenessPanel } from "@/components/dashboard/operational-intelligence-awareness-panel";
import { OperationalReadinessEvaluationPanel } from "@/components/dashboard/operational-readiness-evaluation-panel";
import { OperationalSummaryClassificationPanel } from "@/components/dashboard/operational-summary-classification-panel";
import { OperationalHistoryPanel } from "@/components/dashboard/operational-history-panel";
import { ReviewFocusPanel } from "@/components/dashboard/review-focus-panel";
import {
  summarizeAttendanceTrend,
  summarizeRsvpReadiness,
} from "@/lib/attendance-event-reporting";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { appendReturnToParam } from "@/lib/navigation-context";
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
const ATTENDANCE_PARTICIPATION_EVENT_SAMPLE_SIZE = 30;

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
    href: "/gear-ops",
    title: "GearOps",
    description: "Review gear categories, item lifecycle status, and accountability context.",
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

const RAPID_CAPTURE_ACTIONS = [
  {
    href: "/notes/new",
    label: "Rapid note capture",
    description: "Capture an operational observation with minimal navigation.",
  },
  {
    href: "/tasks/new",
    label: "Rapid follow-up capture",
    description: "Create follow-up directly when unresolved work is identified.",
  },
  {
    href: "/events?operationalIndicator=attendance_not_reviewed_recently",
    label: "Attendance capture lane",
    description: "Open event attendance gaps and capture updates in context.",
  },
  {
    href: "/field-ops/bookings/new",
    label: "Rapid FieldOps request",
    description: "Create a booking request with current scoped context.",
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

function renderRapidCaptureActions() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {RAPID_CAPTURE_ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="rounded-lg border bg-white p-3 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <p className="text-sm font-medium">{action.label}</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{action.description}</p>
        </Link>
      ))}
    </div>
  );
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

        <div className="space-y-3">
          <h3 className="text-base font-medium">Rapid operational capture</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Quick-entry shortcuts for current staff-scoped workflows. No offline, messaging, or automation runtime is added.
          </p>
          {renderRapidCaptureActions()}
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
  const gearReportingAccess = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "dashboard.gear-ops.reporting.access",
  });
  const canViewGearOpsReporting = gearReportingAccess.allowed;

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
          activeMembers: number;
          prospectMembers: number;
          inactiveMembers: number;
          archivedMembers: number;
          alumniMembers: number;
          upcomingEvents: number;
          attendanceNeedingReview: number;
          attendanceParticipationCoveragePercent: number;
          attendanceParticipationEventsReviewed: number;
          unresolvedFollowUps: number;
          overdueTasks: number;
          blockedTasks: number;
          staleUnreviewedTasks: number;
          recentNotes: number;
          recentOperationalChanges: number;
          pendingFieldOpsApprovals: number;
          fieldOpsUpcomingReservations: number;
          fieldOpsActiveResources: number;
          fieldOpsAvailableResources: number;
          fieldOpsReadinessConcerns: number;
          gearVisibleItems: number;
          gearDurableItems: number;
          gearConsumableItems: number;
          gearAssignedOrCheckedOutItems: number;
          gearMaintenanceItems: number;
          gearConditionConcerns: number;
          gearActiveAssignments: number;
          gearOpenCheckouts: number;
          lowAvailabilityConsumables: number;
          consumableUsageUnits30d: number;
          consumableReplenishmentUnits30d: number;
          consumableNetDelta30d: number;
          gearReadinessConcerns: number;
          athletesMissingGuardianLinkage: number;
          teamsWithOperationalGaps: number;
          missingResponsibleFollowUps: number;
          lifecycleActive: number;
          lifecycleProspect: number;
          lifecycleInactive: number;
          lifecycleArchived: number;
          lifecycleAlumni: number;
          activeWithoutRosterMembership: number;
        };
        lifecycleStatusCounts: Record<MemberLifecycleStatus, number>;
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
        recentAttendanceTrend: ReturnType<typeof summarizeAttendanceTrend>;
        upcomingEventReadiness: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          program: { id: string; name: string };
          team: { id: string; name: string } | null;
          expectedAttendanceCount: number;
          noResponseCount: number;
          goingCount: number;
          maybeCount: number;
          notGoingCount: number;
          openTaskCount: number;
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
        upcomingFieldOpsReservations: Array<{
          id: string;
          title: string;
          startsAt: Date;
          status: string;
          approvalStatus: string;
          facility: { id: string; name: string };
          resource: { id: string; name: string };
        }>;
        lowAvailabilityConsumables: Array<{
          id: string;
          name: string;
          quantityOnHand: number;
          quantityMin: number | null;
          program: { id: string; name: string } | null;
        }>;
        openGearCheckouts: Array<{
          id: string;
          checkedOutAt: Date;
          status: string;
          gearItem: { id: string; name: string };
          checkedOutBy: { id: string; firstName: string; lastName: string };
        }>;
        recentConsumableTransactions: Array<{
          id: string;
          recordedAt: Date;
          quantityDelta: number;
          transactionType: string;
          gearItem: { id: string; name: string };
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
        activeMembersWithoutRosterMembership: Array<{
          id: string;
          firstName: string;
          lastName: string;
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
      upcomingEventReadinessEvents,
      attendanceReviewEvents,
      overdueTaskCount,
      unresolvedFollowUpCount,
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
      fieldOpsUpcomingReservationsCount,
      fieldOpsUpcomingReservations,
      fieldOpsActiveResourceCount,
      fieldOpsInactiveResourceCount,
      fieldOpsInactiveFacilityCount,
      gearVisibleItemCount,
      gearDurableItemCount,
      gearConsumableItemCount,
      gearAssignedOrCheckedOutItemCount,
      gearMaintenanceItemCount,
      gearConditionConcernItemCount,
      gearActiveAssignmentCount,
      gearOpenCheckoutCount,
      lowAvailabilityConsumableCount,
      lowAvailabilityConsumables,
      openGearCheckouts,
      recentConsumableTransactions,
      consumableUsageAggregate30d,
      consumableReplenishmentAggregate30d,
      lifecycleStatusGroupedCounts,
      activeMembersWithoutRosterMembershipCount,
      activeMembersWithoutRosterMembership,
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
          startsAt: {
            gte: currentTime,
            lte: new Date(currentTime.getTime() + EVENT_REVIEW_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          program: { select: { id: true, name: true } },
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
          rsvps: {
            select: {
              personId: true,
              status: true,
            },
          },
          tasks: {
            select: { status: true },
          },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 8,
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
        take: ATTENDANCE_PARTICIPATION_EVENT_SAMPLE_SIZE,
      }),
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          dueAt: { lt: currentTime },
        },
      }),
      db.followUpTask.count({
        where: {
          organizationId: scope.organizationId,
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
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
      canViewOrganizationLevelFieldOpsApprovals
        ? db.resourceBooking.count({
            where: {
              organizationId: scope.organizationId,
              startsAt: { gte: currentTime },
              status: {
                notIn: [BookingStatus.DENIED, BookingStatus.CANCELED],
              },
            },
          })
        : Promise.resolve(0),
      canViewOrganizationLevelFieldOpsApprovals
        ? db.resourceBooking.findMany({
            where: {
              organizationId: scope.organizationId,
              startsAt: { gte: currentTime },
              status: {
                notIn: [BookingStatus.DENIED, BookingStatus.CANCELED],
              },
            },
            select: {
              id: true,
              title: true,
              startsAt: true,
              status: true,
              approvalStatus: true,
              facility: { select: { id: true, name: true } },
              resource: { select: { id: true, name: true } },
            },
            orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
            take: 5,
          })
        : Promise.resolve([]),
      canViewOrganizationLevelFieldOpsApprovals
        ? db.facilityResource.count({
            where: {
              organizationId: scope.organizationId,
              status: "ACTIVE",
              facility: { status: "ACTIVE" },
            },
          })
        : Promise.resolve(0),
      canViewOrganizationLevelFieldOpsApprovals
        ? db.facilityResource.count({
            where: {
              organizationId: scope.organizationId,
              status: {
                not: "ACTIVE",
              },
            },
          })
        : Promise.resolve(0),
      canViewOrganizationLevelFieldOpsApprovals
        ? db.facility.count({
            where: {
              organizationId: scope.organizationId,
              status: {
                not: "ACTIVE",
              },
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: gearReportingAccess.where,
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: { ...gearReportingAccess.where, inventoryType: GearInventoryType.DURABLE },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: { ...gearReportingAccess.where, inventoryType: GearInventoryType.CONSUMABLE },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: {
              ...gearReportingAccess.where,
              lifecycleStatus: { in: [GearItemLifecycleStatus.ASSIGNED, GearItemLifecycleStatus.CHECKED_OUT] },
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: {
              ...gearReportingAccess.where,
              lifecycleStatus: GearItemLifecycleStatus.MAINTENANCE,
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: {
              ...gearReportingAccess.where,
              conditionStatus: { in: [GearConditionStatus.POOR, GearConditionStatus.DAMAGED] },
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearAssignment.count({
            where: {
              organizationId: scope.organizationId,
              status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] },
              gearItem: { AND: [gearReportingAccess.where] },
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearCheckout.count({
            where: {
              organizationId: scope.organizationId,
              status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
              gearItem: { AND: [gearReportingAccess.where] },
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.count({
            where: {
              ...gearReportingAccess.where,
              inventoryType: GearInventoryType.CONSUMABLE,
              quantityMin: { not: null },
              quantityOnHand: { lte: db.gearItem.fields.quantityMin },
            },
          })
        : Promise.resolve(0),
      canViewGearOpsReporting
        ? db.gearItem.findMany({
            where: {
              ...gearReportingAccess.where,
              inventoryType: GearInventoryType.CONSUMABLE,
              quantityMin: { not: null },
              quantityOnHand: { lte: db.gearItem.fields.quantityMin },
            },
            select: {
              id: true,
              name: true,
              quantityOnHand: true,
              quantityMin: true,
              program: { select: { id: true, name: true } },
            },
            orderBy: [{ quantityOnHand: "asc" }, { updatedAt: "asc" }],
            take: 5,
          })
        : Promise.resolve([]),
      canViewGearOpsReporting
        ? db.gearCheckout.findMany({
            where: {
              organizationId: scope.organizationId,
              status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
              gearItem: { AND: [gearReportingAccess.where] },
            },
            select: {
              id: true,
              checkedOutAt: true,
              status: true,
              gearItem: { select: { id: true, name: true } },
              checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
            take: 5,
          })
        : Promise.resolve([]),
      canViewGearOpsReporting
        ? db.consumableTransaction.findMany({
            where: {
              organizationId: scope.organizationId,
              gearItem: { AND: [gearReportingAccess.where] },
              recordedAt: { gte: new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000) },
            },
            select: {
              id: true,
              recordedAt: true,
              quantityDelta: true,
              transactionType: true,
              gearItem: { select: { id: true, name: true } },
            },
            orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
            take: 5,
          })
        : Promise.resolve([]),
      canViewGearOpsReporting
        ? db.consumableTransaction.aggregate({
            where: {
              organizationId: scope.organizationId,
              gearItem: { AND: [gearReportingAccess.where] },
              recordedAt: { gte: new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000) },
              transactionType: {
                in: [
                  ConsumableTransactionType.USED,
                  ConsumableTransactionType.DISTRIBUTED,
                  ConsumableTransactionType.DISPOSED,
                ],
              },
            },
            _sum: { quantityDelta: true },
          })
        : Promise.resolve({ _sum: { quantityDelta: 0 } }),
      canViewGearOpsReporting
        ? db.consumableTransaction.aggregate({
            where: {
              organizationId: scope.organizationId,
              gearItem: { AND: [gearReportingAccess.where] },
              recordedAt: { gte: new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000) },
              transactionType: { in: [ConsumableTransactionType.RECEIVED] },
            },
            _sum: { quantityDelta: true },
          })
        : Promise.resolve({ _sum: { quantityDelta: 0 } }),
      db.person.groupBy({
        by: ["lifecycleStatus"],
        where: scopedPersonWhere,
        _count: {
          _all: true,
        },
      }),
      db.person.count({
        where: {
          ...scopedPersonWhere,
          lifecycleStatus: MemberLifecycleStatus.ACTIVE,
          roster: {
            none: {
              organizationId: scope.organizationId,
            },
          },
        },
      }),
      db.person.findMany({
        where: {
          ...scopedPersonWhere,
          lifecycleStatus: MemberLifecycleStatus.ACTIVE,
          roster: {
            none: {
              organizationId: scope.organizationId,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 5,
      }),
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

    const recentAttendanceTrend = summarizeAttendanceTrend(
      attendanceReviewEvents
        .filter((event) => Boolean(event.team))
        .map((event) => ({
          startsAt: event.startsAt,
          expectedPersonIds: event.team ? event.team.roster.map((membership) => membership.personId) : [],
          attendanceRecords: event.team
            ? Array.from({ length: Math.min(event._count.attendance, event.team.roster.length) }, (_, index) => ({
                personId: event.team?.roster[index]?.personId ?? `captured-${index}`,
                status: AttendanceStatus.PRESENT,
              }))
            : [],
        })),
    );
    const upcomingEventReadiness = upcomingEventReadinessEvents
      .map((event) => {
        const expectedPersonIds = event.team?.roster.map((membership) => membership.personId) ?? [];
        const rsvpSummary = summarizeRsvpReadiness({
          expectedPersonIds,
          rsvps: event.rsvps,
        });
        const openTaskCount = event.tasks.filter(
          (task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED,
        ).length;

        return {
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          status: event.status,
          program: event.program,
          team: event.team ? { id: event.team.id, name: event.team.name } : null,
          expectedAttendanceCount: expectedPersonIds.length,
          noResponseCount: rsvpSummary.noResponseCount,
          goingCount: rsvpSummary.goingCount,
          maybeCount: rsvpSummary.maybeCount,
          notGoingCount: rsvpSummary.notGoingCount,
          openTaskCount,
        };
      })
      .sort((left, right) => {
        const leftConcernWeight = left.noResponseCount + left.openTaskCount;
        const rightConcernWeight = right.noResponseCount + right.openTaskCount;

        if (leftConcernWeight !== rightConcernWeight) {
          return rightConcernWeight - leftConcernWeight;
        }

        return left.startsAt.getTime() - right.startsAt.getTime();
      })
      .slice(0, 5);

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
    const lifecycleStatusCounts = Object.values(MemberLifecycleStatus).reduce(
      (counts, status) => {
        counts[status] =
          lifecycleStatusGroupedCounts.find((entry) => entry.lifecycleStatus === status)?._count._all ?? 0;
        return counts;
      },
      {} as Record<MemberLifecycleStatus, number>,
    );
    const upcomingFieldOpsResourceIds = new Set(fieldOpsUpcomingReservations.map((booking) => booking.resource.id));
    const fieldOpsAvailableResourceCount = Math.max(fieldOpsActiveResourceCount - upcomingFieldOpsResourceIds.size, 0);
    const fieldOpsReadinessConcernCount =
      pendingFieldOpsApprovalsCount + fieldOpsInactiveResourceCount + fieldOpsInactiveFacilityCount;
    const consumableUsageUnits30d = Math.abs(consumableUsageAggregate30d._sum.quantityDelta ?? 0);
    const consumableReplenishmentUnits30d = Math.max(consumableReplenishmentAggregate30d._sum.quantityDelta ?? 0, 0);
    const consumableNetDelta30d = consumableReplenishmentUnits30d - consumableUsageUnits30d;
    const gearReadinessConcernCount =
      gearMaintenanceItemCount +
      gearConditionConcernItemCount +
      lowAvailabilityConsumableCount +
      gearOpenCheckoutCount;

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
        activeMembers: lifecycleStatusCounts[MemberLifecycleStatus.ACTIVE],
        prospectMembers: lifecycleStatusCounts[MemberLifecycleStatus.PROSPECT],
        inactiveMembers: lifecycleStatusCounts[MemberLifecycleStatus.INACTIVE],
        archivedMembers: lifecycleStatusCounts[MemberLifecycleStatus.ARCHIVED],
        alumniMembers: lifecycleStatusCounts[MemberLifecycleStatus.ALUMNI],
        upcomingEvents: upcomingEventCount,
        attendanceNeedingReview: attendanceNeedingReview.length,
        attendanceParticipationCoveragePercent: recentAttendanceTrend.coveragePercent,
        attendanceParticipationEventsReviewed: recentAttendanceTrend.reviewedEventCount,
        unresolvedFollowUps: unresolvedFollowUpCount,
        overdueTasks: overdueTaskCount,
        blockedTasks: blockedTaskCount,
        staleUnreviewedTasks: staleUnreviewedTaskCount,
        recentNotes: recentNoteCount,
        recentOperationalChanges: recentOperationalHistory.length,
        pendingFieldOpsApprovals: pendingFieldOpsApprovalsCount,
        fieldOpsUpcomingReservations: fieldOpsUpcomingReservationsCount,
        fieldOpsActiveResources: fieldOpsActiveResourceCount,
        fieldOpsAvailableResources: fieldOpsAvailableResourceCount,
        fieldOpsReadinessConcerns: fieldOpsReadinessConcernCount,
        gearVisibleItems: gearVisibleItemCount,
        gearDurableItems: gearDurableItemCount,
        gearConsumableItems: gearConsumableItemCount,
        gearAssignedOrCheckedOutItems: gearAssignedOrCheckedOutItemCount,
        gearMaintenanceItems: gearMaintenanceItemCount,
        gearConditionConcerns: gearConditionConcernItemCount,
        gearActiveAssignments: gearActiveAssignmentCount,
        gearOpenCheckouts: gearOpenCheckoutCount,
        lowAvailabilityConsumables: lowAvailabilityConsumableCount,
        consumableUsageUnits30d,
        consumableReplenishmentUnits30d,
        consumableNetDelta30d,
        gearReadinessConcerns: gearReadinessConcernCount,
        athletesMissingGuardianLinkage: athletesMissingGuardianLinkageCount,
        teamsWithOperationalGaps: teamOperationalGaps.length,
        missingResponsibleFollowUps: missingResponsibleFollowUpCount + eventsMissingResponsibleTeam.length,
        lifecycleActive: lifecycleStatusCounts[MemberLifecycleStatus.ACTIVE],
        lifecycleProspect: lifecycleStatusCounts[MemberLifecycleStatus.PROSPECT],
        lifecycleInactive: lifecycleStatusCounts[MemberLifecycleStatus.INACTIVE],
        lifecycleArchived: lifecycleStatusCounts[MemberLifecycleStatus.ARCHIVED],
        lifecycleAlumni: lifecycleStatusCounts[MemberLifecycleStatus.ALUMNI],
        activeWithoutRosterMembership: activeMembersWithoutRosterMembershipCount,
      },
      lifecycleStatusCounts,
      upcomingEvents,
      attendanceNeedingReview,
      recentAttendanceTrend,
      upcomingEventReadiness,
      overdueTasks: sortOpenTasks(overdueTasks),
      blockedTasks,
      staleUnreviewedTasks: sortOpenTasks(staleUnreviewedTasks),
      tasksMissingResponsibleContext: sortOpenTasks(missingResponsibleFollowUps),
      recentNotes,
      athletesMissingGuardianLinkage,
      teamOperationalGaps,
      pendingFieldOpsApprovals,
      upcomingFieldOpsReservations: fieldOpsUpcomingReservations,
      lowAvailabilityConsumables,
      openGearCheckouts,
      recentConsumableTransactions,
      recentOperationalHistory,
      unresolvedOperationalHistory,
      operationalAwarenessView: buildOperationalAwarenessView(combinedOperationalHistory),
      operationalSummaryClassificationView,
      operationalReadinessEvaluationView,
      operationalIntelligenceAwarenessView,
      unresolvedEventConcerns,
      notesNeedingAttention,
      eventsMissingResponsibleTeam,
      activeMembersWithoutRosterMembership,
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

          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-medium">Roster lifecycle readiness</h3>
              <Link href="/people" className="text-sm underline">
                Open people
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Lifecycle mix in current scope: Active {dashboardData.lifecycleStatusCounts[MemberLifecycleStatus.ACTIVE]} ·
              Prospect {dashboardData.lifecycleStatusCounts[MemberLifecycleStatus.PROSPECT]} · Inactive{" "}
              {dashboardData.lifecycleStatusCounts[MemberLifecycleStatus.INACTIVE]} · Archived{" "}
              {dashboardData.lifecycleStatusCounts[MemberLifecycleStatus.ARCHIVED]} · Alumni{" "}
              {dashboardData.lifecycleStatusCounts[MemberLifecycleStatus.ALUMNI]}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Active members with no roster membership in current scope:{" "}
              {dashboardData.counts.activeWithoutRosterMembership}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link href="/teams?readiness=needs_attention" className="rounded-full border px-2 py-1">
                Team roster readiness
              </Link>
              <Link href="/programs" className="rounded-full border px-2 py-1">
                Program/season context
              </Link>
              <Link href="/people" className="rounded-full border px-2 py-1">
                Member lifecycle + guardian context
              </Link>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {dashboardData.activeMembersWithoutRosterMembership.length === 0 ? (
                <p className="text-zinc-600 dark:text-zinc-400">
                  No active members are currently missing roster membership context.
                </p>
              ) : (
                dashboardData.activeMembersWithoutRosterMembership.map((person) => (
                  <p key={person.id}>
                    <Link href={`/people/${person.id}`} className="underline">
                      {person.firstName} {person.lastName}
                    </Link>
                  </p>
                ))
              )}
            </div>
          </div>

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
              { label: "Active members", value: dashboardData.counts.activeMembers, href: "/people" },
              { label: "Prospects", value: dashboardData.counts.prospectMembers, href: "/people" },
              { label: "Inactive members", value: dashboardData.counts.inactiveMembers, href: "/people" },
              { label: "Archived members", value: dashboardData.counts.archivedMembers, href: "/people" },
              { label: "Alumni", value: dashboardData.counts.alumniMembers, href: "/people" },
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
                label: "Attendance participation coverage",
                value: dashboardData.counts.attendanceParticipationCoveragePercent,
                href: "/events?operationalIndicator=attendance_not_reviewed_recently",
                sublabel: `${dashboardData.counts.attendanceParticipationEventsReviewed} recent past team events reviewed (%)`,
              },
              {
                label: "Open follow-up tasks",
                value: dashboardData.counts.unresolvedFollowUps,
                href: "/tasks?resolution=unresolved",
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
              {
                label: "Recent operational activity",
                value: dashboardData.counts.recentOperationalChanges,
                href: "#recent-operational-history",
                sublabel: `Last ${RECENT_OPERATIONAL_CHANGE_WINDOW_DAYS} days`,
              },
              ...(canViewOrganizationLevelFieldOpsApprovals
                ? [
                    {
                      label: "FieldOps pending approvals",
                      value: dashboardData.counts.pendingFieldOpsApprovals,
                      href: "/field-ops/bookings?approvalStatus=PENDING",
                    },
                    {
                      label: "FieldOps upcoming reservations",
                      value: dashboardData.counts.fieldOpsUpcomingReservations,
                      href: "/field-ops/bookings?timeframe=upcoming",
                    },
                    {
                      label: "FieldOps active resources",
                      value: dashboardData.counts.fieldOpsActiveResources,
                      href: "/field-ops/resources",
                    },
                    {
                      label: "FieldOps available resources",
                      value: dashboardData.counts.fieldOpsAvailableResources,
                      href: "/field-ops/resources",
                    },
                    {
                      label: "FieldOps readiness concerns",
                      value: dashboardData.counts.fieldOpsReadinessConcerns,
                      href: "/field-ops",
                    },
                  ]
                : []),
              ...(canViewGearOpsReporting
                ? [
                    {
                      label: "GearOps visible items",
                      value: dashboardData.counts.gearVisibleItems,
                      href: "/gear-ops/items",
                    },
                    {
                      label: "GearOps active assignments",
                      value: dashboardData.counts.gearActiveAssignments,
                      href: "/gear-ops/items",
                    },
                    {
                      label: "GearOps open checkouts",
                      value: dashboardData.counts.gearOpenCheckouts,
                      href: "/gear-ops/items",
                    },
                    {
                      label: "GearOps low-availability consumables",
                      value: dashboardData.counts.lowAvailabilityConsumables,
                      href: "/gear-ops/items?inventoryType=CONSUMABLE",
                    },
                    {
                      label: "GearOps readiness concerns",
                      value: dashboardData.counts.gearReadinessConcerns,
                      href: "/gear-ops",
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
              {
                label: "Active members with no roster membership",
                value: dashboardData.counts.activeWithoutRosterMembership,
                href: "/people",
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
                            <Link href={appendReturnToParam(`/notes/new?eventId=${event.id}`, "/dashboard")} className="underline">
                              Capture event note
                            </Link>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">Attendance and event reporting</h3>
                <Link href="/events?operationalIndicator=attendance_not_reviewed_recently" className="text-sm underline">
                  Open review lanes
                </Link>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <p className="text-sm font-medium">Recent attendance trend</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Coverage: {dashboardData.recentAttendanceTrend.coveragePercent}% across{" "}
                    {dashboardData.recentAttendanceTrend.reviewedEventCount} recent team events.
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Complete {dashboardData.recentAttendanceTrend.completeEvents} · Partial{" "}
                    {dashboardData.recentAttendanceTrend.partialEvents} · Missing{" "}
                    {dashboardData.recentAttendanceTrend.missingEvents}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {dashboardData.recentAttendanceTrend.trendDirection === "insufficient_data"
                      ? "Need more attendance history before a directional trend can be shown."
                      : dashboardData.recentAttendanceTrend.trendDirection === "up"
                        ? `Improving versus prior review window (${dashboardData.recentAttendanceTrend.priorCoveragePercent}% → ${dashboardData.recentAttendanceTrend.recentCoveragePercent}%).`
                        : dashboardData.recentAttendanceTrend.trendDirection === "down"
                          ? `Declining versus prior review window (${dashboardData.recentAttendanceTrend.priorCoveragePercent}% → ${dashboardData.recentAttendanceTrend.recentCoveragePercent}%).`
                          : `Steady versus prior review window (${dashboardData.recentAttendanceTrend.recentCoveragePercent}%).`}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <p className="text-sm font-medium">Upcoming event readiness</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {dashboardData.upcomingEventReadiness.length} events in the next {EVENT_REVIEW_LOOKAHEAD_DAYS} days.
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Events needing readiness review:{" "}
                    {
                      dashboardData.upcomingEventReadiness.filter(
                        (event) => event.noResponseCount > 0 || event.openTaskCount > 0,
                      ).length
                    }
                    {" · "}No-response roster members:{" "}
                    {dashboardData.upcomingEventReadiness.reduce(
                      (count, event) => count + event.noResponseCount,
                      0,
                    )}
                  </p>
                  {dashboardData.upcomingEventReadiness.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      No upcoming events are currently within the readiness review window.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {dashboardData.upcomingEventReadiness.length === 0
                  ? renderEmptyList("No upcoming readiness items are currently available.")
                  : dashboardData.upcomingEventReadiness.map((event) => (
                      <div key={event.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <Link href={`/events/${event.id}`} className="font-medium underline">
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(event.startsAt)} · {event.program.name}
                          {event.team ? ` · Team: ${event.team.name}` : " · Team: Unassigned"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          No response: {event.noResponseCount} · Open tasks: {event.openTaskCount} · Going / maybe / not going:{" "}
                          {event.goingCount} / {event.maybeCount} / {event.notGoingCount}
                        </p>
                      </div>
                    ))}
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
                          <span className="text-zinc-500 dark:text-zinc-400">•</span>
                          <Link href={appendReturnToParam(`/tasks/new?sourceEventId=${event.id}`, "/dashboard")} className="underline">
                            Create follow-up task
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

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">FieldOps operational summary</h3>
                {canViewOrganizationLevelFieldOpsApprovals ? (
                  <Link href="/field-ops" className="text-sm underline">
                    Open FieldOps
                  </Link>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Upcoming reservations:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.fieldOpsUpcomingReservations}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Active resources:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.fieldOpsActiveResources}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Available resources:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.fieldOpsAvailableResources}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Readiness concerns:{" "}
                  <span className={dashboardData.counts.fieldOpsReadinessConcerns > 0 ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-zinc-900 dark:text-zinc-100"}>
                    {dashboardData.counts.fieldOpsReadinessConcerns}
                  </span>
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {!canViewOrganizationLevelFieldOpsApprovals
                  ? renderEmptyList(
                      "FieldOps operational summary remains organization-scoped until staff-safe non-org visibility rules are defined.",
                    )
                  : dashboardData.upcomingFieldOpsReservations.length === 0
                  ? renderEmptyList("No upcoming FieldOps reservations are currently scheduled.")
                  : dashboardData.upcomingFieldOpsReservations.map((booking) => (
                      <div key={booking.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <Link href={`/field-ops/bookings/${booking.id}`} className="font-medium underline">
                          {booking.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(booking.startsAt)} · {formatEnumLabel(booking.status)} · Approval{" "}
                          {formatEnumLabel(booking.approvalStatus)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {booking.facility.name} · {booking.resource.name}
                        </p>
                      </div>
                    ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-medium">GearOps operational summary</h3>
                {canViewGearOpsReporting ? (
                  <Link href="/gear-ops" className="text-sm underline">
                    Open GearOps
                  </Link>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Visible gear items:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{dashboardData.counts.gearVisibleItems}</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Durable / consumable:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.gearDurableItems} / {dashboardData.counts.gearConsumableItems}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Assigned or checked out items:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.gearAssignedOrCheckedOutItems}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Active assignment records:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{dashboardData.counts.gearActiveAssignments}</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Open checkout records:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{dashboardData.counts.gearOpenCheckouts}</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Maintenance lifecycle items:{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{dashboardData.counts.gearMaintenanceItems}</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Condition concerns:{" "}
                  <span className={dashboardData.counts.gearConditionConcerns > 0 ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-zinc-900 dark:text-zinc-100"}>
                    {dashboardData.counts.gearConditionConcerns}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Low-availability consumables:{" "}
                  <span className={dashboardData.counts.lowAvailabilityConsumables > 0 ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-zinc-900 dark:text-zinc-100"}>
                    {dashboardData.counts.lowAvailabilityConsumables}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Consumable usage (30d):{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.consumableUsageUnits30d} units
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Consumable replenishment (30d):{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dashboardData.counts.consumableReplenishmentUnits30d} units
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Consumable net delta (30d):{" "}
                  <span className={dashboardData.counts.consumableNetDelta30d < 0 ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-zinc-900 dark:text-zinc-100"}>
                    {dashboardData.counts.consumableNetDelta30d > 0 ? "+" : ""}
                    {dashboardData.counts.consumableNetDelta30d}
                  </span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Readiness concerns:{" "}
                  <span className={dashboardData.counts.gearReadinessConcerns > 0 ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-zinc-900 dark:text-zinc-100"}>
                    {dashboardData.counts.gearReadinessConcerns}
                  </span>
                </p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Low-availability consumables</h4>
                    <Link href="/gear-ops/items?inventoryType=CONSUMABLE" className="text-xs underline">
                      Open consumables
                    </Link>
                  </div>
                  {dashboardData.lowAvailabilityConsumables.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      No low-availability consumables are currently visible.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {dashboardData.lowAvailabilityConsumables.slice(0, 3).map((item) => (
                        <li key={item.id} className="rounded-md border p-2">
                          <Link href={`/gear-ops/items/${item.id}`} className="font-medium underline">
                            {item.name}
                          </Link>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            On hand {item.quantityOnHand} · Min {item.quantityMin ?? "—"}
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            Program: {item.program ? <Link href={`/programs/${item.program.id}`} className="underline">{item.program.name}</Link> : "Unassigned"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Open custody checkouts</h4>
                    <Link href="/gear-ops/items" className="text-xs underline">
                      Open items
                    </Link>
                  </div>
                  {dashboardData.openGearCheckouts.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      No open checkout records are currently visible.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {dashboardData.openGearCheckouts.slice(0, 3).map((checkout) => (
                        <li key={checkout.id} className="rounded-md border p-2">
                          <Link href={`/gear-ops/items/${checkout.gearItem.id}`} className="font-medium underline">
                            {checkout.gearItem.name}
                          </Link>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            {formatDateTime(checkout.checkedOutAt)} · {formatEnumLabel(checkout.status)}
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            Checked out by{" "}
                            <Link href={`/people/${checkout.checkedOutBy.id}`} className="underline">
                              {checkout.checkedOutBy.firstName} {checkout.checkedOutBy.lastName}
                            </Link>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">Recent consumable activity</h4>
                    <Link href="/gear-ops/items?inventoryType=CONSUMABLE" className="text-xs underline">
                      Open transactions
                    </Link>
                  </div>
                  {dashboardData.recentConsumableTransactions.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      No recent consumable transactions were recorded in the last 30 days.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {dashboardData.recentConsumableTransactions.slice(0, 3).map((transaction) => (
                        <li key={transaction.id} className="rounded-md border p-2">
                          <Link href={`/gear-ops/items/${transaction.gearItem.id}`} className="font-medium underline">
                            {transaction.gearItem.name}
                          </Link>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            {formatDateTime(transaction.recordedAt)} · {formatEnumLabel(transaction.transactionType)}
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-400">
                            Quantity delta: {transaction.quantityDelta > 0 ? "+" : ""}
                            {transaction.quantityDelta}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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

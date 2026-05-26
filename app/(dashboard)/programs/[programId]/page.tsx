import {
  ApprovalStatus,
  BookingStatus,
  ConsumableTransactionType,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  MemberLifecycleStatus,
  Prisma,
  ScopeType,
  TaskStatus,
} from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import {
  summarizeAttendanceParticipation,
  summarizeAttendanceTrend,
  summarizeRsvpReadiness,
} from "@/lib/attendance-event-reporting";
import { canReadStaffOnlyContent, resolveActorRoleContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { isTaskOverdue, isUnresolvedTaskStatus } from "@/lib/follow-up-tasks";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  buildSupportedTaskSourceNoteVisibilityWhere,
  SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
} from "@/lib/operational-visibility";
import { canPerformAction } from "@/lib/permissions";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";

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

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ProgramDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { programId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();
  const rolloverSuccess = readSearchParam(resolvedSearchParams, "rolloverSuccess");

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query program details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewAttendanceReporting = canReadStaffOnlyContent(actorRoleContext);

  let queryFailed = false;
  let program:
    | {
        id: string;
        name: string;
        organization: { id: string; name: string };
        teams: Array<{ id: string; name: string }>;
        seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        roles: Array<{
          id: string;
          roleType: string;
          person: { id: string; firstName: string; lastName: string };
        }>;
      }
    | null = null;

  try {
    program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: scope.organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
          orderBy: [{ name: "asc" }],
        },
        seasons: {
          where: {
            organizationId: scope.organizationId,
          },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        },
        roles: {
          where: {
            scopeType: ScopeType.PROGRAM,
          },
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [{ roleType: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load program details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!program) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Program not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const canAccessSeasonRollover =
    scope.auth.clerkUserId &&
    (await canPerformAction({
      actorUserId: scope.auth.clerkUserId,
      organizationId: scope.organizationId,
      action: "season.rollover",
      programId: program.id,
    }));

  const selectedSeason = selectSeededOrCurrentSeason(program.seasons);
  const hasNoSeasonConfigured = program.seasons.length === 0;
  const selectedSeasonRoster = selectedSeason
    ? await db.rosterMembership.findMany({
        where: {
          organizationId: scope.organizationId,
          seasonId: selectedSeason.id,
          team: {
            programId: program.id,
          },
        },
        select: {
          id: true,
          teamId: true,
          rosterRole: true,
          personId: true,
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              lifecycleStatus: true,
              athleteLinks: {
                where: {
                  organizationId: scope.organizationId,
                },
                select: {
                  id: true,
                },
                take: 1,
              },
            },
          },
        },
      })
    : [];
  const selectedSeasonRosterUniqueMembers = Array.from(
    selectedSeasonRoster.reduce(
      (membersByPersonId, membership) => {
        if (!membersByPersonId.has(membership.personId)) {
          membersByPersonId.set(membership.personId, membership);
        }
        return membersByPersonId;
      },
      new Map<string, (typeof selectedSeasonRoster)[number]>(),
    ).values(),
  );
  const selectedSeasonLifecycleCounts = Object.values(MemberLifecycleStatus).reduce(
    (counts, status) => {
      counts[status] = selectedSeasonRosterUniqueMembers.filter(
        (membership) => membership.person.lifecycleStatus === status,
      ).length;
      return counts;
    },
    {} as Record<MemberLifecycleStatus, number>,
  );
  const selectedSeasonRosterPersonIds = new Set(
    selectedSeasonRosterUniqueMembers.map((membership) => membership.personId),
  );
  const selectedSeasonAthleteRoster = selectedSeasonRosterUniqueMembers.filter(
    (membership) => membership.rosterRole === "ATHLETE",
  );
  const selectedSeasonAthletesMissingGuardianLinkageMembers = selectedSeasonAthleteRoster.filter(
    (membership) => membership.person.athleteLinks.length === 0,
  );
  const selectedSeasonAthletesMissingGuardianLinkage = selectedSeasonAthletesMissingGuardianLinkageMembers.length;
  const selectedSeasonMembersWithoutActiveLifecycleMembers = selectedSeasonRosterUniqueMembers.filter(
    (membership) => membership.person.lifecycleStatus !== MemberLifecycleStatus.ACTIVE,
  );
  const selectedSeasonMembersWithoutActiveLifecycle = selectedSeasonMembersWithoutActiveLifecycleMembers.length;
  const selectedSeasonLifecycleOperationalGapCount =
    selectedSeasonAthletesMissingGuardianLinkage + selectedSeasonMembersWithoutActiveLifecycle;
  const selectedSeasonRosterByTeamId = selectedSeasonRoster.reduce(
    (rosterByTeamId, membership) => {
      const personIds = rosterByTeamId.get(membership.teamId) ?? new Set<string>();
      personIds.add(membership.personId);
      rosterByTeamId.set(membership.teamId, personIds);
      return rosterByTeamId;
    },
    new Map<string, Set<string>>(),
  );
  const now = new Date();
  const staleNoteCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const recentNoteThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const programTaskWhere: Prisma.FollowUpTaskWhereInput = {
    organizationId: scope.organizationId,
    ...buildSupportedTaskSourceNoteVisibilityWhere(),
    OR: [
      { sourceEvent: { is: { programId: program.id } } },
      { sourceNote: { is: { team: { is: { programId: program.id } } } } },
      { sourceNote: { is: { event: { is: { programId: program.id } } } } },
    ],
  };
  const programNoteWhere: Prisma.ObservationNoteWhereInput = {
    organizationId: scope.organizationId,
    visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
    OR: [
      { team: { is: { programId: program.id } } },
      { event: { is: { programId: program.id } } },
    ],
  };
  const programGearItemWhere: Prisma.GearItemWhereInput = {
    organizationId: scope.organizationId,
    OR: [
      { programId: program.id },
      { assignments: { some: { assignedTeam: { is: { programId: program.id } } } } },
      { assignments: { some: { assignedEvent: { is: { programId: program.id } } } } },
      { checkouts: { some: { event: { is: { programId: program.id } } } } },
      { consumableTransactions: { some: { event: { is: { programId: program.id } } } } },
    ],
  };
  const [recentProgramEvents, upcomingProgramEvents] = canViewAttendanceReporting
    ? await Promise.all([
        db.event.findMany({
          where: {
            organizationId: scope.organizationId,
            programId: program.id,
            startsAt: { lt: now },
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true,
            teamId: true,
            team: { select: { id: true, name: true } },
            attendance: {
              select: {
                personId: true,
                status: true,
              },
            },
            rsvps: {
              select: {
                personId: true,
                status: true,
              },
            },
            tasks: {
              select: {
                status: true,
              },
            },
          },
          orderBy: [{ startsAt: "desc" }],
          take: 6,
        }),
        db.event.findMany({
          where: {
            organizationId: scope.organizationId,
            programId: program.id,
            startsAt: { gte: now },
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true,
            teamId: true,
            team: { select: { id: true, name: true } },
            attendance: {
              select: {
                personId: true,
                status: true,
              },
            },
            rsvps: {
              select: {
                personId: true,
                status: true,
              },
            },
            tasks: {
              select: {
                status: true,
              },
            },
          },
          orderBy: [{ startsAt: "asc" }],
          take: 6,
        }),
      ])
    : [[], []];
  const [
    unresolvedProgramTasks,
    unresolvedProgramTaskOwnership,
    overdueProgramTaskCount,
    unresolvedProgramTaskCount,
    programTaskStatusGroups,
    recentProgramNotes,
    totalProgramNoteCount,
  ] = canViewAttendanceReporting
    ? await Promise.all([
        db.followUpTask.findMany({
          where: {
            AND: [
              programTaskWhere,
              {
                status: {
                  in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
                },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            sourceEvent: {
              select: {
                id: true,
                title: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            sourceNote: {
              select: {
                id: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                event: {
                  select: {
                    id: true,
                    team: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            updatedAt: true,
          },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 8,
        }),
        db.followUpTask.findMany({
          where: {
            AND: [
              programTaskWhere,
              {
                status: {
                  in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
                },
              },
            ],
          },
          select: {
            dueAt: true,
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        db.followUpTask.count({
          where: {
            AND: [
              programTaskWhere,
              {
                status: {
                  in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
                },
                dueAt: { lt: now },
              },
            ],
          },
        }),
        db.followUpTask.count({
          where: {
            AND: [
              programTaskWhere,
              {
                status: {
                  in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
                },
              },
            ],
          },
        }),
        db.followUpTask.groupBy({
          by: ["status"],
          where: programTaskWhere,
          _count: {
            _all: true,
          },
        }),
        db.observationNote.findMany({
          where: {
            ...programNoteWhere,
            createdAt: {
              gte: recentNoteThreshold,
            },
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            body: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            tasks: {
              select: {
                status: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 8,
        }),
        db.observationNote.count({
          where: programNoteWhere,
        }),
      ])
    : [[], [], 0, 0, [], [], 0];
  const programAttendanceTrend = summarizeAttendanceTrend(
    recentProgramEvents.map((event) => ({
      startsAt: event.startsAt,
      expectedPersonIds: [...(event.teamId ? selectedSeasonRosterByTeamId.get(event.teamId) ?? new Set<string>() : new Set<string>())],
      attendanceRecords: event.attendance,
    })),
  );
  const recentProgramAttendanceEntries = recentProgramEvents.map((event) => {
    const expectedPersonIds = [
      ...(event.teamId ? selectedSeasonRosterByTeamId.get(event.teamId) ?? new Set<string>() : new Set<string>()),
    ];

    return {
      ...event,
      attendanceSummary: summarizeAttendanceParticipation({
        expectedPersonIds,
        attendanceRecords: event.attendance,
      }),
      rsvpSummary: summarizeRsvpReadiness({
        expectedPersonIds,
        rsvps: event.rsvps,
      }),
    };
  });
  const upcomingProgramReadinessEntries = upcomingProgramEvents.map((event) => {
    const expectedPersonIds = [
      ...(event.teamId ? selectedSeasonRosterByTeamId.get(event.teamId) ?? new Set<string>() : new Set<string>()),
    ];
    const rsvpSummary = summarizeRsvpReadiness({
      expectedPersonIds,
      rsvps: event.rsvps,
    });
    const openTaskCount = event.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;

    return {
      ...event,
      rsvpSummary,
      openTaskCount,
      readinessConcernCount: rsvpSummary.noResponseCount + openTaskCount,
    };
  });
  const upcomingProgramNoResponseCount = upcomingProgramReadinessEntries.reduce(
    (count, event) => count + event.rsvpSummary.noResponseCount,
    0,
  );
  const upcomingProgramReadinessConcernCount = upcomingProgramReadinessEntries.filter(
    (event) => event.readinessConcernCount > 0,
  ).length;
  const unresolvedTaskCountsByStatus = Object.values(TaskStatus).reduce(
    (statusCounts, status) => {
      statusCounts[status] = 0;
      return statusCounts;
    },
    {} as Record<TaskStatus, number>,
  );
  for (const statusGroup of programTaskStatusGroups) {
    unresolvedTaskCountsByStatus[statusGroup.status] = statusGroup._count._all;
  }
  const overdueProgramTasks = unresolvedProgramTasks.filter((task) => isTaskOverdue(task, now));
  const recentProgramNotesWithUnresolved = recentProgramNotes.filter((note) =>
    note.tasks.some((task) => isUnresolvedTaskStatus(task.status)),
  );
  const notesNeedingReviewCount = recentProgramNotes.filter((note) => {
    const unresolvedTaskCount = note.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;
    return unresolvedTaskCount > 0 && note.updatedAt.getTime() < staleNoteCutoff.getTime();
  }).length;
  const ownershipSummary = Array.from(
    unresolvedProgramTaskOwnership.reduce(
      (summaryByAssignee, task) => {
        const currentSummary = summaryByAssignee.get(task.assignee.id) ?? {
          assigneeId: task.assignee.id,
          assigneeName: `${task.assignee.firstName} ${task.assignee.lastName}`,
          unresolvedCount: 0,
          overdueCount: 0,
        };
        currentSummary.unresolvedCount += 1;
        if (task.dueAt && task.dueAt.getTime() < now.getTime()) {
          currentSummary.overdueCount += 1;
        }
        summaryByAssignee.set(task.assignee.id, currentSummary);
        return summaryByAssignee;
      },
      new Map<
        string,
        { assigneeId: string; assigneeName: string; unresolvedCount: number; overdueCount: number }
      >(),
    ).values(),
  )
    .sort((left, right) => {
      if (right.unresolvedCount !== left.unresolvedCount) {
        return right.unresolvedCount - left.unresolvedCount;
      }
      if (right.overdueCount !== left.overdueCount) {
        return right.overdueCount - left.overdueCount;
      }
      return left.assigneeName.localeCompare(right.assigneeName);
    })
    .slice(0, 5);
  const [
    programFieldOpsBookingCount,
    programFieldOpsPendingApprovals,
    programFieldOpsConflicts,
    programFieldOpsUpcomingBookings,
    programGearVisibleItemCount,
    programGearDurableCount,
    programGearConsumableCount,
    programGearAssignedOrCheckedOutCount,
    programGearMaintenanceCount,
    programGearConditionConcernCount,
    programGearActiveAssignmentCount,
    programGearOpenCheckoutCount,
    programGearLowAvailabilityConsumableCount,
    programGearLowAvailabilityConsumables,
    programConsumableUsageAggregate30d,
    programConsumableReplenishmentAggregate30d,
  ] =
    canViewAttendanceReporting
      ? await Promise.all([
          db.resourceBooking.count({
            where: {
              organizationId: scope.organizationId,
              programId: program.id,
            },
          }),
          db.resourceBooking.count({
            where: {
              organizationId: scope.organizationId,
              programId: program.id,
              approvalStatus: ApprovalStatus.PENDING,
            },
          }),
          db.resourceBooking.count({
            where: {
              organizationId: scope.organizationId,
              programId: program.id,
              conflicts: {
                some: {},
              },
            },
          }),
          db.resourceBooking.findMany({
            where: {
              organizationId: scope.organizationId,
              programId: program.id,
              startsAt: {
                gte: now,
              },
              status: {
                notIn: [BookingStatus.DENIED, BookingStatus.CANCELED],
              },
            },
            select: {
              id: true,
              title: true,
              startsAt: true,
              approvalStatus: true,
              status: true,
              facility: { select: { id: true, name: true } },
              resource: { select: { id: true, name: true } },
            },
            orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
            take: 5,
          }),
          db.gearItem.count({
            where: programGearItemWhere,
          }),
          db.gearItem.count({
            where: {
              ...programGearItemWhere,
              inventoryType: GearInventoryType.DURABLE,
            },
          }),
          db.gearItem.count({
            where: {
              ...programGearItemWhere,
              inventoryType: GearInventoryType.CONSUMABLE,
            },
          }),
          db.gearItem.count({
            where: {
              ...programGearItemWhere,
              lifecycleStatus: { in: [GearItemLifecycleStatus.ASSIGNED, GearItemLifecycleStatus.CHECKED_OUT] },
            },
          }),
          db.gearItem.count({
            where: {
              ...programGearItemWhere,
              lifecycleStatus: GearItemLifecycleStatus.MAINTENANCE,
            },
          }),
          db.gearItem.count({
            where: {
              ...programGearItemWhere,
              conditionStatus: { in: [GearConditionStatus.POOR, GearConditionStatus.DAMAGED] },
            },
          }),
          db.gearAssignment.count({
            where: {
              organizationId: scope.organizationId,
              status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] },
              gearItem: { is: programGearItemWhere },
            },
          }),
          db.gearCheckout.count({
            where: {
              organizationId: scope.organizationId,
              status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
              gearItem: { is: programGearItemWhere },
            },
          }),
          db.gearItem.count({
            where: {
              ...programGearItemWhere,
              inventoryType: GearInventoryType.CONSUMABLE,
              quantityMin: { not: null },
              quantityOnHand: { lte: db.gearItem.fields.quantityMin },
            },
          }),
          db.gearItem.findMany({
            where: {
              ...programGearItemWhere,
              inventoryType: GearInventoryType.CONSUMABLE,
              quantityMin: { not: null },
              quantityOnHand: { lte: db.gearItem.fields.quantityMin },
            },
            select: {
              id: true,
              name: true,
              quantityOnHand: true,
              quantityMin: true,
            },
            orderBy: [{ quantityOnHand: "asc" }, { updatedAt: "asc" }],
            take: 5,
          }),
          db.consumableTransaction.aggregate({
            where: {
              organizationId: scope.organizationId,
              recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
              gearItem: { is: programGearItemWhere },
              transactionType: {
                in: [
                  ConsumableTransactionType.USED,
                  ConsumableTransactionType.DISTRIBUTED,
                  ConsumableTransactionType.DISPOSED,
                ],
              },
            },
            _sum: {
              quantityDelta: true,
            },
          }),
          db.consumableTransaction.aggregate({
            where: {
              organizationId: scope.organizationId,
              recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
              gearItem: { is: programGearItemWhere },
              transactionType: {
                in: [ConsumableTransactionType.RECEIVED],
              },
            },
            _sum: {
              quantityDelta: true,
            },
          }),
        ])
      : [0, 0, 0, [], 0, 0, 0, 0, 0, 0, 0, 0, 0, [], { _sum: { quantityDelta: 0 } }, { _sum: { quantityDelta: 0 } }];
  const programFieldOpsResourcesInUse = new Set(programFieldOpsUpcomingBookings.map((booking) => booking.resource.id)).size;
  const programFieldOpsReadinessConcerns = programFieldOpsPendingApprovals + programFieldOpsConflicts;
  const programConsumableUsageUnits30d = Math.abs(programConsumableUsageAggregate30d._sum.quantityDelta ?? 0);
  const programConsumableReplenishmentUnits30d = Math.max(programConsumableReplenishmentAggregate30d._sum.quantityDelta ?? 0, 0);
  const programConsumableNetDelta30d = programConsumableReplenishmentUnits30d - programConsumableUsageUnits30d;
  const programGearReadinessConcerns =
    programGearMaintenanceCount +
    programGearConditionConcernCount +
    programGearLowAvailabilityConsumableCount +
    programGearOpenCheckoutCount;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/programs" label="Programs" />
        <h2 className="text-2xl font-semibold tracking-tight">{program.name}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Organization: {program.organization.name}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/programs/${program.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit program
          </Link>
          <Link
            href={`/programs/${program.id}/seasons/new`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            New season
          </Link>
        </div>
      </div>

      {rolloverSuccess ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{rolloverSuccess}</p>
        </div>
      ) : null}

      {hasNoSeasonConfigured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">No season has been created yet.</p>
          <Link href={`/programs/${program.id}/seasons/new`} className="mt-2 inline-block text-sm underline">
            Create the first season
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-2 text-lg font-medium">Roster lifecycle readiness</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Selected season: {selectedSeason?.name ?? "No season available"}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Unique roster members in selected season: {selectedSeasonRosterPersonIds.size}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Lifecycle mix: Active {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ACTIVE]} · Prospect{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.PROSPECT]} · Inactive{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.INACTIVE]} · Archived{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ARCHIVED]} · Alumni{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ALUMNI]}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Athlete rows missing guardian linkage in selected season: {selectedSeasonAthletesMissingGuardianLinkage}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Selected-season roster members not currently Active: {selectedSeasonMembersWithoutActiveLifecycle}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Lifecycle operational gaps in selected season: {selectedSeasonLifecycleOperationalGapCount}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/people" className="rounded-full border px-2 py-1">
            People lifecycle and guardian context
          </Link>
          <Link href="/teams?readiness=needs_attention" className="rounded-full border px-2 py-1">
            Team readiness lane
          </Link>
        </div>
        {selectedSeasonAthletesMissingGuardianLinkageMembers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No athlete guardian-linkage gaps are currently detected for the selected season.
          </p>
        ) : (
          <div className="mt-3">
            <h4 className="text-sm font-medium">Athletes missing guardian linkage (selected season)</h4>
            <ul className="mt-2 space-y-1 text-sm">
              {selectedSeasonAthletesMissingGuardianLinkageMembers.slice(0, 5).map((membership) => (
                <li key={membership.person.id}>
                  <Link href={`/people/${membership.person.id}#relationship-summary`} className="underline">
                    {membership.person.firstName} {membership.person.lastName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {selectedSeasonMembersWithoutActiveLifecycleMembers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            All selected-season roster members are currently Active in lifecycle status.
          </p>
        ) : (
          <div className="mt-3">
            <h4 className="text-sm font-medium">Roster members not currently Active (selected season)</h4>
            <ul className="mt-2 space-y-1 text-sm">
              {selectedSeasonMembersWithoutActiveLifecycleMembers.slice(0, 5).map((membership) => (
                <li key={`${membership.person.id}-${membership.person.lifecycleStatus}`}>
                  <Link href={`/people/${membership.person.id}`} className="underline">
                    {membership.person.firstName} {membership.person.lastName}
                  </Link>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {" "}
                    · {formatEnumLabel(membership.person.lifecycleStatus)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {selectedSeasonRosterUniqueMembers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No selected-season roster members are available for lifecycle/guardian readiness review.
          </p>
        ) : null}
      </div>

      {canViewAttendanceReporting ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">Notes and follow-up operational review</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Staff-scoped, read-only workload visibility for unresolved follow-up, ownership, and review readiness in
                current program context.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/tasks?resolution=unresolved" className="rounded-full border px-2 py-1">
                Unresolved task lane
              </Link>
              <Link href="/tasks?dueWindow=overdue" className="rounded-full border px-2 py-1">
                Overdue follow-up lane
              </Link>
              <Link href="/notes?readinessIndicator=needs_review" className="rounded-full border px-2 py-1">
                Notes needing review
              </Link>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-medium">Open follow-up tasks</dt>
              <dd className={unresolvedProgramTaskCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {unresolvedProgramTaskCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Overdue follow-up tasks</dt>
              <dd className={overdueProgramTaskCount > 0 ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}>
                {overdueProgramTaskCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Recent notes (30 days)</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{recentProgramNotes.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Recent notes with unresolved follow-up</dt>
              <dd className={recentProgramNotesWithUnresolved.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {recentProgramNotesWithUnresolved.length}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Total program notes</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{totalProgramNoteCount}</dd>
            </div>
            <div>
              <dt className="font-medium">Operational review readiness concerns</dt>
              <dd className={notesNeedingReviewCount + overdueProgramTaskCount + upcomingProgramReadinessConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {notesNeedingReviewCount + overdueProgramTaskCount + upcomingProgramReadinessConcernCount}
              </dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <h4 className="text-sm font-medium">Task status summary</h4>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <li>Open: {unresolvedTaskCountsByStatus[TaskStatus.OPEN]}</li>
                <li>In progress: {unresolvedTaskCountsByStatus[TaskStatus.IN_PROGRESS]}</li>
                <li>Blocked: {unresolvedTaskCountsByStatus[TaskStatus.BLOCKED]}</li>
                <li>Done: {unresolvedTaskCountsByStatus[TaskStatus.DONE]}</li>
                <li>Cancelled: {unresolvedTaskCountsByStatus[TaskStatus.CANCELLED]}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium">Follow-up ownership summary</h4>
              {ownershipSummary.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No unresolved follow-up ownership items in this program context.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {ownershipSummary.map((owner) => (
                    <li key={owner.assigneeId} className="rounded-md border p-2">
                      <Link href={`/tasks?assigneePersonId=${owner.assigneeId}&resolution=unresolved`} className="font-medium underline">
                        {owner.assigneeName}
                      </Link>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Unresolved: {owner.unresolvedCount} · Overdue: {owner.overdueCount}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">Readiness focus</h4>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <li>Notes needing review: {notesNeedingReviewCount}</li>
                <li>Overdue follow-up tasks: {overdueProgramTaskCount}</li>
                <li>Upcoming event readiness concerns: {upcomingProgramReadinessConcernCount}</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium">Overdue follow-up tasks</h4>
              {overdueProgramTasks.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No overdue open/in-progress/blocked follow-up tasks in current program context.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {overdueProgramTasks.slice(0, 3).map((task) => (
                    <li key={task.id} className="rounded-md border p-2">
                      <Link href={`/tasks/${task.id}`} className="font-medium underline">
                        {task.title}
                      </Link>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {formatEnumLabel(task.status)} · Due {formatDateTime(task.dueAt)}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Assignee: {task.assignee.firstName} {task.assignee.lastName}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">Recent note activity</h4>
              {recentProgramNotes.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No staff-visible program notes were recorded in the last 30 days.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {recentProgramNotes.slice(0, 3).map((note) => (
                    <li key={note.id} className="rounded-md border p-2">
                      <Link href={`/notes/${note.id}`} className="font-medium underline">
                        {note.body.slice(0, 80)}
                        {note.body.length > 80 ? "…" : ""}
                      </Link>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Created {formatDateTime(note.createdAt)} · Updated {formatDateTime(note.updatedAt)}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Team:{" "}
                        {note.team ? (
                          <Link href={`/teams/${note.team.id}`} className="underline">
                            {note.team.name}
                          </Link>
                        ) : note.event?.team ? (
                          <Link href={`/teams/${note.event.team.id}`} className="underline">
                            {note.event.team.name}
                          </Link>
                        ) : (
                          "No team context"
                        )}{" "}
                        · Unresolved linked tasks: {note.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {canViewAttendanceReporting ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">GearOps operational readiness</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Read-only inventory, custody, maintenance, and consumable readiness visibility linked to this program.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/gear-ops" className="rounded-full border px-2 py-1">
                GearOps overview
              </Link>
              <Link href="/gear-ops/items" className="rounded-full border px-2 py-1">
                Item lane
              </Link>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-medium">Program-linked visible items</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programGearVisibleItemCount}</dd>
            </div>
            <div>
              <dt className="font-medium">Durable / consumable</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {programGearDurableCount} / {programGearConsumableCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Active assignments / open checkouts</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {programGearActiveAssignmentCount} / {programGearOpenCheckoutCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Readiness concerns</dt>
              <dd className={programGearReadinessConcerns > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {programGearReadinessConcerns}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Assigned or checked out items</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programGearAssignedOrCheckedOutCount}</dd>
            </div>
            <div>
              <dt className="font-medium">Maintenance lifecycle items</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programGearMaintenanceCount}</dd>
            </div>
            <div>
              <dt className="font-medium">Condition concerns</dt>
              <dd className={programGearConditionConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {programGearConditionConcernCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Low-availability consumables</dt>
              <dd className={programGearLowAvailabilityConsumableCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {programGearLowAvailabilityConsumableCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Consumable usage (30 days)</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programConsumableUsageUnits30d} units</dd>
            </div>
            <div>
              <dt className="font-medium">Consumable replenishment (30 days)</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programConsumableReplenishmentUnits30d} units</dd>
            </div>
            <div>
              <dt className="font-medium">Consumable net delta (30 days)</dt>
              <dd className={programConsumableNetDelta30d < 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {programConsumableNetDelta30d > 0 ? "+" : ""}
                {programConsumableNetDelta30d}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <h4 className="text-sm font-medium">Low-availability consumables</h4>
            {programGearLowAvailabilityConsumables.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                No low-availability consumables are currently linked to this program context.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {programGearLowAvailabilityConsumables.slice(0, 3).map((item) => (
                  <li key={item.id} className="rounded-md border p-2">
                    <Link href={`/gear-ops/items/${item.id}`} className="font-medium underline">
                      {item.name}
                    </Link>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      On hand {item.quantityOnHand} · Min {item.quantityMin ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {canViewAttendanceReporting ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">FieldOps operational readiness</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Read-only facility/resource reservation visibility linked to this program context.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/field-ops/bookings" className="rounded-full border px-2 py-1">
                Booking lane
              </Link>
              <Link href={`/field-ops/bookings/new?programId=${program.id}`} className="rounded-full border px-2 py-1">
                New program booking
              </Link>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-medium">Program-linked reservations</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programFieldOpsBookingCount}</dd>
            </div>
            <div>
              <dt className="font-medium">Upcoming reservations</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programFieldOpsUpcomingBookings.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Resources with upcoming load</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programFieldOpsResourcesInUse}</dd>
            </div>
            <div>
              <dt className="font-medium">Readiness concerns</dt>
              <dd className={programFieldOpsReadinessConcerns > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {programFieldOpsReadinessConcerns}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <h4 className="text-sm font-medium">Upcoming reservations</h4>
            {programFieldOpsUpcomingBookings.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                No upcoming FieldOps reservations are currently linked to this program.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {programFieldOpsUpcomingBookings.slice(0, 3).map((booking) => (
                  <li key={booking.id} className="rounded-md border p-2">
                    <Link href={`/field-ops/bookings/${booking.id}`} className="font-medium underline">
                      {booking.title}
                    </Link>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {booking.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {formatEnumLabel(booking.status)}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Approval: {formatEnumLabel(booking.approvalStatus)} · {booking.facility.name} · {booking.resource.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {canViewAttendanceReporting ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">Attendance and event reporting</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Read-only participation, readiness, and trend visibility for current program teams.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/events?operationalIndicator=attendance_not_reviewed_recently" className="rounded-full border px-2 py-1">
                Attendance review lane
              </Link>
              <Link href="/events?operationalIndicator=upcoming_operational_concern" className="rounded-full border px-2 py-1">
                Upcoming readiness lane
              </Link>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-medium">Recent events reviewed</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programAttendanceTrend.reviewedEventCount}</dd>
            </div>
            <div>
              <dt className="font-medium">Attendance coverage</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{programAttendanceTrend.coveragePercent}%</dd>
            </div>
            <div>
              <dt className="font-medium">Trend</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {programAttendanceTrend.trendDirection === "insufficient_data"
                  ? "Not enough history yet"
                  : programAttendanceTrend.trendDirection === "up"
                    ? `Improving (${programAttendanceTrend.priorCoveragePercent}% → ${programAttendanceTrend.recentCoveragePercent}%)`
                    : programAttendanceTrend.trendDirection === "down"
                      ? `Declining (${programAttendanceTrend.priorCoveragePercent}% → ${programAttendanceTrend.recentCoveragePercent}%)`
                      : `Steady (${programAttendanceTrend.recentCoveragePercent}%)`}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Complete / partial / missing</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {programAttendanceTrend.completeEvents} complete · {programAttendanceTrend.partialEvents} partial · {programAttendanceTrend.missingEvents} missing
              </dd>
            </div>
            <div>
              <dt className="font-medium">Upcoming program events</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{upcomingProgramEvents.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Upcoming no-response roster members</dt>
              <dd className={upcomingProgramNoResponseCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {upcomingProgramNoResponseCount}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Upcoming events needing readiness review</dt>
              <dd className={upcomingProgramReadinessConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
                {upcomingProgramReadinessConcernCount}
              </dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium">Recent attendance trend</h4>
              {recentProgramAttendanceEntries.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No past program events are available yet for attendance trend reporting.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {recentProgramAttendanceEntries.slice(0, 3).map((event) => (
                    <li key={event.id} className="rounded-md border p-2">
                      <Link href={`/events/${event.id}`} className="font-medium underline">
                        {event.title}
                      </Link>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {event.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {formatEnumLabel(event.status)}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Team: {event.team ? <Link href={`/teams/${event.team.id}`} className="underline">{event.team.name}</Link> : "Unassigned"}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Attendance: {event.attendanceSummary.capturedAttendanceCount}/{event.attendanceSummary.expectedAttendanceCount || 0}
                        {event.attendanceSummary.expectedAttendanceCount > 0
                          ? ` (${event.attendanceSummary.captureRatePercent}%)`
                          : " captured"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">Upcoming event readiness</h4>
              {upcomingProgramReadinessEntries.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No upcoming program events are scheduled yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {upcomingProgramReadinessEntries.slice(0, 3).map((event) => (
                    <li key={event.id} className="rounded-md border p-2">
                      <Link href={`/events/${event.id}`} className="font-medium underline">
                        {event.title}
                      </Link>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {event.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {formatEnumLabel(event.status)}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        Team: {event.team ? <Link href={`/teams/${event.team.id}`} className="underline">{event.team.name}</Link> : "Unassigned"}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        No response: {event.rsvpSummary.noResponseCount} · Open tasks: {event.openTaskCount}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Seasons</h3>
        {program.seasons.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No season has been created yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {program.seasons.map((season) => (
              <li key={season.id} className="flex flex-wrap items-center gap-2">
                <span>{season.name}</span>
                <Link href={`/programs/${program.id}/seasons/${season.id}/edit`} className="underline">
                  Edit
                </Link>
                {canAccessSeasonRollover ? (
                  <Link href={`/programs/${program.id}/seasons/${season.id}/rollover`} className="underline">
                    Rollover
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Teams</h3>
        {program.teams.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No teams are assigned to this program yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {program.teams.map((team) => (
              <li key={team.id}>
                <Link href={`/teams/${team.id}`} className="underline">
                  {team.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Program role assignments</h3>
        {program.roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No program-scoped role assignments.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {program.roles.map((role) => (
              <li key={role.id}>
                {role.person.firstName} {role.person.lastName} · {formatEnumLabel(role.roleType)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

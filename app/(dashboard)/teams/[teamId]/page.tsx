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
  RoleType,
  ScopeType,
} from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { OperationalHistoryPanel } from "@/components/dashboard/operational-history-panel";
import {
  summarizeAttendanceParticipation,
  summarizeAttendanceTrend,
  summarizeRsvpReadiness,
} from "@/lib/attendance-event-reporting";
import {
  canReadStaffOnlyContent,
  canReadTeamScopedContent,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  deriveGuardianOperationalContext,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import {
  isRosterRoleType,
  isTeamScopedRoleType,
  MEMBEROPS_ROSTER_ROLE_TYPES,
  MEMBEROPS_TEAM_ROLE_TYPES,
} from "@/lib/member-ops";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { isUnresolvedTaskStatus } from "@/lib/follow-up-tasks";
import { getOrganizationScope } from "@/lib/organization-context";
import { getOperationalHistory } from "@/lib/operational-history";
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

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTeamViewHref(teamId: string, filters: { seasonId?: string; roleFilter?: string; guardianFilter?: string }) {
  const params = new URLSearchParams();

  if (filters.seasonId) {
    params.set("seasonId", filters.seasonId);
  }

  if (filters.roleFilter && filters.roleFilter !== "ALL") {
    params.set("roleFilter", filters.roleFilter);
  }

  if (filters.guardianFilter) {
    params.set("guardianFilter", filters.guardianFilter);
  }

  const query = params.toString();
  return query ? `/teams/${teamId}?${query}` : `/teams/${teamId}`;
}

export default async function TeamDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { teamId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query team details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
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
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view team operational workflows.
          </p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let team:
    | {
        id: string;
        name: string;
        program: {
          id: string;
          name: string;
          seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        };
        roles: Array<{
          id: string;
          roleType: string;
          person: { id: string; firstName: string; lastName: string };
        }>;
        roster: Array<{
          id: string;
          rosterRole: string;
          person: {
            id: string;
            firstName: string;
            lastName: string;
            email: string | null;
            lifecycleStatus: string;
            athleteLinks: Array<{
              id: string;
              guardian: {
                id: string;
                firstName: string;
                lastName: string;
                _count: { userAccounts: number };
                roles: Array<{ id: string }>;
              };
            }>;
          };
          season: { id: string; name: string; startDate: Date | null; endDate: Date | null };
        }>;
      }
    | null = null;
  let organizationPeople: Array<{ id: string; firstName: string; lastName: string }> = [];
  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;
  const canEditGuardianLinkageWhereSupported = guardianAccess.canEditGuardianLinkageWhereSupported;

  try {
    [team, organizationPeople] = await Promise.all([
      db.team.findFirst({
        where: {
          id: teamId,
          organizationId: scope.organizationId,
        },
        include: {
          program: {
            select: {
              id: true,
              name: true,
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
            },
          },
          roles: {
            where: {
              scopeType: ScopeType.TEAM,
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
          roster: {
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  lifecycleStatus: true,
                  athleteLinks: {
                    where: {
                      organizationId: scope.organizationId,
                    },
                    select: {
                      id: true,
                      guardian: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          _count: {
                            select: {
                              userAccounts: true,
                            },
                          },
                          roles: {
                            where: {
                              organizationId: scope.organizationId,
                              roleType: RoleType.PARENT_GUARDIAN,
                            },
                            select: {
                              id: true,
                            },
                            take: 1,
                          },
                        },
                      },
                    },
                  },
                },
              },
              season: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  endDate: true,
                },
              },
            },
            orderBy: [{ createdAt: "desc" }],
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
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load team details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!team) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Team not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  if (!canReadTeamScopedContent(actorRoleContext, team.id, team.program.id)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this team-scoped workflow.
          </p>
        </div>
      </section>
    );
  }

  const selectedSeason = selectSeededOrCurrentSeason(team.program.seasons);
  const requestedSeasonId = readSearchParam(resolvedSearchParams, "seasonId");
  const selectedSeasonForView =
    team.program.seasons.find((season) => season.id === requestedSeasonId) ?? selectedSeason;
  const hasNoSeasonConfigured = team.program.seasons.length === 0;
  const selectedSeasonRosterMembers = selectedSeasonForView
    ? team.roster.filter((membership) => membership.season.id === selectedSeasonForView.id)
    : [];
  const roleFilterParam = readSearchParam(resolvedSearchParams, "roleFilter");
  const roleFilter = roleFilterParam && isRosterRoleType(roleFilterParam)
    ? roleFilterParam
    : "ALL";
  const guardianFilterParam = readSearchParam(resolvedSearchParams, "guardianFilter");
  const guardianFilter =
    guardianFilterParam === "missing_guardian_linkage" ||
    guardianFilterParam === "inactive_guardian_account" ||
    guardianFilterParam === "incomplete_support"
      ? guardianFilterParam
      : "";
  const filteredSelectedSeasonRosterMembers =
    roleFilter === "ALL"
      ? selectedSeasonRosterMembers
      : selectedSeasonRosterMembers.filter((membership) => membership.rosterRole === roleFilter);
  const guardianFilteredSelectedSeasonRosterMembers =
    canViewGuardianRelationshipDetails && guardianFilter
      ? filteredSelectedSeasonRosterMembers.filter((membership) => {
          if (membership.rosterRole !== RoleType.ATHLETE) {
            return false;
          }
          const context = deriveGuardianOperationalContext(membership.person.athleteLinks);
          if (guardianFilter === "missing_guardian_linkage") {
            return context.hasNoGuardianOnFile;
          }
          if (guardianFilter === "inactive_guardian_account") {
            return context.hasInactiveGuardianAccountSignal;
          }
          return context.hasIncompleteRelationshipSupport;
        })
      : filteredSelectedSeasonRosterMembers;
  const athleteRosterMemberships = selectedSeasonRosterMembers.filter((membership) => membership.rosterRole === RoleType.ATHLETE);
  const selectedSeasonLifecycleCounts = Object.values(MemberLifecycleStatus).reduce(
    (counts, status) => {
      counts[status] = selectedSeasonRosterMembers.filter((membership) => membership.person.lifecycleStatus === status).length;
      return counts;
    },
    {} as Record<MemberLifecycleStatus, number>,
  );
  const selectedSeasonMembersWithoutActiveLifecycle = selectedSeasonRosterMembers.filter(
    (membership) => membership.person.lifecycleStatus !== MemberLifecycleStatus.ACTIVE,
  ).length;
  const athleteRosterWithGuardianLinks = athleteRosterMemberships.filter(
    (membership) => deriveGuardianOperationalContext(membership.person.athleteLinks).hasGuardianRelationship,
  ).length;
  const athleteRosterWithGuardianAccountLinkGaps = athleteRosterMemberships.filter((membership) =>
    deriveGuardianOperationalContext(membership.person.athleteLinks).missingGuardianAccountLinkCount > 0,
  ).length;
  const athleteRosterWithInactiveGuardianAccountSignals = athleteRosterMemberships.filter((membership) =>
    deriveGuardianOperationalContext(membership.person.athleteLinks).hasInactiveGuardianAccountSignal,
  ).length;
  const athleteRosterWithPendingOrIncompleteRelationshipSupport = athleteRosterMemberships.filter((membership) =>
    deriveGuardianOperationalContext(membership.person.athleteLinks).hasIncompleteRelationshipSupport,
  ).length;
  const athleteRosterWithoutGuardianLinks = athleteRosterMemberships.length - athleteRosterWithGuardianLinks;
  const roleAssignmentsByPersonId = new Map<
    string,
    Array<{ id: string; roleType: string; person: { id: string; firstName: string; lastName: string } }>
  >();
  for (const role of team.roles) {
    const personRoles = roleAssignmentsByPersonId.get(role.person.id) ?? [];
    personRoles.push(role);
    roleAssignmentsByPersonId.set(role.person.id, personRoles);
  }
  const rosterMembersWithoutRoleAssignments = selectedSeasonRosterMembers.filter(
    (membership) => (roleAssignmentsByPersonId.get(membership.person.id) ?? []).length === 0,
  ).length;
  const selectedSeasonRosterPersonIds = new Set(selectedSeasonRosterMembers.map((membership) => membership.person.id));
  const availablePeople = organizationPeople.filter((person) => !selectedSeasonRosterPersonIds.has(person.id));
  const inactiveOrUnassignedRoleMembers = team.roles.filter((role) => !selectedSeasonRosterPersonIds.has(role.person.id));

  const rosterError = readSearchParam(resolvedSearchParams, "rosterError");
  const rosterSuccess = readSearchParam(resolvedSearchParams, "rosterSuccess");
  const roleSuccess = readSearchParam(resolvedSearchParams, "roleSuccess");
  const teamRoleError = readSearchParam(resolvedSearchParams, "teamRoleError");
  const teamRolePersonIdError = readSearchParam(resolvedSearchParams, "teamRolePersonIdError");
  const teamRoleTypeError = readSearchParam(resolvedSearchParams, "teamRoleTypeError");
  const rosterPersonIdError = readSearchParam(resolvedSearchParams, "rosterPersonIdError");
  const rosterSeasonIdError = readSearchParam(resolvedSearchParams, "seasonIdError");
  const rosterRoleError = readSearchParam(resolvedSearchParams, "rosterRoleError");
  const selectedRosterSeasonId =
    readSearchParam(resolvedSearchParams, "seasonId") || selectedSeasonForView?.id || "";
  const selectedRosterPersonId =
    readSearchParam(resolvedSearchParams, "rosterPersonId") || availablePeople[0]?.id || "";
  const selectedRosterRole =
    isRosterRoleType(readSearchParam(resolvedSearchParams, "rosterRole"))
      ? readSearchParam(resolvedSearchParams, "rosterRole")
      : RoleType.ATHLETE;
  const selectedTeamRolePersonId =
    readSearchParam(resolvedSearchParams, "teamRolePersonId") || organizationPeople[0]?.id || "";
  const selectedTeamRoleType =
    isTeamScopedRoleType(readSearchParam(resolvedSearchParams, "teamRoleType"))
      ? readSearchParam(resolvedSearchParams, "teamRoleType")
      : RoleType.COACH;
  const teamOperationalHistory = await getOperationalHistory({
    organizationId: scope.organizationId,
    teamId: team.id,
    limit: 10,
    sinceDays: 45,
  });
  const now = new Date();
  const upcomingWindowEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const [teamRelatedTasks, teamRelatedNotes, teamUpcomingEvents, recentTeamEvents] = await Promise.all([
    db.followUpTask.findMany({
      where: {
        organizationId: scope.organizationId,
        OR: [
          { sourceEvent: { is: { teamId: team.id } } },
          { sourceNote: { is: { teamId: team.id } } },
          { sourceNote: { is: { event: { is: { teamId: team.id } } } } },
        ],
      },
      select: {
        id: true,
        status: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    db.observationNote.findMany({
      where: {
        organizationId: scope.organizationId,
        OR: [{ teamId: team.id }, { event: { is: { teamId: team.id } } }],
      },
      select: {
        id: true,
        tasks: { select: { status: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    db.event.findMany({
      where: {
        organizationId: scope.organizationId,
        teamId: team.id,
        startsAt: { gte: now, lte: upcomingWindowEndsAt },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
        _count: { select: { attendance: true } },
        tasks: { select: { status: true } },
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
      },
      orderBy: [{ startsAt: "asc" }],
      take: 8,
    }),
    db.event.findMany({
      where: {
        organizationId: scope.organizationId,
        teamId: team.id,
        startsAt: { lt: now },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
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
        tasks: { select: { status: true } },
      },
      orderBy: [{ startsAt: "desc" }],
      take: 6,
    }),
  ]);
  const unresolvedTeamTaskCount = teamRelatedTasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;
  const unresolvedTeamNoteTaskCount = teamRelatedNotes.reduce(
    (count, note) => count + note.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length,
    0,
  );
  const selectedSeasonExpectedAttendanceCount = new Set(
    selectedSeasonRosterMembers.map((membership) => membership.person.id),
  ).size;
  const selectedSeasonRosterPersonIdsForAttendance = selectedSeasonRosterMembers.map(
    (membership) => membership.person.id,
  );
  const upcomingEventConcerns = teamUpcomingEvents
    .map((event) => {
      const unresolvedTaskCount = event.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;
      const missingAttendanceCount =
        selectedSeasonExpectedAttendanceCount > 0
          ? Math.max(selectedSeasonExpectedAttendanceCount - event._count.attendance, 0)
          : 0;
      return {
        ...event,
        unresolvedTaskCount,
        missingAttendanceCount,
      };
    })
    .filter((event) => event.unresolvedTaskCount > 0 || event.missingAttendanceCount > 0);
  const teamAttendanceTrend = summarizeAttendanceTrend(
    recentTeamEvents.map((event) => ({
      startsAt: event.startsAt,
      expectedPersonIds: selectedSeasonRosterPersonIdsForAttendance,
      attendanceRecords: event.attendance,
    })),
  );
  const recentAttendanceReportingEvents = recentTeamEvents.map((event) => {
    const attendanceSummary = summarizeAttendanceParticipation({
      expectedPersonIds: selectedSeasonRosterPersonIdsForAttendance,
      attendanceRecords: event.attendance,
    });
    const rsvpSummary = summarizeRsvpReadiness({
      expectedPersonIds: selectedSeasonRosterPersonIdsForAttendance,
      rsvps: event.rsvps,
    });

    return {
      ...event,
      attendanceSummary,
      rsvpSummary,
    };
  });
  const upcomingTeamEventReadiness = teamUpcomingEvents.map((event) => {
    const attendanceSummary = summarizeAttendanceParticipation({
      expectedPersonIds: selectedSeasonRosterPersonIdsForAttendance,
      attendanceRecords: event.attendance,
    });
    const rsvpSummary = summarizeRsvpReadiness({
      expectedPersonIds: selectedSeasonRosterPersonIdsForAttendance,
      rsvps: event.rsvps,
    });
    const unresolvedTaskCount = event.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;

    return {
      ...event,
      attendanceSummary,
      rsvpSummary,
      unresolvedTaskCount,
      readinessConcernCount: rsvpSummary.noResponseCount + unresolvedTaskCount,
    };
  });
  const upcomingTeamReadinessConcernCount = upcomingTeamEventReadiness.filter(
    (event) => event.readinessConcernCount > 0,
  ).length;
  const upcomingTeamNoResponseCount = upcomingTeamEventReadiness.reduce(
    (count, event) => count + event.rsvpSummary.noResponseCount,
    0,
  );
  const teamGearItemWhere: Prisma.GearItemWhereInput = {
    organizationId: scope.organizationId,
    OR: [
      { assignments: { some: { assignedToTeamId: team.id } } },
      { assignments: { some: { assignedEvent: { is: { teamId: team.id } } } } },
      { checkouts: { some: { event: { is: { teamId: team.id } } } } },
      { consumableTransactions: { some: { event: { is: { teamId: team.id } } } } },
      { programId: team.program.id },
    ],
  };
  const defaultTeamOperationalSummary: [
    number,
    number,
    number,
    Array<{
      id: string;
      title: string;
      startsAt: Date;
      approvalStatus: ApprovalStatus;
      status: BookingStatus;
      facility: { id: string; name: string };
      resource: { id: string; name: string };
    }>,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    Array<{ id: string; name: string; quantityOnHand: number; quantityMin: number | null }>,
    { _sum: { quantityDelta: number | null } },
    { _sum: { quantityDelta: number | null } },
  ] = [0, 0, 0, [], 0, 0, 0, 0, 0, 0, 0, 0, 0, [], { _sum: { quantityDelta: 0 } }, { _sum: { quantityDelta: 0 } }];
  const [
    teamFieldOpsBookingCount,
    teamFieldOpsPendingApprovals,
    teamFieldOpsConflicts,
    teamFieldOpsUpcomingBookings,
    teamGearVisibleItemCount,
    teamGearDurableCount,
    teamGearConsumableCount,
    teamGearAssignedOrCheckedOutCount,
    teamGearMaintenanceCount,
    teamGearConditionConcernCount,
    teamGearActiveAssignmentCount,
    teamGearOpenCheckoutCount,
    teamGearLowAvailabilityConsumableCount,
    teamGearLowAvailabilityConsumables,
    teamConsumableUsageAggregate30d,
    teamConsumableReplenishmentAggregate30d,
  ] = await (async () => {
    try {
      return await Promise.all([
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId!,
          teamId: team.id,
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId!,
          teamId: team.id,
          approvalStatus: ApprovalStatus.PENDING,
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId!,
          teamId: team.id,
          conflicts: {
            some: {},
          },
        },
      }),
      db.resourceBooking.findMany({
        where: {
          organizationId: scope.organizationId!,
          teamId: team.id,
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
          status: true,
          approvalStatus: true,
          facility: { select: { id: true, name: true } },
          resource: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
      db.gearItem.count({
        where: teamGearItemWhere,
      }),
      db.gearItem.count({
        where: {
          ...teamGearItemWhere,
          inventoryType: GearInventoryType.DURABLE,
        },
      }),
      db.gearItem.count({
        where: {
          ...teamGearItemWhere,
          inventoryType: GearInventoryType.CONSUMABLE,
        },
      }),
      db.gearItem.count({
        where: {
          ...teamGearItemWhere,
          lifecycleStatus: { in: [GearItemLifecycleStatus.ASSIGNED, GearItemLifecycleStatus.CHECKED_OUT] },
        },
      }),
      db.gearItem.count({
        where: {
          ...teamGearItemWhere,
          lifecycleStatus: GearItemLifecycleStatus.MAINTENANCE,
        },
      }),
      db.gearItem.count({
        where: {
          ...teamGearItemWhere,
          conditionStatus: { in: [GearConditionStatus.POOR, GearConditionStatus.DAMAGED] },
        },
      }),
      db.gearAssignment.count({
        where: {
          organizationId: scope.organizationId!,
          status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] },
          OR: [
            { assignedToTeamId: team.id },
            { assignedEvent: { is: { teamId: team.id } } },
          ],
          gearItem: { is: teamGearItemWhere },
        },
      }),
      db.gearCheckout.count({
        where: {
          organizationId: scope.organizationId!,
          status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
          event: { is: { teamId: team.id } },
          gearItem: { is: teamGearItemWhere },
        },
      }),
      db.gearItem.count({
        where: {
          ...teamGearItemWhere,
          inventoryType: GearInventoryType.CONSUMABLE,
          quantityMin: { not: null },
          quantityOnHand: { lte: db.gearItem.fields.quantityMin },
        },
      }),
      db.gearItem.findMany({
        where: {
          ...teamGearItemWhere,
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
          organizationId: scope.organizationId!,
          recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          event: { is: { teamId: team.id } },
          gearItem: { is: teamGearItemWhere },
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
          organizationId: scope.organizationId!,
          recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          event: { is: { teamId: team.id } },
          gearItem: { is: teamGearItemWhere },
          transactionType: {
            in: [ConsumableTransactionType.RECEIVED],
          },
        },
        _sum: {
          quantityDelta: true,
        },
      }),
      ]);
    } catch (error) {
      console.error("Team GearOps operational summary failed; rendering with fallback values.", error);
      return defaultTeamOperationalSummary;
    }
  })();
  const teamFieldOpsResourcesInUse = new Set(teamFieldOpsUpcomingBookings.map((booking) => booking.resource.id)).size;
  const teamFieldOpsReadinessConcerns = teamFieldOpsPendingApprovals + teamFieldOpsConflicts;
  const teamConsumableUsageUnits30d = Math.abs(teamConsumableUsageAggregate30d._sum?.quantityDelta ?? 0);
  const teamConsumableReplenishmentUnits30d = Math.max(teamConsumableReplenishmentAggregate30d._sum?.quantityDelta ?? 0, 0);
  const teamConsumableNetDelta30d = teamConsumableReplenishmentUnits30d - teamConsumableUsageUnits30d;
  const teamGearReadinessConcerns =
    teamGearMaintenanceCount +
    teamGearConditionConcernCount +
    teamGearLowAvailabilityConsumableCount +
    teamGearOpenCheckoutCount;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <BackLink href="/teams" label="Teams" />
          <span>·</span>
          <Link href={`/programs/${team.program.id}`} className="hover:text-zinc-700 dark:hover:text-zinc-200">
            {team.program.name}
          </Link>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{team.name}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Program: {team.program.name}</p>
        <Link
          href="#add-roster-member"
          className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Add roster assignment
        </Link>
      </div>

      {rosterSuccess ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{rosterSuccess}</p>
        </div>
      ) : null}

      {roleSuccess ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{roleSuccess}</p>
        </div>
      ) : null}

      {hasNoSeasonConfigured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">No season has been created yet.</p>
          <Link
            href={`/programs/${team.program.id}/seasons/new`}
            className="mt-2 inline-block text-sm underline hover:text-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-amber-100"
          >
            Create the first season
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Roster assignments</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Roster season view (active-season default): {selectedSeasonForView?.name ?? "No season available"}
        </p>
        {team.program.seasons.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            {team.program.seasons.map((season) => (
              <Link
                key={season.id}
                href={buildTeamViewHref(team.id, {
                  seasonId: season.id,
                  roleFilter: roleFilter === "ALL" ? undefined : roleFilter,
                  guardianFilter: guardianFilter || undefined,
                })}
                className={`rounded-md border px-2 py-1 ${
                  selectedSeasonForView?.id === season.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                {season.name}
              </Link>
            ))}
          </div>
        ) : null}
        {selectedSeasonRosterMembers.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Link
              href={buildTeamViewHref(team.id, {
                seasonId: selectedSeasonForView?.id,
                roleFilter: undefined,
                guardianFilter: guardianFilter || undefined,
              })}
              className={`rounded-md border px-2 py-1 ${roleFilter === "ALL" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              All roster roles
            </Link>
            {MEMBEROPS_ROSTER_ROLE_TYPES.map((roleType) => (
              <Link
                key={roleType}
                href={buildTeamViewHref(team.id, {
                  seasonId: selectedSeasonForView?.id,
                  roleFilter: roleType,
                  guardianFilter: guardianFilter || undefined,
                })}
                className={`rounded-md border px-2 py-1 ${roleFilter === roleType ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {formatEnumLabel(roleType)}
              </Link>
            ))}
          </div>
        ) : null}
        {selectedSeasonRosterMembers.length > 0 && canViewGuardianRelationshipDetails ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Link
              href={buildTeamViewHref(team.id, {
                seasonId: selectedSeasonForView?.id,
                roleFilter: roleFilter === "ALL" ? undefined : roleFilter,
              })}
              className={`rounded-md border px-2 py-1 ${guardianFilter === "" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              All guardian contexts
            </Link>
            <Link
              href={buildTeamViewHref(team.id, {
                seasonId: selectedSeasonForView?.id,
                roleFilter: roleFilter === "ALL" ? undefined : roleFilter,
                guardianFilter: "missing_guardian_linkage",
              })}
              className={`rounded-md border px-2 py-1 ${guardianFilter === "missing_guardian_linkage" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              Athletes missing guardian linkage
            </Link>
            <Link
              href={buildTeamViewHref(team.id, {
                seasonId: selectedSeasonForView?.id,
                roleFilter: roleFilter === "ALL" ? undefined : roleFilter,
                guardianFilter: "inactive_guardian_account",
              })}
              className={`rounded-md border px-2 py-1 ${guardianFilter === "inactive_guardian_account" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              Inactive guardian account signal
            </Link>
            <Link
              href={buildTeamViewHref(team.id, {
                seasonId: selectedSeasonForView?.id,
                roleFilter: roleFilter === "ALL" ? undefined : roleFilter,
                guardianFilter: "incomplete_support",
              })}
              className={`rounded-md border px-2 py-1 ${guardianFilter === "incomplete_support" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              Pending/incomplete support
            </Link>
          </div>
        ) : null}
        {selectedSeasonRosterMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No members on team for this season yet.
          </p>
        ) : guardianFilteredSelectedSeasonRosterMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No roster members match the selected role/guardian filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="px-3 py-2 font-medium">Roster role</th>
                  <th className="px-3 py-2 font-medium">Role assignment status</th>
                  <th className="px-3 py-2 font-medium">Participation status</th>
                  <th className="px-3 py-2 font-medium">Guardian / relationship status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {guardianFilteredSelectedSeasonRosterMembers.map((membership) => {
                  const personRoleAssignments = roleAssignmentsByPersonId.get(membership.person.id) ?? [];
                  const roleAssignmentStatus =
                    personRoleAssignments.length === 0
                      ? "Role assignment missing"
                      : personRoleAssignments.map((assignment) => formatEnumLabel(assignment.roleType)).join(", ");
                  const guardianStatus =
                    membership.rosterRole === RoleType.ATHLETE
                      ? canViewGuardianRelationshipDetails
                        ? membership.person.athleteLinks.length > 0
                          ? (() => {
                              const guardianContext = deriveGuardianOperationalContext(membership.person.athleteLinks);
                              const linkedGuardianCount = guardianContext.linkedGuardianCount;
                              const guardiansMissingAccountLinks = guardianContext.missingGuardianAccountLinkCount;
                              const inactiveGuardianAccountSignals = guardianContext.inactiveGuardianAccountSignalCount;
                              const segments = [
                                `${linkedGuardianCount} guardian relationship${linkedGuardianCount === 1 ? "" : "s"} linked`,
                                formatGuardianOperationalIndicator(guardianContext),
                              ];
                              if (guardiansMissingAccountLinks > 0) {
                                segments.push(
                                  `${guardiansMissingAccountLinks} guardian account link${guardiansMissingAccountLinks === 1 ? "" : "s"} missing`,
                                );
                              }
                              if (inactiveGuardianAccountSignals > 0) {
                                segments.push(
                                  `${inactiveGuardianAccountSignals} inactive guardian account signal${inactiveGuardianAccountSignals === 1 ? "" : "s"}`,
                                );
                              }
                              if (guardiansMissingAccountLinks > 0 || inactiveGuardianAccountSignals > 0) {
                                segments.push("Pending/incomplete relationship support");
                              }
                              return segments.join(" · ");
                            })()
                          : "No guardian relationship linked"
                        : "Guardian relationship diagnostics are hidden for non-staff viewers"
                      : "Relationship visibility intentionally limited to athlete roster rows";

                  return (
                    <tr key={membership.id} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2">
                        <Link href={`/people/${membership.person.id}`} className="underline">
                          {membership.person.firstName} {membership.person.lastName}
                        </Link>
                        {membership.person.email ? (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{membership.person.email}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{formatEnumLabel(membership.rosterRole)}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{roleAssignmentStatus}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {formatEnumLabel(membership.person.lifecycleStatus)}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{guardianStatus}</td>
                      <td className="px-3 py-2">
                        <form action={`/teams/${team.id}/roster/${membership.id}/remove`} method="post">
                          <input type="hidden" name="seasonId" value={selectedSeasonForView?.id ?? ""} />
                          <button
                            type="submit"
                            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          View access: staff role assignments (Org Admin, Program Director, Coach, Assistant Coach). Edit support where
          available:{" "}
          {canEditGuardianLinkageWhereSupported
            ? "you have staff write coverage via existing person/roster/role assignment routes."
            : "staff write permissions are required via existing person/roster/role assignment routes."}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Selected-season lifecycle mix: Active {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ACTIVE]} · Prospect{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.PROSPECT]} · Inactive{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.INACTIVE]} · Archived{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ARCHIVED]} · Alumni{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ALUMNI]}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Selected-season roster members not currently Active in lifecycle status:{" "}
          {selectedSeasonMembersWithoutActiveLifecycle}.
        </p>
        {canViewGuardianRelationshipDetails ? (
          <>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Athlete guardian relationship coverage for this season: {athleteRosterWithGuardianLinks} athlete
              {athleteRosterWithGuardianLinks === 1 ? "" : "s"} with guardian link
              {athleteRosterWithGuardianLinks === 1 ? "" : "s"}, {athleteRosterWithoutGuardianLinks} without.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Athlete rows with guardian account-link gaps: {athleteRosterWithGuardianAccountLinkGaps} athlete
              {athleteRosterWithGuardianAccountLinkGaps === 1 ? "" : "s"} have at least one guardian relationship with no
              linked user account.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Athlete rows with inactive guardian account signals: {athleteRosterWithInactiveGuardianAccountSignals} athlete
              {athleteRosterWithInactiveGuardianAccountSignals === 1 ? "" : "s"} have linked guardian account records with
              missing guardian role assignments.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Athlete rows with pending/incomplete relationship support:{" "}
              {athleteRosterWithPendingOrIncompleteRelationshipSupport} athlete
              {athleteRosterWithPendingOrIncompleteRelationshipSupport === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Team roster role-assignment gaps: {rosterMembersWithoutRoleAssignments} member
              {rosterMembersWithoutRoleAssignments === 1 ? "" : "s"} with role assignment missing.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Relationship status indicators are staff-facing roster diagnostics only. They do not grant guardian access,
              and guardian onboarding/invitation workflows are intentionally deferred.
            </p>
            {athleteRosterMemberships.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                No guardian relationship data for this season because no athletes are on the selected roster.
              </p>
            ) : athleteRosterWithGuardianLinks === 0 ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                No guardian relationship data is currently linked for athletes on this season roster.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Guardian relationship diagnostics are hidden for non-staff viewers to protect private relationship details.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Operational relationship summary</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Review this team’s unresolved work, recent changes, and upcoming readiness concerns without leaving current team context.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Related notes</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamRelatedNotes.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Related follow-up tasks</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamRelatedTasks.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Unresolved related items</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {unresolvedTeamTaskCount + unresolvedTeamNoteTaskCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming team events (14 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamUpcomingEvents.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming operational concerns</dt>
            <dd className={upcomingEventConcerns.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {upcomingEventConcerns.length}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={`/notes?teamId=${team.id}`} className="rounded-full border px-2 py-1">
            Team notes
          </Link>
          <Link href={`/notes?teamId=${team.id}&readinessIndicator=needs_review`} className="rounded-full border px-2 py-1">
            Notes needing review
          </Link>
          <Link href={`/tasks?teamId=${team.id}&resolution=unresolved`} className="rounded-full border px-2 py-1">
            Team unresolved tasks
          </Link>
          <Link href={`/tasks?teamId=${team.id}&ownershipIndicator=stale_unresolved`} className="rounded-full border px-2 py-1">
            Stale unresolved tasks
          </Link>
          <Link href={`/events?teamId=${team.id}&operationalIndicator=upcoming_operational_concern`} className="rounded-full border px-2 py-1">
            Upcoming concern events
          </Link>
          <Link href={`/events?teamId=${team.id}&operationalIndicator=recently_active`} className="rounded-full border px-2 py-1">
            Recent related activity
          </Link>
          <Link href="#operational-history" className="rounded-full border px-2 py-1">
            Team change history
          </Link>
        </div>
        {upcomingEventConcerns.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {upcomingEventConcerns.slice(0, 3).map((event) => (
              <li key={event.id} className="rounded-md border p-2">
                <Link href={`/events/${event.id}`} className="font-medium underline">
                  {event.title}
                </Link>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {event.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {formatEnumLabel(event.status)}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Missing attendance: {event.missingAttendanceCount} · Unresolved tasks: {event.unresolvedTaskCount}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">FieldOps operational readiness</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Read-only reservation and resource readiness context linked to this team.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/field-ops/bookings" className="rounded-full border px-2 py-1">
              Booking lane
            </Link>
            <Link href={`/field-ops/bookings/new?teamId=${team.id}&programId=${team.program.id}`} className="rounded-full border px-2 py-1">
              New team booking
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium">Team-linked reservations</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamFieldOpsBookingCount}</dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming reservations</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamFieldOpsUpcomingBookings.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Resources with upcoming load</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamFieldOpsResourcesInUse}</dd>
          </div>
          <div>
            <dt className="font-medium">Readiness concerns</dt>
            <dd className={teamFieldOpsReadinessConcerns > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {teamFieldOpsReadinessConcerns}
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <h4 className="text-sm font-medium">Upcoming reservations</h4>
          {teamFieldOpsUpcomingBookings.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No upcoming FieldOps reservations are currently linked to this team.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {teamFieldOpsUpcomingBookings.slice(0, 3).map((booking) => (
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

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">GearOps operational readiness</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Read-only inventory, custody, maintenance, and consumable readiness context linked to this team.
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
            <dt className="font-medium">Team-linked visible items</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamGearVisibleItemCount}</dd>
          </div>
          <div>
            <dt className="font-medium">Durable / consumable</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {teamGearDurableCount} / {teamGearConsumableCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Active assignments / open checkouts</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {teamGearActiveAssignmentCount} / {teamGearOpenCheckoutCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Readiness concerns</dt>
            <dd className={teamGearReadinessConcerns > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {teamGearReadinessConcerns}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Assigned or checked out items</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamGearAssignedOrCheckedOutCount}</dd>
          </div>
          <div>
            <dt className="font-medium">Maintenance lifecycle items</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamGearMaintenanceCount}</dd>
          </div>
          <div>
            <dt className="font-medium">Condition concerns</dt>
            <dd className={teamGearConditionConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {teamGearConditionConcernCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Low-availability consumables</dt>
            <dd className={teamGearLowAvailabilityConsumableCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {teamGearLowAvailabilityConsumableCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Consumable usage (30 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamConsumableUsageUnits30d} units</dd>
          </div>
          <div>
            <dt className="font-medium">Consumable replenishment (30 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamConsumableReplenishmentUnits30d} units</dd>
          </div>
          <div>
            <dt className="font-medium">Consumable net delta (30 days)</dt>
            <dd className={teamConsumableNetDelta30d < 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {teamConsumableNetDelta30d > 0 ? "+" : ""}
              {teamConsumableNetDelta30d}
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <h4 className="text-sm font-medium">Low-availability consumables</h4>
          {teamGearLowAvailabilityConsumables.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No low-availability consumables are currently linked to this team context.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {teamGearLowAvailabilityConsumables.slice(0, 3).map((item) => (
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

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Attendance and event reporting</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Review recent attendance trends and upcoming event readiness for
              {selectedSeasonForView ? ` ${selectedSeasonForView.name}` : " current"} team context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={`/events?teamId=${team.id}&operationalIndicator=attendance_not_reviewed_recently`} className="rounded-full border px-2 py-1">
              Attendance review lane
            </Link>
            <Link href={`/events?teamId=${team.id}&operationalIndicator=upcoming_operational_concern`} className="rounded-full border px-2 py-1">
              Upcoming readiness lane
            </Link>
            <Link href={`/events?teamId=${team.id}&attendance=partial`} className="rounded-full border px-2 py-1">
              Partial attendance events
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-medium">Recent events reviewed</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamAttendanceTrend.reviewedEventCount}</dd>
          </div>
          <div>
            <dt className="font-medium">Attendance coverage</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamAttendanceTrend.coveragePercent}%</dd>
          </div>
          <div>
            <dt className="font-medium">Trend</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {teamAttendanceTrend.trendDirection === "insufficient_data"
                ? "Not enough history yet"
                : teamAttendanceTrend.trendDirection === "up"
                  ? `Improving (${teamAttendanceTrend.priorCoveragePercent}% → ${teamAttendanceTrend.recentCoveragePercent}%)`
                  : teamAttendanceTrend.trendDirection === "down"
                    ? `Declining (${teamAttendanceTrend.priorCoveragePercent}% → ${teamAttendanceTrend.recentCoveragePercent}%)`
                    : `Steady (${teamAttendanceTrend.recentCoveragePercent}%)`}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Complete / partial / missing</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {teamAttendanceTrend.completeEvents} complete · {teamAttendanceTrend.partialEvents} partial · {teamAttendanceTrend.missingEvents} missing
            </dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming events (14 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{teamUpcomingEvents.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming no-response roster members</dt>
            <dd className={upcomingTeamNoResponseCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {upcomingTeamNoResponseCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming events needing readiness review</dt>
            <dd className={upcomingTeamReadinessConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {upcomingTeamReadinessConcernCount}
            </dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium">Recent attendance trend</h4>
            {recentAttendanceReportingEvents.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                No past team events are available yet for attendance trend reporting.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {recentAttendanceReportingEvents.slice(0, 3).map((event) => (
                  <li key={event.id} className="rounded-md border p-2">
                    <Link href={`/events/${event.id}`} className="font-medium underline">
                      {event.title}
                    </Link>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {event.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {formatEnumLabel(event.status)}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Attendance: {event.attendanceSummary.capturedAttendanceCount}/{event.attendanceSummary.expectedAttendanceCount || 0}
                      {event.attendanceSummary.expectedAttendanceCount > 0
                        ? ` (${event.attendanceSummary.captureRatePercent}%)`
                        : " captured"}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      RSVP responses: {event.rsvpSummary.respondedCount}/{event.rsvpSummary.expectedResponseCount || 0}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium">Upcoming event readiness</h4>
            {upcomingTeamEventReadiness.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                No upcoming team events are scheduled in the current readiness window.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {upcomingTeamEventReadiness.slice(0, 3).map((event) => (
                  <li key={event.id} className="rounded-md border p-2">
                    <Link href={`/events/${event.id}`} className="font-medium underline">
                      {event.title}
                    </Link>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {event.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {formatEnumLabel(event.status)}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      No response: {event.rsvpSummary.noResponseCount} · Open tasks: {event.unresolvedTaskCount}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Going / maybe / not going: {event.rsvpSummary.goingCount} · {event.rsvpSummary.maybeCount} · {event.rsvpSummary.notGoingCount}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <OperationalHistoryPanel
        id="operational-history"
        title="Operational history"
        description="Recent team-linked activity derived from roster, assignment, event, note, task, and attendance workflows."
        emptyMessage="No recent team-linked operational history was found in the current review window."
        items={teamOperationalHistory}
        action={{ href: `/notes?teamId=${team.id}`, label: "Open team notes" }}
        footer={
          <>
            Team history reflects current roster memberships and role assignments. Removals and full audit reconstruction
            are intentionally deferred until dedicated audit/Entry history work exists.
          </>
        }
      />

      <div id="add-roster-member" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Add roster assignment</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Target season: {selectedSeasonForView?.name ?? "No season available"}
        </p>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-500">
          Note: Only existing people can be added here. To create a new person, use the{" "}
          <Link href="/people/new" className="underline">
            People section
          </Link>
          . Guardian onboarding, member invitations, and bulk import are deferred.
        </p>

        {rosterError ? <p className="mb-3 text-sm text-red-600">{rosterError}</p> : null}

        {!selectedSeasonForView ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No season has been created yet.</p>
        ) : availablePeople.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All organization people are already on this team for the selected season.
          </p>
        ) : (
          <form action={`/teams/${team.id}/roster`} method="post" className="space-y-3">
            {team.program.seasons.length === 1 ? (
              <input type="hidden" name="seasonId" value={selectedRosterSeasonId} />
            ) : (
              <div className="space-y-1">
                <label htmlFor="seasonId" className="text-sm font-medium">
                  Season
                </label>
                <select
                  id="seasonId"
                  name="seasonId"
                  defaultValue={selectedRosterSeasonId}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {team.program.seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
                {rosterSeasonIdError ? <p className="text-sm text-red-600">{rosterSeasonIdError}</p> : null}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="personId" className="text-sm font-medium">
                Person
              </label>
              <select
                id="personId"
                name="personId"
                defaultValue={selectedRosterPersonId}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {availablePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
              {rosterPersonIdError ? <p className="text-sm text-red-600">{rosterPersonIdError}</p> : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="rosterRole" className="text-sm font-medium">
                Roster role
              </label>
              <select
                id="rosterRole"
                name="rosterRole"
                defaultValue={selectedRosterRole}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {MEMBEROPS_ROSTER_ROLE_TYPES.map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {formatEnumLabel(roleType)}
                  </option>
                ))}
              </select>
              {rosterRoleError ? <p className="text-sm text-red-600">{rosterRoleError}</p> : null}
            </div>

            <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
              Add assignment
            </button>
          </form>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Team role assignments</h3>
        {teamRoleError ? <p className="mb-3 text-sm text-red-600">{teamRoleError}</p> : null}
        {team.roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No role assignments on this team yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {team.roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                <span>
                  <Link href={`/people/${role.person.id}`} className="underline">
                    {role.person.firstName} {role.person.lastName}
                  </Link>{" "}
                  · {formatEnumLabel(role.roleType)}
                </span>
                <form action={`/teams/${team.id}/role-assignments/${role.id}/delete`} method="post">
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Remove role
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="assign-team-role" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Assign team role</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Assign a role to an existing person on this team. This creates a team-scoped role assignment.
        </p>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-500">
          Note: Only existing people can be assigned a role. Creating new people, guardian onboarding, and
          member invitations are deferred.
        </p>

        {teamRoleError ? <p className="mb-3 text-sm text-red-600">{teamRoleError}</p> : null}

        <form action={`/teams/${team.id}/role-assignments/create`} method="post" className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="teamRolePersonId" className="text-sm font-medium">
              Person
            </label>
            <select
              id="teamRolePersonId"
              name="personId"
              defaultValue={selectedTeamRolePersonId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {organizationPeople.length === 0 ? (
                <option value="">No people in organization</option>
              ) : (
                organizationPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))
              )}
            </select>
            {teamRolePersonIdError ? <p className="text-sm text-red-600">{teamRolePersonIdError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="teamRoleType" className="text-sm font-medium">
              Role type
            </label>
            <select
              id="teamRoleType"
              name="roleType"
              defaultValue={selectedTeamRoleType}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
                {MEMBEROPS_TEAM_ROLE_TYPES.map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {formatEnumLabel(roleType)}
                  </option>
              ))}
            </select>
            {teamRoleTypeError ? <p className="text-sm text-red-600">{teamRoleTypeError}</p> : null}
          </div>

          <button
            type="submit"
            disabled={organizationPeople.length === 0}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Assign role
          </button>
        </form>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Inactive / unassigned member signals</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Team role assignments that are not on the selected season roster are shown as inactive/unassigned members.
        </p>
        {inactiveOrUnassignedRoleMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No inactive/unassigned members detected for this season view.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {inactiveOrUnassignedRoleMembers.map((role) => (
              <li key={role.id}>
                <Link href={`/people/${role.person.id}`} className="underline">
                  {role.person.firstName} {role.person.lastName}
                </Link>{" "}
                · {formatEnumLabel(role.roleType)} · Inactive/unassigned member
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

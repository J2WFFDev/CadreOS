import {
  ApprovalStatus,
  BookingStatus,
  GearCheckoutStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  MemberLifecycleStatus,
  Prisma,
  RoleType,
  TaskStatus,
} from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  buildSupportedTaskSourceNoteVisibilityWhere,
  SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
} from "@/lib/operational-visibility";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
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

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800/60">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row, index) => (
            <tr key={`${index}-${row.join("-")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="whitespace-nowrap px-3 py-2 align-top text-zinc-700 dark:text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query export-friendly reports right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
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

  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "reports.export-friendly.access",
    entityType: "operationalReporting",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Reports"
          description="Staff-scoped read-only operational views organized for future export and print workflows."
        />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view operational reporting surfaces.
          </p>
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
      <section className="space-y-4">
        <PageHeader
          title="Reports"
          description="Staff-scoped read-only operational views organized for future export and print workflows."
        />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe reporting visibility evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  const scopedProgramWhere = buildScopedProgramWhere(scope.organizationId, staffScopeResolution);
  const scopedTeamWhere = buildScopedTeamWhere(scope.organizationId, staffScopeResolution);
  const scopedPersonWhere = buildScopedPersonWhere(scope.organizationId, staffScopeResolution);

  const scopedEventWhere: Prisma.EventWhereInput = {
    organizationId: scope.organizationId,
    ...(staffScopeResolution.allowAllStaffScope
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
        }),
  };

  const scopedNoteWhere: Prisma.ObservationNoteWhereInput = {
    organizationId: scope.organizationId,
    visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
    ...(staffScopeResolution.allowAllStaffScope
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
        }),
  };

  const scopedTaskWhere: Prisma.FollowUpTaskWhereInput = {
    organizationId: scope.organizationId,
    AND: [
      buildSupportedTaskSourceNoteVisibilityWhere(),
      ...(staffScopeResolution.allowAllStaffScope
        ? []
        : [
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
          ]),
    ],
  };

  const fieldOpsBookingWhere: Prisma.ResourceBookingWhereInput = {
    organizationId: scope.organizationId,
    ...(staffScopeResolution.allowAllStaffScope
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
        }),
  };

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const gearAccess = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "reports.export-friendly.gear-ops.read",
  });

  const now = new Date();
  const recentNotesThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const upcomingEventsThreshold = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  let data:
    | {
        summaryRows: Array<Array<string | number>>;
        eventRows: Array<Array<string | number>>;
        noteRows: Array<Array<string | number>>;
        taskRows: Array<Array<string | number>>;
        fieldOpsRows: Array<Array<string | number>>;
        gearLowAvailabilityRows: Array<Array<string | number>>;
        gearCheckoutRows: Array<Array<string | number>>;
        lifecycleRows: Array<Array<string | number>>;
        guardianGapRows: Array<Array<string | number>>;
      }
    | null = null;
  let queryErrorMessage = "Unable to load export-friendly reports right now. Please try again later.";

  try {
    const [
      programCount,
      teamCount,
      personCount,
      activeMemberCount,
      openTaskCount,
      overdueTaskCount,
      recentNotesCount,
      upcomingEventsCount,
      recentEvents,
      recentNotes,
      unresolvedTasks,
      fieldOpsTotalBookings,
      fieldOpsPendingApprovals,
      fieldOpsConflicts,
      upcomingFieldOpsBookings,
      lifecycleActive,
      lifecycleProspect,
      lifecycleInactive,
      lifecycleArchived,
      lifecycleAlumni,
      activeWithoutRosterCount,
      athletesMissingGuardianLinkageCount,
      athletesMissingGuardianLinkage,
      totalFacilities,
      activeFacilities,
      totalResources,
      activeResources,
      gearSummary,
      lowAvailabilityConsumables,
      openGearCheckouts,
    ] = await Promise.all([
      db.program.count({ where: scopedProgramWhere }),
      db.team.count({ where: scopedTeamWhere }),
      db.person.count({ where: scopedPersonWhere }),
      db.person.count({ where: { ...scopedPersonWhere, lifecycleStatus: MemberLifecycleStatus.ACTIVE } }),
      db.followUpTask.count({ where: { ...scopedTaskWhere, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] } } }),
      db.followUpTask.count({
        where: {
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          dueAt: { lt: now },
        },
      }),
      db.observationNote.count({ where: { ...scopedNoteWhere, createdAt: { gte: recentNotesThreshold } } }),
      db.event.count({ where: { ...scopedEventWhere, startsAt: { gte: now, lt: upcomingEventsThreshold } } }),
      db.event.findMany({
        where: scopedEventWhere,
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
                where: { organizationId: scope.organizationId },
                select: { personId: true },
              },
            },
          },
          _count: { select: { rsvps: true, attendance: true, notes: true, tasks: true } },
        },
        orderBy: [{ startsAt: "desc" }],
        take: 12,
      }),
      db.observationNote.findMany({
        where: scopedNoteWhere,
        select: {
          id: true,
          createdAt: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          athletePersonId: true,
          team: { select: { id: true, name: true } },
          event: { select: { id: true, title: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
      }),
      db.followUpTask.findMany({
        where: {
          ...scopedTaskWhere,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
          sourceEventId: true,
          sourceNoteId: true,
        },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 12,
      }),
      db.resourceBooking.count({ where: fieldOpsBookingWhere }),
      db.resourceBooking.count({ where: { ...fieldOpsBookingWhere, approvalStatus: ApprovalStatus.PENDING } }),
      db.bookingConflict.count({ where: { organizationId: scope.organizationId, booking: fieldOpsBookingWhere } }),
      db.resourceBooking.findMany({
        where: {
          ...fieldOpsBookingWhere,
          startsAt: { gte: now },
          status: { notIn: [BookingStatus.DENIED, BookingStatus.CANCELED] },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          status: true,
          approvalStatus: true,
          facility: { select: { id: true, name: true } },
          resource: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 12,
      }),
      db.person.count({ where: { ...scopedPersonWhere, lifecycleStatus: MemberLifecycleStatus.ACTIVE } }),
      db.person.count({ where: { ...scopedPersonWhere, lifecycleStatus: MemberLifecycleStatus.PROSPECT } }),
      db.person.count({ where: { ...scopedPersonWhere, lifecycleStatus: MemberLifecycleStatus.INACTIVE } }),
      db.person.count({ where: { ...scopedPersonWhere, lifecycleStatus: MemberLifecycleStatus.ARCHIVED } }),
      db.person.count({ where: { ...scopedPersonWhere, lifecycleStatus: MemberLifecycleStatus.ALUMNI } }),
      db.person.count({
        where: {
          ...scopedPersonWhere,
          lifecycleStatus: MemberLifecycleStatus.ACTIVE,
          roster: { none: { organizationId: scope.organizationId } },
        },
      }),
      db.rosterMembership.count({
        where: {
          organizationId: scope.organizationId,
          rosterRole: RoleType.ATHLETE,
          ...(staffScopeResolution.allowAllStaffScope
            ? {}
            : {
                OR: [
                  ...(staffScopeResolution.allowedTeamIds.length > 0
                    ? [{ teamId: { in: staffScopeResolution.allowedTeamIds } }]
                    : []),
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                    : []),
                ],
              }),
          person: {
            athleteLinks: {
              none: {
                organizationId: scope.organizationId,
              },
            },
          },
        },
      }),
      db.rosterMembership.findMany({
        where: {
          organizationId: scope.organizationId,
          rosterRole: RoleType.ATHLETE,
          ...(staffScopeResolution.allowAllStaffScope
            ? {}
            : {
                OR: [
                  ...(staffScopeResolution.allowedTeamIds.length > 0
                    ? [{ teamId: { in: staffScopeResolution.allowedTeamIds } }]
                    : []),
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                    : []),
                ],
              }),
          person: {
            athleteLinks: {
              none: {
                organizationId: scope.organizationId,
              },
            },
          },
        },
        select: {
          person: { select: { id: true, firstName: true, lastName: true } },
          team: { select: { id: true, name: true } },
          season: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
      }),
      db.facility.count({ where: { organizationId: scope.organizationId } }),
      db.facility.count({ where: { organizationId: scope.organizationId, status: "ACTIVE" } }),
      db.facilityResource.count({ where: { organizationId: scope.organizationId } }),
      db.facilityResource.count({ where: { organizationId: scope.organizationId, status: "ACTIVE" } }),
      gearAccess.allowed
        ? Promise.all([
            db.gearItem.count({ where: gearAccess.where }),
            db.gearItem.count({ where: { ...gearAccess.where, inventoryType: GearInventoryType.DURABLE } }),
            db.gearItem.count({ where: { ...gearAccess.where, inventoryType: GearInventoryType.CONSUMABLE } }),
            db.gearItem.count({
              where: {
                ...gearAccess.where,
                lifecycleStatus: { in: [GearItemLifecycleStatus.ASSIGNED, GearItemLifecycleStatus.CHECKED_OUT] },
              },
            }),
            db.gearItem.count({ where: { ...gearAccess.where, lifecycleStatus: GearItemLifecycleStatus.MAINTENANCE } }),
            db.gearCheckout.count({
              where: {
                organizationId: scope.organizationId,
                status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
                gearItem: { AND: [gearAccess.where] },
              },
            }),
            db.gearItem.count({
              where: {
                ...gearAccess.where,
                inventoryType: GearInventoryType.CONSUMABLE,
                quantityMin: { not: null },
                quantityOnHand: { lte: db.gearItem.fields.quantityMin },
              },
            }),
          ])
        : Promise.resolve([0, 0, 0, 0, 0, 0, 0]),
      gearAccess.allowed
        ? db.gearItem.findMany({
            where: {
              ...gearAccess.where,
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
            take: 12,
          })
        : Promise.resolve([]),
      gearAccess.allowed
        ? db.gearCheckout.findMany({
            where: {
              organizationId: scope.organizationId,
              status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
              gearItem: { AND: [gearAccess.where] },
            },
            select: {
              id: true,
              checkedOutAt: true,
              status: true,
              gearItem: { select: { id: true, name: true } },
              checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: [{ checkedOutAt: "desc" }],
            take: 12,
          })
        : Promise.resolve([]),
    ]);

    const [
      gearVisibleItems,
      gearDurableItems,
      gearConsumableItems,
      gearAssignedOrCheckedOutItems,
      gearMaintenanceItems,
      gearOpenCheckouts,
      lowAvailabilityCount,
    ] = gearSummary;

    const eventRows = recentEvents.map((event) => {
      const expectedAttendance = event.team?.roster.length ?? 0;
      const missingAttendance = Math.max(expectedAttendance - event._count.attendance, 0);
      const missingRsvp = Math.max(expectedAttendance - event._count.rsvps, 0);

      return [
        event.title,
        formatDateTime(event.startsAt),
        event.program.name,
        event.team?.name ?? "—",
        formatEnumLabel(event.status),
        `${event._count.attendance}/${expectedAttendance}`,
        event._count.rsvps,
        missingAttendance + missingRsvp + event._count.tasks,
      ];
    });

    const noteRows = recentNotes.map((note) => [
      formatDateTime(note.createdAt),
      `${note.author.firstName} ${note.author.lastName}`,
      note.team?.name ?? "—",
      note.event ? "Linked" : "—",
      note.athletePersonId ? "Linked" : "—",
      note._count.tasks,
      `/notes/${note.id}`,
    ]);

    const taskRows = unresolvedTasks.map((task) => [
      task.title,
      formatEnumLabel(task.status),
      formatDateTime(task.dueAt),
      `${task.assignee.firstName} ${task.assignee.lastName}`,
      task.sourceEventId ? "Event" : task.sourceNoteId ? "Note" : "Direct",
      `/tasks/${task.id}`,
    ]);

    const fieldOpsRows = upcomingFieldOpsBookings.map((booking) => [
      booking.title,
      formatDateTime(booking.startsAt),
      formatDateTime(booking.endsAt),
      booking.facility.name,
      booking.resource.name,
      formatEnumLabel(booking.status),
      formatEnumLabel(booking.approvalStatus),
      `/field-ops/bookings/${booking.id}`,
    ]);

    const gearLowAvailabilityRows = lowAvailabilityConsumables.map((item) => [
      item.name,
      item.quantityOnHand,
      item.quantityMin ?? "—",
      `/gear-ops/items/${item.id}`,
    ]);

    const gearCheckoutRows = openGearCheckouts.map((checkout) => [
      checkout.gearItem.name,
      `${checkout.checkedOutBy.firstName} ${checkout.checkedOutBy.lastName}`,
      formatDateTime(checkout.checkedOutAt),
      formatEnumLabel(checkout.status),
      `/gear-ops/items/${checkout.gearItem.id}`,
    ]);

    const lifecycleRows: Array<Array<string | number>> = [
      ["Active", lifecycleActive],
      ["Prospect", lifecycleProspect],
      ["Inactive", lifecycleInactive],
      ["Archived", lifecycleArchived],
      ["Alumni", lifecycleAlumni],
      ["Active without roster", activeWithoutRosterCount],
      ["Athletes missing guardian linkage", athletesMissingGuardianLinkageCount],
    ];

    const guardianGapRows = athletesMissingGuardianLinkage.map((membership) => [
      `${membership.person.firstName} ${membership.person.lastName}`,
      membership.team.name,
      membership.season.name,
      `/people/${membership.person.id}`,
    ]);

    const summaryRows: Array<Array<string | number>> = [
      ["Programs (scoped)", programCount],
      ["Teams (scoped)", teamCount],
      ["People (scoped)", personCount],
      ["Active members", activeMemberCount],
      ["Open follow-up workload", openTaskCount],
      ["Overdue follow-up workload", overdueTaskCount],
      ["Recent notes (14d)", recentNotesCount],
      ["Upcoming events (14d)", upcomingEventsCount],
      ["Facilities", totalFacilities],
      ["Active facilities", activeFacilities],
      ["Resources", totalResources],
      ["Active resources", activeResources],
      ["FieldOps bookings (scoped)", fieldOpsTotalBookings],
      ["FieldOps pending approvals", fieldOpsPendingApprovals],
      ["FieldOps conflicts", fieldOpsConflicts],
      ["Visible gear items", gearVisibleItems],
      ["Durable gear items", gearDurableItems],
      ["Consumable gear items", gearConsumableItems],
      ["Assigned or checked out gear", gearAssignedOrCheckedOutItems],
      ["Gear maintenance lifecycle", gearMaintenanceItems],
      ["Open gear checkouts", gearOpenCheckouts],
      ["Low-availability consumables", lowAvailabilityCount],
    ];

    data = {
      summaryRows,
      eventRows,
      noteRows,
      taskRows,
      fieldOpsRows,
      gearLowAvailabilityRows,
      gearCheckoutRows,
      lifecycleRows,
      guardianGapRows,
    };
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage =
        "Database schema is not available yet. Run database setup before loading export-friendly reports.";
    }
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Reports"
          description="Staff-scoped read-only operational views organized for future export and print workflows."
        />
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Reports"
        description="Export-friendly, read-only operational layouts across Core, attendance, FieldOps, GearOps, and lifecycle readiness."
        actions={
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/dashboard" className="rounded-full border px-2 py-1">
              Dashboard
            </Link>
            <Link href="/events?operationalIndicator=attendance_not_reviewed_recently" className="rounded-full border px-2 py-1">
              Attendance review
            </Link>
            <Link href="/notes?readinessIndicator=needs_review" className="rounded-full border px-2 py-1">
              Notes review
            </Link>
            <Link href="/tasks?resolution=unresolved" className="rounded-full border px-2 py-1">
              Task review
            </Link>
            <Link href="/field-ops/bookings?timeframe=upcoming" className="rounded-full border px-2 py-1">
              FieldOps bookings
            </Link>
            <Link href="/gear-ops/items" className="rounded-full border px-2 py-1">
              GearOps items
            </Link>
            <Link href="/teams?readiness=needs_attention" className="rounded-full border px-2 py-1">
              Lifecycle readiness
            </Link>
          </div>
        }
      />

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Operational summary</h3>
        <DataTable columns={["Metric", "Value"]} rows={data.summaryRows} />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Attendance and event reporting</h3>
        {data.eventRows.length === 0 ? (
          <EmptyState message="No scoped events are currently available for attendance/event report rows." actionHref="/events" actionLabel="Open events" />
        ) : (
          <DataTable
            columns={["Event", "Starts", "Program", "Team", "Status", "Attendance", "RSVP", "Readiness concerns"]}
            rows={data.eventRows}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Notes operational review</h3>
          {data.noteRows.length === 0 ? (
            <EmptyState message="No scoped notes are currently available for reporting." actionHref="/notes" actionLabel="Open notes" />
          ) : (
            <DataTable
              columns={["Created", "Author", "Team", "Event", "Athlete", "Open tasks", "Link"]}
              rows={data.noteRows}
            />
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Follow-up task operational review</h3>
          {data.taskRows.length === 0 ? (
            <EmptyState
              message="No unresolved scoped tasks are currently available for reporting."
              actionHref="/tasks?resolution=unresolved"
              actionLabel="Open unresolved tasks"
            />
          ) : (
            <DataTable columns={["Task", "Status", "Due", "Assignee", "Source", "Link"]} rows={data.taskRows} />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">FieldOps reporting</h3>
        {data.fieldOpsRows.length === 0 ? (
          <EmptyState
            message="No scoped upcoming FieldOps bookings are currently available for reporting."
            actionHref="/field-ops/bookings"
            actionLabel="Open bookings"
          />
        ) : (
          <DataTable
            columns={["Booking", "Starts", "Ends", "Facility", "Resource", "Status", "Approval", "Link"]}
            rows={data.fieldOpsRows}
          />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">GearOps reporting</h3>
        {!gearAccess.allowed ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            GearOps export-friendly rows are hidden because your current scope cannot access GearOps reporting.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {data.gearLowAvailabilityRows.length === 0 ? (
              <EmptyState
                message="No low-availability consumables are currently visible in scoped reporting."
                actionHref="/gear-ops/items?inventoryType=CONSUMABLE"
                actionLabel="Open consumables"
              />
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Low-availability consumables</h4>
                <DataTable columns={["Item", "On hand", "Min", "Link"]} rows={data.gearLowAvailabilityRows} />
              </div>
            )}
            {data.gearCheckoutRows.length === 0 ? (
              <EmptyState
                message="No open gear checkouts are currently visible in scoped reporting."
                actionHref="/gear-ops/items"
                actionLabel="Open gear items"
              />
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Open custody checkouts</h4>
                <DataTable columns={["Item", "Checked out by", "Checked out at", "Status", "Link"]} rows={data.gearCheckoutRows} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Lifecycle readiness reporting</h3>
          <DataTable columns={["Lifecycle metric", "Value"]} rows={data.lifecycleRows} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Guardian readiness reporting</h3>
          {!guardianAccess.canViewGuardianRelationshipDetails ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Guardian-linkage detail rows are hidden for your current role scope.
            </div>
          ) : data.guardianGapRows.length === 0 ? (
            <EmptyState
              message="No athletes missing guardian linkage are currently visible in scoped reporting."
              actionHref="/people"
              actionLabel="Open people"
            />
          ) : (
            <DataTable columns={["Athlete", "Team", "Season", "Link"]} rows={data.guardianGapRows} />
          )}
        </div>
      </div>
    </section>
  );
}

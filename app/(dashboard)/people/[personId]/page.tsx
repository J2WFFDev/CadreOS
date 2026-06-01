import { AttendanceStatus, MemberLifecycleStatus, RoleType, ScopeType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { MemberRoleAssignmentForm } from "@/components/dashboard/member-role-assignment-form";
import { OperationalHistoryPanel } from "@/components/dashboard/operational-history-panel";
import {
  evaluatePersonOperationalContentAccess,
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
  type StaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { isUnresolvedTaskStatus } from "@/lib/follow-up-tasks";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import {
  MEMBER_LIFECYCLE_STATUS_LABELS,
  MEMBEROPS_SCOPED_PROGRAM_ROLE_TYPES,
  MEMBEROPS_SCOPED_TEAM_ROLE_TYPES,
} from "@/lib/member-ops";
import { deriveMemberRosterReadiness } from "@/lib/member-ops-roster-readiness";
import { getOrganizationScope } from "@/lib/organization-context";
import { getOperationalHistory } from "@/lib/operational-history";
import {
  buildSupportedTaskSourceNoteVisibilityWhere,
  SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
} from "@/lib/operational-visibility";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function hasSearchParam(searchParams: SearchParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(searchParams, key);
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

const lifecycleDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const TERMINAL_MEMBER_LIFECYCLE_STATUSES = new Set<MemberLifecycleStatus>([
  MemberLifecycleStatus.ARCHIVED,
  MemberLifecycleStatus.FORMER,
]);

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const ASSIGNMENT_SCOPE_OPTIONS = [
  { value: ScopeType.PROGRAM, label: "Program scope" },
  { value: ScopeType.TEAM, label: "Team scope" },
] as const;

function matchesScopedTeamOrProgram(
  staffScopeResolution: StaffScopeResolution,
  teamId: string | null,
  programId: string | null,
) {
  if (staffScopeResolution.allowAllStaffScope) {
    return true;
  }

  if (teamId && staffScopeResolution.allowedTeamIds.includes(teamId)) {
    return true;
  }

  if (programId && staffScopeResolution.allowedProgramIds.includes(programId)) {
    return true;
  }

  return false;
}

function derivePersonOperationalScope(person: {
  roles: Array<{
    program: { id: string } | null;
    team: { id: string; program: { id: string } | null } | null;
  }>;
  roster: Array<{
    team: { id: string; program: { id: string } };
  }>;
}) {
  return {
    teamIds: Array.from(
      new Set([
        ...person.roles.map((role) => role.team?.id ?? null),
        ...person.roster.map((membership) => membership.team.id),
      ].filter((value): value is string => Boolean(value))),
    ),
    programIds: Array.from(
      new Set([
        ...person.roles.map((role) => role.program?.id ?? role.team?.program?.id ?? null),
        ...person.roster.map((membership) => membership.team.program.id),
      ].filter((value): value is string => Boolean(value))),
    ),
  };
}

export default async function PersonDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { personId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query person details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div id="relationship-summary" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
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
    workflow: "people.detail.access",
    entityType: "person",
    entityId: personId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view person operational workflows.
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
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe person visibility evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let person:
    | {
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
        lifecycleStatus: MemberLifecycleStatus;
        lifecycleStatusChangedAt: Date;
        lifecycleStatusReason: string | null;
        roles: Array<{
          id: string;
          roleType: string;
          scopeType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        guardianLinks: Array<{
          id: string;
          relationshipType: string;
          guardianRole: string;
          athlete: { id: string; firstName: string; lastName: string };
        }>;
        athleteLinks: Array<{
          id: string;
          relationshipType: string;
          guardianRole: string;
          guardian: {
            id: string;
            firstName: string;
            lastName: string;
            _count: { userAccounts: number };
            roles: Array<{ id: string }>;
          };
        }>;
        roster: Array<{
          id: string;
          rosterRole: string;
          team: { id: string; name: string; program: { id: string; name: string } };
          season: { id: string; name: string };
        }>;
      }
    | null = null;
  let programs: Array<{ id: string; name: string }> = [];
  let teams: Array<{ id: string; name: string; program: { id: string; name: string } }> = [];
  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;
  const canEditGuardianLinkageWhereSupported = guardianAccess.canEditGuardianLinkageWhereSupported;

  try {
    [person, programs, teams] = await Promise.all([
      db.person.findFirst({
        where: {
          id: personId,
          organizationId: scope.organizationId,
        },
        include: {
          roles: {
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                  program: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ scopeType: "asc" }, { roleType: "asc" }, { createdAt: "asc" }],
          },
          guardianLinks: {
            include: {
              athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              athlete: {
                lastName: "asc",
              },
            },
          },
          athleteLinks: {
            include: {
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
            orderBy: {
              guardian: {
                lastName: "asc",
              },
            },
          },
          roster: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  program: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              season: {
                select: { id: true, name: true },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      }),
      db.program.findMany({
        where: {
          organizationId: scope.organizationId,
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
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ name: "asc" }],
      }),
      db.team.findMany({
        where: {
          organizationId: scope.organizationId,
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
        },
        select: {
          id: true,
          name: true,
          program: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load person details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (person === null) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Person not found in the selected organization.
          </p>
        </div>
      </section>
    );
  }

  const personAccessDecision = evaluatePersonOperationalContentAccess(
    actorRoleContext,
    derivePersonOperationalScope(person),
  );
  logAuthorizationDecision(personAccessDecision, {
    workflow: "people.detail.scope",
    entityType: "person",
    entityId: person.id,
  });

  if (!personAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this person within your current team/program scope.
          </p>
        </div>
      </section>
    );
  }

  const roleError = readSearchParam(resolvedSearchParams, "roleError");
  const roleTypeError = readSearchParam(resolvedSearchParams, "roleTypeError");
  const scopeTypeError = readSearchParam(resolvedSearchParams, "scopeTypeError");
  const programIdError = readSearchParam(resolvedSearchParams, "programIdError");
  const teamIdError = readSearchParam(resolvedSearchParams, "teamIdError");
  const activateError = readSearchParam(resolvedSearchParams, "activateError");
  const lifecycleError = readSearchParam(resolvedSearchParams, "lifecycleError");
  const moveSuccess = readSearchParam(resolvedSearchParams, "moveSuccess");

  const selectedScopeTypeParam = readSearchParam(resolvedSearchParams, "scopeType");
  const selectedScopeType =
    selectedScopeTypeParam === ScopeType.PROGRAM || selectedScopeTypeParam === ScopeType.TEAM
      ? selectedScopeTypeParam
      : ScopeType.TEAM;
  const selectedProgramId = hasSearchParam(resolvedSearchParams, "programId")
    ? readSearchParam(resolvedSearchParams, "programId")
    : "";
  const selectedTeamId = hasSearchParam(resolvedSearchParams, "teamId")
    ? readSearchParam(resolvedSearchParams, "teamId")
    : "";
  const selectedRoleTypeParam = readSearchParam(resolvedSearchParams, "roleType");
  const selectedRoleTypeOptions: RoleType[] =
    selectedScopeType === ScopeType.PROGRAM
      ? [...MEMBEROPS_SCOPED_PROGRAM_ROLE_TYPES]
      : [...MEMBEROPS_SCOPED_TEAM_ROLE_TYPES];
  const selectedRoleType = selectedRoleTypeOptions.includes(selectedRoleTypeParam as RoleType)
    ? (selectedRoleTypeParam as RoleType)
    : selectedRoleTypeOptions[0];
  const visibleRoles = staffScopeResolution.allowAllStaffScope
    ? person.roles
    : person.roles.filter((role) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          role.team?.id ?? null,
          role.program?.id ?? role.team?.program?.id ?? null,
        ),
      );
  const visibleRoster = staffScopeResolution.allowAllStaffScope
    ? person.roster
    : person.roster.filter((membership) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          membership.team.id,
          membership.team.program.id,
        ),
      );
  const hasActiveRosterMembership = visibleRoster.length > 0;
  const hasLifecycleRosterReadinessGap =
    person.lifecycleStatus === MemberLifecycleStatus.ACTIVE && !hasActiveRosterMembership;
  const hasNonActiveLifecycleRosterMembership =
    person.lifecycleStatus !== MemberLifecycleStatus.ACTIVE && hasActiveRosterMembership;
  const isAthleteProfile =
    visibleRoles.some((role) => role.roleType === RoleType.ATHLETE) ||
    visibleRoster.some((membership) => membership.rosterRole === RoleType.ATHLETE);
  const hasGuardianAccountLinkGap = person.athleteLinks.some(
    (link) => link.guardian._count.userAccounts === 0,
  );
  const hasInactiveGuardianAccountSignal = person.athleteLinks.some(
    (link) => link.guardian._count.userAccounts > 0 && link.guardian.roles.length === 0,
  );
  const hasPendingOrIncompleteRelationshipSupport = hasGuardianAccountLinkGap || hasInactiveGuardianAccountSignal;
  const memberTransitionReadiness = deriveMemberRosterReadiness({
    lifecycleStatus: person.lifecycleStatus,
    roleTypes: [...new Set(visibleRoles.map((role) => role.roleType))],
    rosterRoles: [...new Set(visibleRoster.map((membership) => membership.rosterRole))],
    membershipCount: visibleRoster.length,
    athleteGuardianLinkCount: person.athleteLinks.length,
    hasProgramAssignment:
      visibleRoster.length > 0 ||
      visibleRoles.some((role) => role.program?.id || role.team?.program?.id),
    hasSeasonAssignment: hasActiveRosterMembership,
    hasProfileEmail: Boolean(person.email),
  });
  const personOperationalHistory = await getOperationalHistory({
    organizationId: scope.organizationId,
    personId: person.id,
    limit: 10,
    sinceDays: 45,
    allowAllStaffScope: staffScopeResolution.allowAllStaffScope,
    allowedTeamIds: staffScopeResolution.allowedTeamIds,
    allowedProgramIds: staffScopeResolution.allowedProgramIds,
  });
  const rosterTeamIds = [...new Set(visibleRoster.map((membership) => membership.team.id))];
  const now = new Date();
  const upcomingWindowEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const [relatedTasks, relatedNotes, relatedAttendance, upcomingTeamEvents] = await Promise.all([
    db.followUpTask.findMany({
      where: {
        organizationId: scope.organizationId,
        AND: [
          buildSupportedTaskSourceNoteVisibilityWhere(),
          {
            OR: [
              { assigneePersonId: person.id },
              { createdByPersonId: person.id },
              { sourceNote: { is: { athletePersonId: person.id } } },
            ],
          },
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
                      ? [{ sourceNote: { is: { team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                      : []),
                    ...(staffScopeResolution.allowedProgramIds.length > 0
                      ? [{ sourceNote: { is: { event: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                      : []),
                  ],
                },
              ]),
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        updatedAt: true,
        sourceEvent: { select: { id: true, title: true } },
        sourceNote: {
          select: {
            id: true,
            event: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    db.observationNote.findMany({
      where: {
        organizationId: scope.organizationId,
        visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY,
        AND: [
          { OR: [{ athletePersonId: person.id }, { authorPersonId: person.id }] },
          ...(staffScopeResolution.allowAllStaffScope
            ? []
            : [
                {
                  OR: [
                    ...(staffScopeResolution.allowedTeamIds.length > 0
                      ? [{ teamId: { in: staffScopeResolution.allowedTeamIds } }]
                      : []),
                    ...(staffScopeResolution.allowedTeamIds.length > 0
                      ? [{ event: { is: { teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                      : []),
                    ...(staffScopeResolution.allowedProgramIds.length > 0
                      ? [{ team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                      : []),
                    ...(staffScopeResolution.allowedProgramIds.length > 0
                      ? [{ event: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                      : []),
                  ],
                },
              ]),
        ],
      },
      select: {
        id: true,
        body: true,
        updatedAt: true,
        event: { select: { id: true, title: true } },
        tasks: { select: { status: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    db.attendanceRecord.findMany({
      where: {
        organizationId: scope.organizationId,
        personId: person.id,
        ...(staffScopeResolution.allowAllStaffScope
          ? {}
          : {
              OR: [
                ...(staffScopeResolution.allowedTeamIds.length > 0
                  ? [{ event: { is: { teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ event: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                  : []),
              ],
            }),
      },
      select: {
        id: true,
        status: true,
        markedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ markedAt: "desc" }],
      take: 6,
    }),
    rosterTeamIds.length === 0
      ? Promise.resolve([])
      : db.event.findMany({
          where: {
            organizationId: scope.organizationId,
            teamId: { in: rosterTeamIds },
            startsAt: { gte: now, lte: upcomingWindowEndsAt },
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true,
            team: { select: { id: true, name: true } },
            tasks: { select: { status: true } },
          },
          orderBy: [{ startsAt: "asc" }],
          take: 6,
        }),
  ]);
  const unresolvedRelatedTaskCount = relatedTasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;
  const unresolvedRelatedNoteTaskCount = relatedNotes.reduce(
    (count, note) => count + note.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length,
    0,
  );
  const attendanceConcernCount = relatedAttendance.filter(
    (record) => record.status !== AttendanceStatus.PRESENT,
  ).length;
  const upcomingEventsWithOpenTasks = upcomingTeamEvents
    .map((event) => ({
      ...event,
      unresolvedTaskCount: event.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length,
    }))
    .filter((event) => event.unresolvedTaskCount > 0);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/people" label="Members" />
        <h2 className="text-2xl font-semibold tracking-tight">
          {person.firstName} {person.lastName}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.email ?? "No email on file"}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.phone ?? "No phone on file"}</p>
        <Link href={`/people/${person.id}/edit`} className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Edit person
        </Link>
        <Link href={`/people/${person.id}/move`} className="ml-2 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Change team/program
        </Link>
        <Link href={`/people/${person.id}/guardians`} className="ml-2 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Guardian relationships
        </Link>
      </div>

      {moveSuccess ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{moveSuccess}</p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-2 text-lg font-medium">Member lifecycle status</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Current status:{" "}
          <span className={
            person.lifecycleStatus === MemberLifecycleStatus.ACTIVE
              ? "font-medium text-green-700 dark:text-green-400"
              : person.lifecycleStatus === MemberLifecycleStatus.PROSPECT
                ? "font-medium text-blue-700 dark:text-blue-400"
                : TERMINAL_MEMBER_LIFECYCLE_STATUSES.has(person.lifecycleStatus)
                  ? "font-medium text-red-700 dark:text-red-400"
                  : "font-medium text-zinc-700 dark:text-zinc-300"
            }>
            {MEMBER_LIFECYCLE_STATUS_LABELS[person.lifecycleStatus]}
          </span>
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium">Last status change:</span>{" "}
          <time dateTime={person.lifecycleStatusChangedAt.toISOString()}>
            {lifecycleDateTimeFormatter.format(person.lifecycleStatusChangedAt)}
          </time>
          {person.lifecycleStatusReason ? (
            <>
              {" "}
              <span className="font-medium">Reason:</span> {person.lifecycleStatusReason}
            </>
          ) : null}
        </p>
        {hasLifecycleRosterReadinessGap ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Readiness gap: member is Active but has no roster membership in current scoped context.
          </p>
        ) : null}
        {hasNonActiveLifecycleRosterMembership ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Lifecycle note: member has roster membership while lifecycle status is {MEMBER_LIFECYCLE_STATUS_LABELS[person.lifecycleStatus]}.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Onboarding: {memberTransitionReadiness.onboardingIncomplete ? "Incomplete" : "Ready"} · Offboarding:{" "}
          {memberTransitionReadiness.offboardingActionRecommended ? "Review needed" : "No action"} · Rollover:{" "}
          {memberTransitionReadiness.rolloverReady
            ? "Ready"
            : memberTransitionReadiness.rolloverNeedsReview
              ? "Needs review"
              : "Not applicable"}.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Transfer is represented in Release 1 as a non-destructive status and assignment update workflow (typically
          Inactive plus updated team/program/season context), while historical records remain preserved.
        </p>
        {activateError ? (
          <p className="mt-2 text-sm text-red-600">{activateError}</p>
        ) : null}
        {lifecycleError ? (
          <p className="mt-2 text-sm text-red-600">{lifecycleError}</p>
        ) : null}
        <form action={`/people/${person.id}/lifecycle/update`} method="post" className="mt-3 space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="lifecycleStatus" className="text-sm font-medium">
                Lifecycle status
              </label>
              <select
                id="lifecycleStatus"
                name="lifecycleStatus"
                defaultValue={person.lifecycleStatus}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              >
                {Object.values(MemberLifecycleStatus).map((status) => (
                  <option key={status} value={status}>
                    {MEMBER_LIFECYCLE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="lifecycleReason" className="text-sm font-medium">
                Lifecycle reason (optional)
              </label>
              <input
                id="lifecycleReason"
                name="lifecycleReason"
                defaultValue={person.lifecycleStatusReason ?? ""}
                className="w-full rounded-md border px-3 py-1.5 text-sm"
                placeholder="Reason for status change"
                maxLength={300}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
            >
              Save status
            </button>
          </div>
        </form>
        {(person.lifecycleStatus === MemberLifecycleStatus.PROSPECT ||
          person.lifecycleStatus === MemberLifecycleStatus.APPLICANT ||
          person.lifecycleStatus === MemberLifecycleStatus.INACTIVE ||
          person.lifecycleStatus === MemberLifecycleStatus.FORMER ||
          person.lifecycleStatus === MemberLifecycleStatus.ARCHIVED ||
          person.lifecycleStatus === MemberLifecycleStatus.ALUMNI) ? (
          <form action={`/people/${person.id}/activate`} method="post" className="mt-3">
            <input type="hidden" name="confirm" value="1" />
            <button
              type="submit"
              className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
            >
              Activate member
            </button>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Activating will change this person&apos;s status to Active. Existing roles, roster memberships, and relationships are not affected.
            </p>
          </form>
        ) : null}
        {(person.lifecycleStatus === MemberLifecycleStatus.ACTIVE ||
          person.lifecycleStatus === MemberLifecycleStatus.PROSPECT ||
          person.lifecycleStatus === MemberLifecycleStatus.APPLICANT ||
          person.lifecycleStatus === MemberLifecycleStatus.ALUMNI) ? (
          <form action={`/people/${person.id}/inactive`} method="post" className="mt-3">
            <input type="hidden" name="confirm" value="1" />
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Mark as inactive
            </button>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Marking as inactive will change this person&apos;s status to Inactive. Roster history, roles, guardian relationships, and all operational records are preserved.
            </p>
          </form>
        ) : null}
        {!TERMINAL_MEMBER_LIFECYCLE_STATUSES.has(person.lifecycleStatus) ? (
          <form action={`/people/${person.id}/archive`} method="post" className="mt-3">
            <input type="hidden" name="confirm" value="1" />
            <button
              type="submit"
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Archive member
            </button>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Archiving will change this person&apos;s status to Archived. Roster history, notes, tasks, attendance, gear records, and all operational history are preserved without deletion.
            </p>
          </form>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Operational relationship summary</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use this summary to see unresolved person-linked work, recent attendance context, and upcoming event impact in one place.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Related notes</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{relatedNotes.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Related follow-up tasks</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{relatedTasks.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Unresolved related items</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {unresolvedRelatedTaskCount + unresolvedRelatedNoteTaskCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Recent attendance context</dt>
            <dd className={attendanceConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {relatedAttendance.length} records ({attendanceConcernCount} concerns)
            </dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming team events (14 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{upcomingTeamEvents.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming events with unresolved tasks</dt>
            <dd className={upcomingEventsWithOpenTasks.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {upcomingEventsWithOpenTasks.length}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={`/notes?athletePersonId=${person.id}`} className="rounded-full border px-2 py-1">
            Person notes
          </Link>
          <Link href={`/notes?athletePersonId=${person.id}&readinessIndicator=needs_review`} className="rounded-full border px-2 py-1">
            Notes needing review
          </Link>
          <Link href={`/tasks?assigneePersonId=${person.id}&resolution=unresolved`} className="rounded-full border px-2 py-1">
            Unresolved person tasks
          </Link>
          <Link href={`/tasks?assigneePersonId=${person.id}&ownershipIndicator=stale_unresolved`} className="rounded-full border px-2 py-1">
            Stale unresolved tasks
          </Link>
          <Link href={`/events?ownerPersonId=${person.id}`} className="rounded-full border px-2 py-1">
            Person-created events
          </Link>
          <Link href={`/tasks?assigneePersonId=${person.id}&changedWindow=last_7d`} className="rounded-full border px-2 py-1">
            Recent related activity
          </Link>
          <Link href="#operational-history" className="rounded-full border px-2 py-1">
            Person change history
          </Link>
        </div>
        {relatedAttendance.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {relatedAttendance.slice(0, 3).map((record) => (
              <li key={record.id} className="rounded-md border p-2">
                <Link href={`/events/${record.event.id}#attendance-workflow`} className="font-medium underline">
                  {record.event.title}
                </Link>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {formatEnumLabel(record.status)} · {record.event.team ? `Team: ${record.event.team.name}` : "No team"} ·{" "}
                  {record.markedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Role assignments</h3>
        {visibleRoles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No role assignments.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {visibleRoles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                <span>
                  {formatEnumLabel(role.roleType)} · {formatEnumLabel(role.scopeType)}
                  {role.scopeType === ScopeType.PROGRAM
                    ? ` · Program: ${role.program?.name ?? "Unknown program"}`
                    : ""}
                  {role.scopeType === ScopeType.TEAM
                    ? ` · Team: ${role.team?.name ?? "Unknown team"}${role.team?.program?.name ? ` (${role.team.program.name})` : ""}`
                    : ""}
                </span>
                <form action={`/people/${person.id}/roles/${role.id}/delete`} method="post">
                  <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40">
                    Remove role
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="assign-role" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Assign role</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Use this form for scoped role assignment only. Organization Admin is managed in admin workflows.
        </p>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Season-based team participation is managed in{" "}
          <Link href={`/people/${person.id}/move`} className="underline">
            Change team/program
          </Link>
          .
        </p>

        {roleError ? <p className="mb-3 text-sm text-red-600">{roleError}</p> : null}

        <MemberRoleAssignmentForm
          action={`/people/${person.id}/roles/create`}
          programs={programs}
          teams={teams}
          defaultRoleType={selectedRoleType}
          defaultScopeType={selectedScopeType}
          defaultProgramId={selectedProgramId}
          defaultTeamId={selectedTeamId}
          scopeOptions={ASSIGNMENT_SCOPE_OPTIONS.map((scopeOption) => ({
            value: scopeOption.value,
            label: scopeOption.label,
          }))}
          programScopeRoleOptions={MEMBEROPS_SCOPED_PROGRAM_ROLE_TYPES.map((roleType) => ({
            value: roleType,
            label: formatEnumLabel(roleType),
          }))}
          teamScopeRoleOptions={MEMBEROPS_SCOPED_TEAM_ROLE_TYPES.map((roleType) => ({
            value: roleType,
            label: formatEnumLabel(roleType),
          }))}
          roleTypeError={roleTypeError || undefined}
          scopeTypeError={scopeTypeError || undefined}
          programIdError={programIdError || undefined}
          teamIdError={teamIdError || undefined}
        />
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Guardian / athlete relationships</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Household foundation is represented through linked guardian/athlete records. Relationship type and guardian role
          are shown for each link.
        </p>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Guardian portal visibility, messaging, notifications, and communications remain deferred.
        </p>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Household snapshot: as athlete/member {pluralize(person.athleteLinks.length, "linked guardian")} · as guardian {pluralize(person.guardianLinks.length, "linked athlete")}.
        </p>
        {canEditGuardianLinkageWhereSupported ? (
          <Link
            href={`/people/${person.id}/guardians`}
            className="mb-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Manage guardian relationships
          </Link>
        ) : null}
        {!canViewGuardianRelationshipDetails ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Guardian relationship details are hidden for this account.
          </p>
        ) : isAthleteProfile ? (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Athlete/member relationship status:{" "}
            {person.athleteLinks.length === 0
              ? "No guardian relationships are currently linked."
              : hasPendingOrIncompleteRelationshipSupport
                ? "Guardian relationships exist with at least one account-link or role-assignment support gap."
                : "Guardian relationships are linked."}
          </p>
        ) : (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            This person currently has no athlete/member profile signal in visible role or roster context.
          </p>
        )}
        {canViewGuardianRelationshipDetails &&
        person.guardianLinks.length === 0 &&
        person.athleteLinks.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No guardian/athlete relationships.</p>
        ) : canViewGuardianRelationshipDetails ? (
          <div className="space-y-3 text-sm">
            {person.guardianLinks.length > 0 ? (
              <div>
                <p className="font-medium">As guardian: linked athletes</p>
                <ul className="mt-1 list-disc pl-5">
                  {person.guardianLinks.map((link) => (
                    <li key={link.id}>
                      {link.athlete.firstName} {link.athlete.lastName} · Relationship: {formatEnumLabel(link.relationshipType)} · Guardian role:{" "}
                      {formatEnumLabel(link.guardianRole)}
                      {canEditGuardianLinkageWhereSupported ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={`/people/${link.athlete.id}/guardians/${link.id}/edit`} className="underline">
                            Edit from athlete workflow
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {person.athleteLinks.length > 0 ? (
              <div>
                <p className="font-medium">As athlete/member: linked guardians</p>
                <ul className="mt-1 list-disc pl-5">
                  {person.athleteLinks.map((link) => (
                    <li key={link.id}>
                      {link.guardian.firstName} {link.guardian.lastName} · Relationship: {formatEnumLabel(link.relationshipType)} · Guardian role:{" "}
                      {formatEnumLabel(link.guardianRole)} ·{" "}
                      {link.guardian._count.userAccounts === 0
                        ? "Guardian account link missing"
                        : link.guardian.roles.length === 0
                          ? "Inactive guardian account signal (linked account, guardian role assignment missing)"
                          : "Guardian account linked and active"}{" "}
                      ·{" "}
                      {link.guardian._count.userAccounts > 0 && link.guardian.roles.length > 0
                        ? "Relationship support complete"
                        : "Pending/incomplete relationship support"}
                      {canEditGuardianLinkageWhereSupported ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={`/people/${person.id}/guardians/${link.id}/edit`} className="underline">
                            Edit
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Roster memberships</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Use these current memberships as the baseline when moving this member to a different team/program context.
        </p>
        {visibleRoster.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No roster memberships. Use{" "}
            <Link href={`/people/${person.id}/move`} className="underline">
              Change team/program
            </Link>{" "}
            to place this member on a team/season roster.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {visibleRoster.map((membership) => (
              <li key={membership.id}>
                Program:{" "}
                <Link href={`/programs/${membership.team.program.id}`} className="underline">
                  {membership.team.program.name}
                </Link>{" "}
                · Team:{" "}
                <Link href={`/teams/${membership.team.id}`} className="underline">
                  {membership.team.name}
                </Link>{" "}
                · Season: {membership.season.name} · Role:{" "}
                {formatEnumLabel(membership.rosterRole)}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/people/${person.id}/move`}
          className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Move member
        </Link>
      </div>

      <OperationalHistoryPanel
        id="operational-history"
        title="Operational history"
        description="Recent person-linked activity derived from lifecycle transitions, guardian relationship changes, tasks, notes, attendance, roster membership, and role assignment context."
        emptyMessage="No recent person-linked operational history was found in the current review window."
        items={personOperationalHistory}
        action={{ href: `/tasks?assigneePersonId=${person.id}`, label: "Open assigned tasks" }}
        footer={
          <>
            Person history includes items where this person is the assignee, creator/author, participant, or direct
            roster/role/lifecycle subject when that context is derivable from current records.
          </>
        }
      />
    </section>
  );
}

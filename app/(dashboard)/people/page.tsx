import Link from "next/link";
import { MemberLifecycleStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
  type StaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { EXPIRING_SOON_WINDOW_DAYS, getExpirationState } from "@/lib/member-ops-qualifications";
import {
  formatMemberOpsOptionalFeatureUnavailableMessage,
  formatMemberOpsPeopleSetupIncompleteMessage,
  logMemberOpsPeopleSchemaIssue,
} from "@/lib/member-ops-schema-guard";
import {
  matchesMemberAssignmentFilter,
  isDefaultVisibleMemberLifecycleStatus,
  MEMBER_LIFECYCLE_STATUS_LABELS,
  MEMBEROPS_ROSTER_ROLE_TYPES,
  MEMBEROPS_TEAM_ROLE_TYPES,
  resolveMemberAssignmentFilter,
} from "@/lib/member-ops";
import { deriveMemberRosterReadiness } from "@/lib/member-ops-roster-readiness";
import { getOrganizationScope } from "@/lib/organization-context";
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

function buildPeopleViewHref(filters: {
  seasonId?: string;
  programId?: string;
  teamId?: string;
  roleFilter?: string;
  lifecycleFilter?: string;
  assignmentFilter?: string;
  guardianFilter?: string;
  readinessFilter?: string;
}) {
  const params = new URLSearchParams();

  if (filters.seasonId) {
    params.set("seasonId", filters.seasonId);
  }
  if (filters.programId) {
    params.set("programId", filters.programId);
  }
  if (filters.teamId) {
    params.set("teamId", filters.teamId);
  }
  if (filters.roleFilter) {
    params.set("roleFilter", filters.roleFilter);
  }
  if (filters.lifecycleFilter) {
    params.set("lifecycleFilter", filters.lifecycleFilter);
  }
  if (filters.assignmentFilter) {
    params.set("assignmentFilter", filters.assignmentFilter);
  }
  if (filters.guardianFilter) {
    params.set("guardianFilter", filters.guardianFilter);
  }
  if (filters.readinessFilter) {
    params.set("readinessFilter", filters.readinessFilter);
  }

  const query = params.toString();
  return query ? `/people?${query}` : "/people";
}

function formatRoleSummary(roleTypes: string[]) {
  if (roleTypes.length === 0) {
    return "No roles assigned";
  }

  return roleTypes
    .map((roleType) => roleType.replaceAll("_", " ").toLowerCase())
    .map((roleType) => roleType.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
}

function formatAssignmentSummary(assignments: Array<{
  roleType: string;
  scopeType: string;
  program: { id: string; name: string } | null;
  team: { id: string; name: string; program: { id: string; name: string } | null } | null;
}>) {
  if (assignments.length === 0) {
    return "No roles assigned";
  }

  const summaries = assignments.map((assignment) => {
    const roleLabel = formatRoleSummary([assignment.roleType]);
    const scopeLabel = assignment.scopeType.replaceAll("_", " ").toLowerCase();
    const titledScopeLabel = scopeLabel.replace(/\b\w/g, (char) => char.toUpperCase());

    if (assignment.scopeType === "PROGRAM") {
      return `${roleLabel} (${titledScopeLabel}${assignment.program ? `: ${assignment.program.name}` : ""})`;
    }

    if (assignment.scopeType === "TEAM") {
      if (assignment.team?.program?.name) {
        return `${roleLabel} (${titledScopeLabel}: ${assignment.team.name} · ${assignment.team.program.name})`;
      }

      return `${roleLabel} (${titledScopeLabel}${assignment.team ? `: ${assignment.team.name}` : ""})`;
    }

    return `${roleLabel} (${titledScopeLabel})`;
  });

  return [...new Set(summaries)].join(", ");
}

function formatTeamMembershipSummary(memberships: Array<{
  team: { id: string; name: string; program: { id: string; name: string } };
}>) {
  if (memberships.length === 0) {
    return "No team memberships";
  }

  const summaries = memberships.map((membership) => `${membership.team.program.name} · ${membership.team.name}`);

  return [...new Set(summaries)].join(", ");
}

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

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Members</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query members right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Members</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
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
    workflow: "people.list.access",
    entityType: "person",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Members</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view people operational workflows.
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
        <h2 className="text-2xl font-semibold tracking-tight">Members</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe people visibility evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  let people:
    | Array<{
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        lifecycleStatus: MemberLifecycleStatus;
        roles: Array<{
          roleType: string;
          scopeType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        roster: Array<{
          rosterRole: string;
          season: { id: string; name: string };
          team: { id: string; name: string; program: { id: string; name: string } };
        }>;
        _count: {
          guardianLinks: number;
          athleteLinks: number;
        };
      }>
    | null = null;
  let peopleLoadErrorMessage: string | null = null;
  let organizationPrograms: Array<{ id: string; name: string; teams: Array<{ id: string; name: string }> }> = [];
  let organizationSeasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }> = [];

  try {
    [people, organizationPrograms, organizationSeasons] = await Promise.all([
      db.person.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(staffScopeResolution.allowAllStaffScope
            ? {}
            : {
                OR: [
                  ...(staffScopeResolution.allowedTeamIds.length > 0
                    ? [{ roster: { some: { organizationId: scope.organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                    : []),
                  ...(staffScopeResolution.allowedTeamIds.length > 0
                    ? [{ roles: { some: { organizationId: scope.organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                    : []),
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ roster: { some: { organizationId: scope.organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                    : []),
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ roles: { some: { organizationId: scope.organizationId, programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                    : []),
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ roles: { some: { organizationId: scope.organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                    : []),
                ],
              }),
        },
        include: {
          roles: {
            select: {
              roleType: true,
              scopeType: true,
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
          },
          roster: {
            select: {
              rosterRole: true,
              season: {
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
          },
          _count: {
            select: {
              guardianLinks: true,
              athleteLinks: true,
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.program.findMany({
        where: {
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          name: true,
          teams: {
            select: {
              id: true,
              name: true,
            },
            orderBy: [{ name: "asc" }],
          },
        },
        orderBy: [{ name: "asc" }],
      }),
      db.season.findMany({
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
      }),
    ]);
    people = people.map((person) => ({
      ...person,
      roles: person.roles.filter((assignment) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          assignment.team?.id ?? null,
          assignment.program?.id ?? assignment.team?.program?.id ?? null,
        ),
      ),
      roster: person.roster.filter((membership) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          membership.team.id,
          membership.team.program.id,
        ),
      ),
    }));
  } catch (error) {
    const schemaIssue = logMemberOpsPeopleSchemaIssue("people.list", error, {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
    });
    peopleLoadErrorMessage = schemaIssue
      ? formatMemberOpsPeopleSetupIncompleteMessage(schemaIssue)
      : "Unable to load members right now. Please try again later.";
    if (!schemaIssue) {
      console.error("[people.page] Failed to load people list", {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
        error,
      });
    }
    people = null;
  }

  if (!people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Members</h2>
        <ErrorMessage message={peopleLoadErrorMessage ?? "Unable to load members right now. Please try again later."} />
      </section>
    );
  }

  const activeSeason = selectSeededOrCurrentSeason(organizationSeasons);
  const requestedSeasonId = readSearchParam(resolvedSearchParams, "seasonId");
  const selectedSeasonId =
    (requestedSeasonId && organizationSeasons.some((season) => season.id === requestedSeasonId)
      ? requestedSeasonId
      : "") ?? "";
  const selectedProgramIdParam = readSearchParam(resolvedSearchParams, "programId");
  const selectedProgramId = organizationPrograms.some((program) => program.id === selectedProgramIdParam)
    ? selectedProgramIdParam
    : "";
  const allTeams = organizationPrograms.flatMap((program) =>
    program.teams.map((team) => ({ ...team, programId: program.id })),
  );
  const visibleTeams = selectedProgramId
    ? allTeams.filter((team) => team.programId === selectedProgramId)
    : allTeams;
  const selectedTeamIdParam = readSearchParam(resolvedSearchParams, "teamId");
  const selectedTeamId = visibleTeams.some((team) => team.id === selectedTeamIdParam)
    ? selectedTeamIdParam
    : "";
  const roleFilterParam = readSearchParam(resolvedSearchParams, "roleFilter");
  const availableRoleFilters = [...new Set([...MEMBEROPS_TEAM_ROLE_TYPES, ...MEMBEROPS_ROSTER_ROLE_TYPES])];
  const roleFilter = availableRoleFilters.includes(roleFilterParam as (typeof availableRoleFilters)[number])
    ? roleFilterParam
    : "";
  const lifecycleFilterParam = readSearchParam(resolvedSearchParams, "lifecycleFilter");
  const lifecycleFilter =
    lifecycleFilterParam === "all" ||
    Object.values(MemberLifecycleStatus).includes(lifecycleFilterParam as MemberLifecycleStatus)
      ? lifecycleFilterParam
      : "all";
  const assignmentFilter = resolveMemberAssignmentFilter(readSearchParam(resolvedSearchParams, "assignmentFilter"));
  const guardianFilterParam = readSearchParam(resolvedSearchParams, "guardianFilter");
  const guardianFilter =
    guardianFilterParam === "all" ||
    guardianFilterParam === "missing_guardian" ||
    guardianFilterParam === "guardian_linked" ||
    guardianFilterParam === "not_applicable"
      ? guardianFilterParam
      : "all";
  const readinessFilterParam = readSearchParam(resolvedSearchParams, "readinessFilter");
  const readinessFilter =
    readinessFilterParam === "all" ||
    readinessFilterParam === "needs_attention" ||
    readinessFilterParam === "ready"
      ? readinessFilterParam
      : "all";

  const enrichedPeople = people.map((person) => {
    const roleProgramIds = new Set(
      person.roles
        .map((role) => role.program?.id ?? role.team?.program?.id ?? null)
        .filter((value): value is string => Boolean(value)),
    );
    const rosterProgramIds = new Set(person.roster.map((membership) => membership.team.program.id));
    const roleTeamIds = new Set(person.roles.map((role) => role.team?.id ?? null).filter((value): value is string => Boolean(value)));
    const rosterTeamIds = new Set(person.roster.map((membership) => membership.team.id));
    const hasCurrentSeasonAssignment = selectedSeasonId
      ? person.roster.some((membership) => membership.season.id === selectedSeasonId)
      : person.roster.length > 0;
    const readiness = deriveMemberRosterReadiness({
      lifecycleStatus: person.lifecycleStatus,
      roleTypes: [...new Set(person.roles.map((role) => role.roleType))],
      rosterRoles: [...new Set(person.roster.map((membership) => membership.rosterRole))],
      membershipCount: person.roster.length,
      athleteGuardianLinkCount: person._count.athleteLinks,
      hasProgramAssignment: roleProgramIds.size > 0 || rosterProgramIds.size > 0,
      hasSeasonAssignment: hasCurrentSeasonAssignment,
      hasProfileEmail: Boolean(person.email),
    });

    return {
      ...person,
      readiness,
      roleProgramIds,
      rosterProgramIds,
      roleTeamIds,
      rosterTeamIds,
      hasCurrentSeasonAssignment,
      hasAnyAssignment: person.roster.length > 0,
    };
  });

  const filteredPeople = enrichedPeople.filter((person) => {
    if (selectedProgramId) {
      const hasProgramMatch = person.roleProgramIds.has(selectedProgramId) || person.rosterProgramIds.has(selectedProgramId);
      if (!hasProgramMatch) {
        return false;
      }
    }
    if (selectedTeamId) {
      const hasTeamMatch = person.roleTeamIds.has(selectedTeamId) || person.rosterTeamIds.has(selectedTeamId);
      if (!hasTeamMatch) {
        return false;
      }
    }
    const assignmentMatches = matchesMemberAssignmentFilter(assignmentFilter, {
      selectedSeasonId,
      hasAnyAssignment: person.hasAnyAssignment,
      hasCurrentSeasonAssignment: person.hasCurrentSeasonAssignment,
    });
    if (!assignmentMatches) {
      return false;
    }
    if (roleFilter) {
      const hasRoleMatch =
        person.roles.some((role) => role.roleType === roleFilter) ||
        person.roster.some((membership) => membership.rosterRole === roleFilter);
      if (!hasRoleMatch) {
        return false;
      }
    }
    if (lifecycleFilter && lifecycleFilter !== "all" && person.lifecycleStatus !== lifecycleFilter) {
      return false;
    }
    if (!lifecycleFilter && !isDefaultVisibleMemberLifecycleStatus(person.lifecycleStatus)) {
      return false;
    }
    if (canViewGuardianRelationshipDetails) {
      if (guardianFilter === "missing_guardian" && !person.readiness.missingGuardian) {
        return false;
      }
      if (guardianFilter === "guardian_linked" && !(person.readiness.isAthlete && !person.readiness.missingGuardian)) {
        return false;
      }
      if (guardianFilter === "not_applicable" && person.readiness.isAthlete) {
        return false;
      }
    }
    if (readinessFilter === "needs_attention" && !person.readiness.needsAttention) {
      return false;
    }
    if (readinessFilter === "ready" && !person.readiness.ready) {
      return false;
    }
    return true;
  });

  const lifecycleCounts = filteredPeople.reduce(
    (counts, person) => {
      counts[person.lifecycleStatus] = (counts[person.lifecycleStatus] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>,
  );
  const activePeopleWithoutRosterMembership = filteredPeople.filter(
    (person) => person.lifecycleStatus === "ACTIVE" && person.roster.length === 0,
  ).length;
  const scopedAthletesMissingGuardianLinkage = canViewGuardianRelationshipDetails
    ? filteredPeople.filter((person) => person.readiness.missingGuardian).length
    : 0;
  const membersNeedingAttention = filteredPeople.filter((person) => person.readiness.needsAttention).length;
  const onboardingIncompleteMembers = filteredPeople.filter((person) => person.readiness.onboardingIncomplete).length;
  const offboardingActionMembers = filteredPeople.filter((person) => person.readiness.offboardingActionRecommended).length;
  const rolloverReviewMembers = filteredPeople.filter((person) => person.readiness.rolloverNeedsReview).length;
  const lifecycleStatusSummary = Object.values(MemberLifecycleStatus)
    .map((status) => `${MEMBER_LIFECYCLE_STATUS_LABELS[status]} ${lifecycleCounts[status] ?? 0}`)
    .join(" · ");
  const visiblePersonIds = filteredPeople.map((person) => person.id);
  let visibleQualificationExpirations: Array<{ expirationDate: Date | null }> = [];
  let visibleCertificationExpirations: Array<{ expirationDate: Date | null }> = [];
  let readinessSetupMessage: string | null = null;

  if (visiblePersonIds.length > 0) {
    try {
      [visibleQualificationExpirations, visibleCertificationExpirations] = await Promise.all([
        db.personQualification.findMany({
          where: {
            organizationId: scope.organizationId,
            personId: { in: visiblePersonIds },
            expirationDate: { not: null },
          },
          select: { expirationDate: true },
        }),
        db.personCertification.findMany({
          where: {
            organizationId: scope.organizationId,
            personId: { in: visiblePersonIds },
            expirationDate: { not: null },
          },
          select: { expirationDate: true },
        }),
      ]);
    } catch (error) {
      const schemaIssue = logMemberOpsPeopleSchemaIssue("people.readiness.expirations", error, {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
        visiblePersonCount: visiblePersonIds.length,
      });
      readinessSetupMessage = schemaIssue
        ? formatMemberOpsOptionalFeatureUnavailableMessage(
            "Qualification and certification summaries",
            schemaIssue,
          )
        : "Qualification and certification summaries are temporarily unavailable right now.";
      if (!schemaIssue) {
        console.error("[people.page] Failed to load readiness expiration summaries", {
          organizationId: scope.organizationId,
          actorPersonId: scope.auth.personId,
          visiblePersonCount: visiblePersonIds.length,
          error,
        });
      }
    }
  }
  const visibleExpiringQualifications = visibleQualificationExpirations.filter(
    (assignment) => getExpirationState(assignment.expirationDate) === "expiringSoon",
  ).length;
  const visibleExpiredQualifications = visibleQualificationExpirations.filter(
    (assignment) => getExpirationState(assignment.expirationDate) === "expired",
  ).length;
  const visibleExpiringCertifications = visibleCertificationExpirations.filter(
    (assignment) => getExpirationState(assignment.expirationDate) === "expiringSoon",
  ).length;
  const visibleExpiredCertifications = visibleCertificationExpirations.filter(
    (assignment) => getExpirationState(assignment.expirationDate) === "expired",
  ).length;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Members"
        description="Manage member lifecycle, roster assignments, and guardian relationships."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/people/qualifications" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Qualification foundation
            </Link>
            <Link href="/people/staffing" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Staffing foundation
            </Link>
            <Link href="/people/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              New member
            </Link>
          </div>
        }
      />

      {people.length === 0 ? (
        <EmptyState message="No members have been added yet." actionHref="/people/new" actionLabel="Add the first member" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-base font-medium">Roster lifecycle readiness</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Active season default: {activeSeason?.name ?? "No active season available"} · Current roster view season:{" "}
              {organizationSeasons.find((season) => season.id === selectedSeasonId)?.name ?? "All seasons"}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Status mix in current scope: {lifecycleStatusSummary}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Members needing attention in current scope: {membersNeedingAttention}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Onboarding incomplete: {onboardingIncompleteMembers} · Offboarding review needed:{" "}
              {offboardingActionMembers} · Rollover readiness review needed: {rolloverReviewMembers}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Active members with no roster membership in current scope: {activePeopleWithoutRosterMembership}.
            </p>
            {readinessSetupMessage ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{readinessSetupMessage}</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Qualification expirations in current scope over the next {EXPIRING_SOON_WINDOW_DAYS} days: {visibleExpiringQualifications} · Qualification expired: {visibleExpiredQualifications}.
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Certification expirations in current scope over the next {EXPIRING_SOON_WINDOW_DAYS} days: {visibleExpiringCertifications} · Certification expired: {visibleExpiredCertifications}.
                </p>
              </>
            )}
            {canViewGuardianRelationshipDetails ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Athlete profiles with no guardian relationship in current scope: {scopedAthletesMissingGuardianLinkage}.
              </p>
            ) : null}
          </div>

          <form action="/people" method="get" className="grid gap-2 rounded-lg border bg-white p-4 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="seasonId" className="text-xs font-medium">
                Season
              </label>
              <select id="seasonId" name="seasonId" defaultValue={selectedSeasonId} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="">All seasons</option>
                {activeSeason ? (
                  <option value={activeSeason.id}>{activeSeason.name} (active)</option>
                ) : null}
                {organizationSeasons
                  .filter((season) => season.id !== activeSeason?.id)
                  .map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="programId" className="text-xs font-medium">
                Program
              </label>
              <select id="programId" name="programId" defaultValue={selectedProgramId} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="">All programs</option>
                {organizationPrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="teamId" className="text-xs font-medium">
                Team
              </label>
              <select id="teamId" name="teamId" defaultValue={selectedTeamId} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="">All teams</option>
                {visibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="roleFilter" className="text-xs font-medium">
                Role
              </label>
              <select id="roleFilter" name="roleFilter" defaultValue={roleFilter} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="">All roles</option>
                {availableRoleFilters.map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {formatRoleSummary([roleType])}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="lifecycleFilter" className="text-xs font-medium">
                Lifecycle status
              </label>
              <select id="lifecycleFilter" name="lifecycleFilter" defaultValue={lifecycleFilter} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="all">All statuses</option>
                <option value="">Active + Prospect only</option>
                {Object.values(MemberLifecycleStatus).map((status) => (
                  <option key={status} value={status}>
                    {MEMBER_LIFECYCLE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="assignmentFilter" className="text-xs font-medium">
                Assignment status
              </label>
              <select id="assignmentFilter" name="assignmentFilter" defaultValue={assignmentFilter} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="current_season_assigned">Assigned in selected season</option>
                <option value="unassigned">Unassigned only</option>
                <option value="all">All assignment states</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="guardianFilter" className="text-xs font-medium">
                Guardian readiness
              </label>
              <select id="guardianFilter" name="guardianFilter" defaultValue={guardianFilter} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="all">All guardian states</option>
                <option value="missing_guardian">Missing guardian</option>
                <option value="guardian_linked">Guardian linked</option>
                <option value="not_applicable">Not athlete / no guardian requirement</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="readinessFilter" className="text-xs font-medium">
                Readiness state
              </label>
              <select id="readinessFilter" name="readinessFilter" defaultValue={readinessFilter} className="w-full rounded-md border px-2 py-1 text-sm">
                <option value="all">All readiness states</option>
                <option value="needs_attention">Needs attention</option>
                <option value="ready">Ready</option>
              </select>
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Apply filters
              </button>
              <Link href={buildPeopleViewHref({})} className="rounded-md border px-3 py-1.5 text-sm">
                Reset
              </Link>
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3 font-medium">First name</th>
                  <th className="px-4 py-3 font-medium">Last name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Team / Program</th>
                  <th className="px-4 py-3 font-medium">Readiness</th>
                  <th className="px-4 py-3 font-medium">Transition readiness</th>
                  {canViewGuardianRelationshipDetails ? (
                    <th className="px-4 py-3 font-medium">Guardian links</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => {
                  return (
                    <tr key={person.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <Link href={`/people/${person.id}`} className="underline">
                          {person.firstName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{person.lastName}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{person.email ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {MEMBER_LIFECYCLE_STATUS_LABELS[person.lifecycleStatus]}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatAssignmentSummary(person.roles)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatTeamMembershipSummary(person.roster)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
                            person.readiness.needsAttention
                              ? "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
                              : "border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {person.readiness.needsAttention ? "Needs attention" : "Ready"}
                        </span>
                        {person.readiness.labels.length > 0 ? (
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{person.readiness.labels.join(" · ")}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        <p className="text-xs">
                          Onboarding: {person.readiness.onboardingIncomplete ? "Incomplete" : "Ready"}
                        </p>
                        <p className="mt-1 text-xs">
                          Offboarding: {person.readiness.offboardingActionRecommended ? "Review needed" : "No action"}
                        </p>
                        <p className="mt-1 text-xs">
                          Rollover:{" "}
                          {person.readiness.rolloverReady
                            ? "Ready"
                            : person.readiness.rolloverNeedsReview
                              ? "Needs review"
                              : "Not applicable"}
                        </p>
                      </td>
                      {canViewGuardianRelationshipDetails ? (
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          Guardian for {person._count.guardianLinks} athlete{person._count.guardianLinks === 1 ? "" : "s"} ·
                          Athlete linked to {person._count.athleteLinks} guardian{person._count.athleteLinks === 1 ? "" : "s"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredPeople.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No members match the selected season/program/team/role/status/readiness filters.
            </p>
          ) : null}
        </div>
      )}
      {!canViewGuardianRelationshipDetails ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Guardian relationship diagnostics are limited to staff role assignments for youth privacy.
        </p>
      ) : null}
    </section>
  );
}

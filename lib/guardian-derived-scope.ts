import { MemberLifecycleStatus, RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

type GuardianDependentScopeSnapshot = {
  athletePersonId: string;
  athlete: {
    lifecycleStatus: MemberLifecycleStatus;
    roles: Array<{
      roleType: RoleType;
      scopeType: ScopeType;
      programId: string | null;
      teamId: string | null;
      team: { programId: string } | null;
    }>;
    roster: Array<{
      rosterRole: RoleType;
      teamId: string;
      team: { programId: string };
      season: { startDate: Date | null; endDate: Date | null };
    }>;
  };
};

export type GuardianDerivedScope = {
  dependentAthleteIds: string[];
  derivedProgramIds: string[];
  derivedTeamIds: string[];
};

function isActiveSeason(season: { startDate: Date | null; endDate: Date | null }, now: Date): boolean {
  if (!season.startDate && !season.endDate) {
    return true;
  }

  return (!season.startDate || season.startDate <= now) && (!season.endDate || season.endDate >= now);
}

export function buildGuardianDerivedScope(
  relationships: GuardianDependentScopeSnapshot[],
  now = new Date(),
): GuardianDerivedScope {
  const dependentAthleteIds = new Set<string>();
  const derivedProgramIds = new Set<string>();
  const derivedTeamIds = new Set<string>();

  for (const relationship of relationships) {
    if (relationship.athlete.lifecycleStatus !== MemberLifecycleStatus.ACTIVE) {
      continue;
    }

    dependentAthleteIds.add(relationship.athletePersonId);

    for (const membership of relationship.athlete.roster) {
      if (membership.rosterRole !== RoleType.ATHLETE || !isActiveSeason(membership.season, now)) {
        continue;
      }

      derivedProgramIds.add(membership.team.programId);
      derivedTeamIds.add(membership.teamId);
    }

    for (const assignment of relationship.athlete.roles) {
      if (assignment.roleType !== RoleType.ATHLETE) {
        continue;
      }

      if (assignment.scopeType === ScopeType.PROGRAM && assignment.programId) {
        derivedProgramIds.add(assignment.programId);
      }

      if (assignment.scopeType === ScopeType.TEAM && assignment.teamId) {
        derivedTeamIds.add(assignment.teamId);
        if (assignment.team?.programId) {
          derivedProgramIds.add(assignment.team.programId);
        }
      }
    }
  }

  return {
    dependentAthleteIds: Array.from(dependentAthleteIds),
    derivedProgramIds: Array.from(derivedProgramIds),
    derivedTeamIds: Array.from(derivedTeamIds),
  };
}

export async function resolveGuardianDerivedScope(input: {
  organizationId: string;
  guardianPersonId: string;
}): Promise<GuardianDerivedScope> {
  const relationships = await db.athleteGuardianRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      guardianPersonId: input.guardianPersonId,
      athlete: {
        lifecycleStatus: MemberLifecycleStatus.ACTIVE,
      },
    },
    select: {
      athletePersonId: true,
      athlete: {
        select: {
          lifecycleStatus: true,
          roles: {
            where: {
              organizationId: input.organizationId,
              roleType: RoleType.ATHLETE,
            },
            select: {
              roleType: true,
              scopeType: true,
              programId: true,
              teamId: true,
              team: {
                select: { programId: true },
              },
            },
          },
          roster: {
            where: {
              organizationId: input.organizationId,
              rosterRole: RoleType.ATHLETE,
            },
            select: {
              rosterRole: true,
              teamId: true,
              team: {
                select: { programId: true },
              },
              season: {
                select: { startDate: true, endDate: true },
              },
            },
          },
        },
      },
    },
  });

  return buildGuardianDerivedScope(relationships);
}

import { RoleType } from "@prisma/client";

export type RosterMembershipDuplicateCandidate = {
  id: string;
  personId: string;
  teamId: string;
  seasonId: string;
  rosterRole: RoleType;
  team: {
    name: string;
    programId: string;
  };
};

export type RosterMembershipDuplicateTarget = {
  personId: string;
  teamId: string;
  seasonId: string;
  rosterRole: RoleType;
  programId: string;
  seasonName?: string;
};

export type RosterMembershipDuplicateDecision =
  | {
      duplicate: false;
    }
  | {
      duplicate: true;
      kind: "TEAM_SEASON" | "PROGRAM_SEASON";
      membership: RosterMembershipDuplicateCandidate;
      message: string;
    };

export function findRosterMembershipDuplicate(input: {
  existingMemberships: RosterMembershipDuplicateCandidate[];
  target: RosterMembershipDuplicateTarget;
  sourceMembershipId?: string | null;
  programSeasonDuplicateRoles?: RoleType[];
}): RosterMembershipDuplicateDecision {
  const sourceMembershipId = input.sourceMembershipId ?? null;
  const programSeasonDuplicateRoles = input.programSeasonDuplicateRoles ?? [RoleType.ATHLETE];
  const candidates = input.existingMemberships.filter(
    (membership) => membership.personId === input.target.personId && membership.id !== sourceMembershipId,
  );
  const exactDuplicate = candidates.find(
    (membership) =>
      membership.teamId === input.target.teamId && membership.seasonId === input.target.seasonId,
  );

  if (exactDuplicate) {
    return {
      duplicate: true,
      kind: "TEAM_SEASON",
      membership: exactDuplicate,
      message: input.target.seasonName
        ? `That person already has a ${input.target.seasonName} roster membership on this team.`
        : "That person already has that team/season roster membership.",
    };
  }

  if (!programSeasonDuplicateRoles.includes(input.target.rosterRole)) {
    return { duplicate: false };
  }

  const programSeasonDuplicate = candidates.find(
    (membership) =>
      membership.seasonId === input.target.seasonId && membership.team.programId === input.target.programId,
  );

  if (programSeasonDuplicate) {
    const seasonName = input.target.seasonName ? `${input.target.seasonName} ` : "";

    return {
      duplicate: true,
      kind: "PROGRAM_SEASON",
      membership: programSeasonDuplicate,
      message:
        input.target.rosterRole === RoleType.ATHLETE
          ? `Athlete duplicate blocked: this person already has a ${seasonName}team membership in this program (${programSeasonDuplicate.team.name}).`
          : `This person already has a ${seasonName}membership in this program (${programSeasonDuplicate.team.name}).`,
    };
  }

  return { duplicate: false };
}

import { ProgramParticipationStatus } from "@prisma/client";

export type ProgramParticipationProgram = {
  id: string;
  name: string;
};

export type ProgramParticipationSeason = {
  id: string;
  name: string;
};

export type ProgramParticipationTeam = {
  id: string;
  name: string;
  program: ProgramParticipationProgram | null;
};

export type ExplicitProgramParticipation = {
  id: string;
  status: ProgramParticipationStatus;
  program: ProgramParticipationProgram;
  season: ProgramParticipationSeason | null;
};

export type RoleDerivedProgramParticipation = {
  roleType: string;
  program: ProgramParticipationProgram | null;
  team: ProgramParticipationTeam | null;
};

export type RosterDerivedProgramParticipation = {
  rosterRole: string;
  team: ProgramParticipationTeam;
};

export type ProgramParticipationCandidate = {
  personId: string;
  programId: string;
  programName: string;
  seasonId: string | null;
  seasonName: string | null;
  source: "EXPLICIT" | "ROLE" | "ROSTER";
  sourceLabel: string;
  status: ProgramParticipationStatus | null;
};

export type ProgramParticipationContext = {
  personId: string;
  programId: string;
  programName: string;
  seasonId: string | null;
  seasonName: string | null;
  sources: Array<ProgramParticipationCandidate["source"]>;
  sourceLabels: string[];
  hasExplicitParticipation: boolean;
  status: ProgramParticipationStatus | null;
};

export type ProgramParticipationDuplicateTarget = {
  id?: string;
  organizationId: string;
  personId: string;
  programId: string;
  seasonId: string | null;
};

export function buildProgramParticipationKey(input: {
  personId: string;
  programId: string;
  seasonId: string | null;
}): string {
  return `${input.personId}:${input.programId}:${input.seasonId ?? "evergreen"}`;
}

export function deriveProgramParticipationCandidates(input: {
  personId: string;
  roles: readonly RoleDerivedProgramParticipation[];
  roster: readonly RosterDerivedProgramParticipation[];
}): ProgramParticipationCandidate[] {
  const candidates: ProgramParticipationCandidate[] = [];

  for (const membership of input.roster) {
    const program = membership.team.program;
    if (!program) {
      continue;
    }

    candidates.push({
      personId: input.personId,
      programId: program.id,
      programName: program.name,
      seasonId: null,
      seasonName: null,
      source: "ROSTER",
      sourceLabel: membership.team.name,
      status: null,
    });
  }

  for (const role of input.roles) {
    const program = role.program ?? role.team?.program ?? null;
    if (!program) {
      continue;
    }

    candidates.push({
      personId: input.personId,
      programId: program.id,
      programName: program.name,
      seasonId: null,
      seasonName: null,
      source: "ROLE",
      sourceLabel: role.roleType,
      status: null,
    });
  }

  return candidates;
}

export function explicitProgramParticipationCandidates(input: {
  personId: string;
  participations: readonly ExplicitProgramParticipation[];
}): ProgramParticipationCandidate[] {
  return input.participations.map((participation) => ({
    personId: input.personId,
    programId: participation.program.id,
    programName: participation.program.name,
    seasonId: participation.season?.id ?? null,
    seasonName: participation.season?.name ?? null,
    source: "EXPLICIT",
    sourceLabel: "Program participation",
    status: participation.status,
  }));
}

export function mergeProgramParticipationCandidates(
  candidates: readonly ProgramParticipationCandidate[],
): ProgramParticipationContext[] {
  const contexts = new Map<string, ProgramParticipationContext>();

  for (const candidate of candidates) {
    const key = buildProgramParticipationKey(candidate);
    const existing = contexts.get(key);

    if (!existing) {
      contexts.set(key, {
        personId: candidate.personId,
        programId: candidate.programId,
        programName: candidate.programName,
        seasonId: candidate.seasonId,
        seasonName: candidate.seasonName,
        sources: [candidate.source],
        sourceLabels: [candidate.sourceLabel],
        hasExplicitParticipation: candidate.source === "EXPLICIT",
        status: candidate.status,
      });
      continue;
    }

    if (!existing.sources.includes(candidate.source)) {
      existing.sources.push(candidate.source);
    }
    if (!existing.sourceLabels.includes(candidate.sourceLabel)) {
      existing.sourceLabels.push(candidate.sourceLabel);
    }
    existing.hasExplicitParticipation = existing.hasExplicitParticipation || candidate.source === "EXPLICIT";
    existing.status = existing.status ?? candidate.status;
  }

  return [...contexts.values()].sort((left, right) => {
    const programComparison = left.programName.localeCompare(right.programName);
    if (programComparison !== 0) {
      return programComparison;
    }
    return (left.seasonName ?? "").localeCompare(right.seasonName ?? "");
  });
}

export function mergeExplicitAndDerivedProgramParticipation(input: {
  personId: string;
  participations: readonly ExplicitProgramParticipation[];
  roles: readonly RoleDerivedProgramParticipation[];
  roster: readonly RosterDerivedProgramParticipation[];
}): ProgramParticipationContext[] {
  return mergeProgramParticipationCandidates([
    ...explicitProgramParticipationCandidates({
      personId: input.personId,
      participations: input.participations,
    }),
    ...deriveProgramParticipationCandidates({
      personId: input.personId,
      roles: input.roles,
      roster: input.roster,
    }),
  ]);
}

export function findExactProgramParticipationDuplicate(input: {
  existingParticipations: readonly ProgramParticipationDuplicateTarget[];
  target: ProgramParticipationDuplicateTarget;
  sourceParticipationId?: string | null;
}): ProgramParticipationDuplicateTarget | null {
  return (
    input.existingParticipations.find(
      (participation) =>
        participation.organizationId === input.target.organizationId &&
        participation.personId === input.target.personId &&
        participation.programId === input.target.programId &&
        (participation.seasonId ?? null) === (input.target.seasonId ?? null) &&
        (!participation.id || participation.id !== input.sourceParticipationId),
    ) ?? null
  );
}

export function hasProgramParticipationInScope(input: {
  contexts: readonly ProgramParticipationContext[];
  allowedProgramIds: readonly string[];
  allowAllStaffScope: boolean;
}): boolean {
  if (input.allowAllStaffScope) {
    return input.contexts.length > 0;
  }

  return input.contexts.some((context) => input.allowedProgramIds.includes(context.programId));
}

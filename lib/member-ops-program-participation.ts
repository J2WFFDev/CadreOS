import { ProgramParticipationStatus, type Prisma } from "@prisma/client";

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
  return input.participations
    .filter((participation) => participation.status === ProgramParticipationStatus.ACTIVE)
    .map((participation) => ({
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

export function hasActiveExplicitProgramParticipationInScope(input: {
  participations: readonly ExplicitProgramParticipation[];
  allowedProgramIds: readonly string[];
  allowAllStaffScope: boolean;
}): boolean {
  return input.participations.some(
    (participation) =>
      participation.status === ProgramParticipationStatus.ACTIVE &&
      (input.allowAllStaffScope || input.allowedProgramIds.includes(participation.program.id)),
  );
}

export type ProgramParticipationStaffScope = {
  allowAllStaffScope: boolean;
  allowedProgramIds: readonly string[];
};

export function buildActiveProgramParticipationWhere(input: {
  organizationId: string;
  staffScopeResolution: ProgramParticipationStaffScope;
}): Prisma.ProgramParticipationWhereInput {
  return {
    organizationId: input.organizationId,
    status: ProgramParticipationStatus.ACTIVE,
    ...(input.staffScopeResolution.allowAllStaffScope
      ? {}
      : { programId: { in: [...input.staffScopeResolution.allowedProgramIds] } }),
  };
}

export function buildProgramParticipationReviewWhere(input: {
  organizationId: string;
  staffScopeResolution: ProgramParticipationStaffScope;
}): Prisma.ProgramParticipationWhereInput {
  return {
    organizationId: input.organizationId,
    ...(input.staffScopeResolution.allowAllStaffScope
      ? {}
      : { programId: { in: [...input.staffScopeResolution.allowedProgramIds] } }),
  };
}

export function buildActiveProgramParticipationPersonVisibilityFilters(input: {
  organizationId: string;
  staffScopeResolution: ProgramParticipationStaffScope;
}): Prisma.PersonWhereInput[] {
  if (input.staffScopeResolution.allowAllStaffScope || input.staffScopeResolution.allowedProgramIds.length === 0) {
    return [];
  }

  return [
    {
      programParticipations: {
        some: buildActiveProgramParticipationWhere(input),
      },
    },
  ];
}

export type ProgramParticipationBackfillRosterMembership = {
  id: string;
  personId: string;
  rosterRole: string;
  status?: ProgramParticipationStatus | null;
  isHistorical?: boolean;
  team: {
    id: string;
    name: string;
    program: ProgramParticipationProgram | null;
  };
  season?: ProgramParticipationSeason | null;
};

export type ProgramParticipationBackfillRoleAssignment = {
  id: string;
  personId: string;
  roleType: string;
  status?: ProgramParticipationStatus | null;
  isHistorical?: boolean;
  program?: ProgramParticipationProgram | null;
  team?: ProgramParticipationTeam | null;
};

export type ProgramParticipationBackfillCandidate = {
  personId: string;
  programId: string;
  programName: string;
  seasonId: string | null;
  seasonName: string | null;
  proposedStatus: ProgramParticipationStatus;
  sources: Array<"ROSTER" | "ROLE_PROGRAM" | "ROLE_TEAM">;
  sourceIds: string[];
  sourceLabels: string[];
};

function isCurrentBackfillSource(input: {
  status?: ProgramParticipationStatus | null;
  isHistorical?: boolean;
  includeInactive: boolean;
  includeHistorical: boolean;
}): boolean {
  const isInactive = input.status === ProgramParticipationStatus.INACTIVE;
  const isHistorical = Boolean(input.isHistorical);

  if (isInactive && isHistorical) {
    return input.includeInactive || input.includeHistorical;
  }

  if (isInactive) {
    return input.includeInactive;
  }

  if (isHistorical) {
    return input.includeHistorical;
  }

  return true;
}

function addBackfillCandidate(
  candidates: Map<string, ProgramParticipationBackfillCandidate>,
  candidate: Omit<ProgramParticipationBackfillCandidate, "sources" | "sourceIds" | "sourceLabels"> & {
    source: ProgramParticipationBackfillCandidate["sources"][number];
    sourceId: string;
    sourceLabel: string;
  },
): void {
  const key = buildProgramParticipationKey(candidate);
  const existing = candidates.get(key);

  if (!existing) {
    candidates.set(key, {
      personId: candidate.personId,
      programId: candidate.programId,
      programName: candidate.programName,
      seasonId: candidate.seasonId,
      seasonName: candidate.seasonName,
      proposedStatus: candidate.proposedStatus,
      sources: [candidate.source],
      sourceIds: [candidate.sourceId],
      sourceLabels: [candidate.sourceLabel],
    });
    return;
  }

  if (!existing.sources.includes(candidate.source)) {
    existing.sources.push(candidate.source);
  }
  if (!existing.sourceIds.includes(candidate.sourceId)) {
    existing.sourceIds.push(candidate.sourceId);
  }
  if (!existing.sourceLabels.includes(candidate.sourceLabel)) {
    existing.sourceLabels.push(candidate.sourceLabel);
  }
}

export function buildProgramParticipationBackfillCandidates(input: {
  rosterMemberships: readonly ProgramParticipationBackfillRosterMembership[];
  roleAssignments: readonly ProgramParticipationBackfillRoleAssignment[];
  includeInactive?: boolean;
  includeHistorical?: boolean;
}): ProgramParticipationBackfillCandidate[] {
  const includeInactive = input.includeInactive ?? false;
  const includeHistorical = input.includeHistorical ?? false;
  const candidates = new Map<string, ProgramParticipationBackfillCandidate>();

  for (const membership of input.rosterMemberships) {
    const program = membership.team.program;
    if (!program || !isCurrentBackfillSource({ ...membership, includeInactive, includeHistorical })) {
      continue;
    }

    addBackfillCandidate(candidates, {
      personId: membership.personId,
      programId: program.id,
      programName: program.name,
      seasonId: membership.season?.id ?? null,
      seasonName: membership.season?.name ?? null,
      proposedStatus: ProgramParticipationStatus.ACTIVE,
      source: "ROSTER",
      sourceId: membership.id,
      sourceLabel: membership.team.name,
    });
  }

  for (const assignment of input.roleAssignments) {
    if (!isCurrentBackfillSource({ ...assignment, includeInactive, includeHistorical })) {
      continue;
    }

    const program = assignment.program ?? assignment.team?.program ?? null;
    if (!program) {
      continue;
    }

    addBackfillCandidate(candidates, {
      personId: assignment.personId,
      programId: program.id,
      programName: program.name,
      seasonId: null,
      seasonName: null,
      proposedStatus: ProgramParticipationStatus.ACTIVE,
      source: assignment.program ? "ROLE_PROGRAM" : "ROLE_TEAM",
      sourceId: assignment.id,
      sourceLabel: assignment.roleType,
    });
  }

  return [...candidates.values()].sort((left, right) => {
    const personComparison = left.personId.localeCompare(right.personId);
    if (personComparison !== 0) {
      return personComparison;
    }

    const programComparison = left.programName.localeCompare(right.programName);
    if (programComparison !== 0) {
      return programComparison;
    }

    return (left.seasonName ?? "").localeCompare(right.seasonName ?? "");
  });
}

import { NoteVisibility, type Prisma } from "@prisma/client";

export type OperationalVisibilityClass =
  | "STAFF_ONLY"
  | "TEAM_STAFF"
  | "ORGANIZATION_SCOPED"
  | "UNRESOLVED";

export type OperationalVisibilityClassification = {
  visibilityClass: OperationalVisibilityClass;
  teamId: string | null;
  programId: string | null;
  reason: string;
};

export const SUPPORTED_OPERATIONAL_NOTE_VISIBILITY = NoteVisibility.STAFF_ONLY;

export function classifyObservationNoteOperationalVisibility(input: {
  visibility: NoteVisibility | null | undefined;
  teamId?: string | null;
  eventTeamId?: string | null;
  teamProgramId?: string | null;
  eventProgramId?: string | null;
}): OperationalVisibilityClassification {
  if (!input.visibility || input.visibility !== SUPPORTED_OPERATIONAL_NOTE_VISIBILITY) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Observation note visibility is unresolved or unsupported for current operational workflows.",
    };
  }

  if (input.teamId && input.eventTeamId && input.teamId !== input.eventTeamId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Observation note has conflicting direct-team and event-team visibility context.",
    };
  }

  if (input.teamProgramId && input.eventProgramId && input.teamProgramId !== input.eventProgramId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Observation note has conflicting direct-team and event-program visibility context.",
    };
  }

  if (input.teamId && !input.teamProgramId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Observation note team ownership scope is unresolved because team program context is missing.",
    };
  }

  if (input.eventTeamId && !input.eventProgramId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Observation note event ownership scope is unresolved because event program context is missing.",
    };
  }

  const teamId = input.teamId ?? input.eventTeamId ?? null;
  const programId = input.teamProgramId ?? input.eventProgramId ?? null;

  if (teamId) {
    return {
      visibilityClass: "TEAM_STAFF",
      teamId,
      programId,
      reason: "Observation note is staff-only with resolved team-linked operational context.",
    };
  }

  return {
    visibilityClass: "ORGANIZATION_SCOPED",
    teamId: null,
    programId: null,
    reason: "Observation note is staff-only with organization-scoped operational context.",
  };
}

export function classifyFollowUpTaskOperationalVisibility(input: {
  sourceNoteId?: string | null;
  sourceEventId?: string | null;
  sourceNoteVisibility?: NoteVisibility | null;
  sourceNoteEventId?: string | null;
  sourceNoteTeamId?: string | null;
  sourceNoteEventTeamId?: string | null;
  sourceEventTeamId?: string | null;
  sourceNoteTeamProgramId?: string | null;
  sourceNoteEventProgramId?: string | null;
  sourceEventProgramId?: string | null;
}): OperationalVisibilityClassification {
  if (
    input.sourceNoteVisibility &&
    input.sourceNoteVisibility !== SUPPORTED_OPERATIONAL_NOTE_VISIBILITY
  ) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task source note visibility is unresolved or unsupported for current operational workflows.",
    };
  }

  if (
    input.sourceNoteId &&
    input.sourceEventId &&
    input.sourceNoteEventId &&
    input.sourceNoteEventId !== input.sourceEventId
  ) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task source note and source event relationships conflict and cannot be safely inherited.",
    };
  }

  if (input.sourceEventTeamId && !input.sourceEventProgramId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task source event ownership scope is unresolved because event program context is missing.",
    };
  }

  if (input.sourceNoteTeamId && !input.sourceNoteTeamProgramId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task source note team ownership scope is unresolved because team program context is missing.",
    };
  }

  if (input.sourceNoteEventTeamId && !input.sourceNoteEventProgramId) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task source note-event ownership scope is unresolved because event program context is missing.",
    };
  }

  const teamCandidates = Array.from(
    new Set(
      [
        input.sourceEventTeamId ?? null,
        input.sourceNoteTeamId ?? null,
        input.sourceNoteEventTeamId ?? null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const programCandidates = Array.from(
    new Set(
      [
        input.sourceEventProgramId ?? null,
        input.sourceNoteTeamProgramId ?? null,
        input.sourceNoteEventProgramId ?? null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  if (teamCandidates.length > 1) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task linked records imply conflicting team visibility context.",
    };
  }

  if (programCandidates.length > 1) {
    return {
      visibilityClass: "UNRESOLVED",
      teamId: null,
      programId: null,
      reason: "Task linked records imply conflicting program visibility context.",
    };
  }

  const teamId = teamCandidates[0] ?? null;
  const programId = programCandidates[0] ?? null;

  if (teamId) {
    return {
      visibilityClass: "TEAM_STAFF",
      teamId,
      programId,
      reason: "Follow-up task has resolved team-linked operational context.",
    };
  }

  return {
    visibilityClass: "ORGANIZATION_SCOPED",
    teamId: null,
    programId: null,
    reason: "Follow-up task defaults to organization-scoped operational visibility.",
  };
}

export function buildSupportedTaskSourceNoteVisibilityWhere(): Prisma.FollowUpTaskWhereInput {
  return {
    OR: [
      { sourceNoteId: null },
      { sourceNote: { is: { visibility: SUPPORTED_OPERATIONAL_NOTE_VISIBILITY } } },
    ],
  };
}

export function hasResolvedFollowUpTaskOperationalVisibility(input: {
  sourceNoteId?: string | null;
  sourceEventId?: string | null;
  sourceNoteVisibility?: NoteVisibility | null;
  sourceNoteEventId?: string | null;
  sourceNoteTeamId?: string | null;
  sourceNoteEventTeamId?: string | null;
  sourceEventTeamId?: string | null;
  sourceNoteTeamProgramId?: string | null;
  sourceNoteEventProgramId?: string | null;
  sourceEventProgramId?: string | null;
}): boolean {
  return (
    classifyFollowUpTaskOperationalVisibility(input).visibilityClass !== "UNRESOLVED"
  );
}

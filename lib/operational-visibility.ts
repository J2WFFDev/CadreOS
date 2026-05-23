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
  sourceNoteVisibility?: NoteVisibility | null;
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

  const teamId =
    input.sourceEventTeamId ?? input.sourceNoteTeamId ?? input.sourceNoteEventTeamId ?? null;
  const programId =
    input.sourceEventProgramId ??
    input.sourceNoteTeamProgramId ??
    input.sourceNoteEventProgramId ??
    null;

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

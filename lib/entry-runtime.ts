import {
  EntryRuntimeKind,
  EntryRuntimeSourceModelType,
  EntryRuntimeVisibilityClass,
  NoteVisibility,
} from "@prisma/client";

import {
  classifyCommunicationCategoryNotificationCandidate,
  classifyEntryRuntimeCommunicationCategory,
  getInternalCommunicationEventClassification,
  getInternalNotificationCandidateEvaluation,
  type InternalCommunicationEventClassification,
  type InternalNotificationCandidateEvaluation,
} from "@/lib/communication-classification";
import { db } from "@/lib/db";
import { classifyFollowUpTaskOperationalVisibility } from "@/lib/operational-visibility";

export type EntryRuntimeRefWriteOutcome = "disabled" | "skipped" | "upserted";

export type ObservationNoteEntryRuntimeSummary =
  | {
      status: "linked";
      communicationClassification: InternalCommunicationEventClassification;
      notificationCandidateEvaluation: InternalNotificationCandidateEvaluation;
      entryRuntimeRef: {
        id: string;
        sourceModelType: EntryRuntimeSourceModelType;
        sourceModelId: string;
        entryKind: EntryRuntimeKind;
        authorPersonId: string;
        visibilityClass: EntryRuntimeVisibilityClass;
        athletePersonId: string | null;
        teamId: string | null;
        eventId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  | {
      status: "not_linked";
      entryRuntimeRef: null;
    };

export type FollowUpTaskEntryRuntimeSummary =
  | {
      status: "linked";
      communicationClassification: InternalCommunicationEventClassification;
      notificationCandidateEvaluation: InternalNotificationCandidateEvaluation;
      entryRuntimeRef: {
        id: string;
        sourceModelType: EntryRuntimeSourceModelType;
        sourceModelId: string;
        entryKind: EntryRuntimeKind;
        authorPersonId: string;
        visibilityClass: EntryRuntimeVisibilityClass;
        athletePersonId: string | null;
        teamId: string | null;
        eventId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  | {
      status: "not_linked";
      entryRuntimeRef: null;
    };

export function isObservationNoteEntryRuntimeRefWriteEnabled() {
  const rawValue = process.env.CADREOS_ENTRY_RUNTIME_NOTES_SIDECAR_WRITE?.toLowerCase();

  return rawValue === "1" || rawValue === "true" || rawValue === "yes" || rawValue === "on";
}

export function isFollowUpTaskEntryRuntimeRefWriteEnabled() {
  const rawValue = process.env.CADREOS_ENTRY_RUNTIME_TASKS_SIDECAR_WRITE?.toLowerCase();

  return rawValue === "1" || rawValue === "true" || rawValue === "yes" || rawValue === "on";
}

export async function writeObservationNoteEntryRuntimeRef(input: {
  organizationId: string;
  note: {
    id: string;
    organizationId: string;
    authorPersonId: string;
    visibility: NoteVisibility;
    athletePersonId: string | null;
    teamId: string | null;
    eventId: string | null;
  };
}): Promise<EntryRuntimeRefWriteOutcome> {
  if (!isObservationNoteEntryRuntimeRefWriteEnabled()) {
    return "disabled";
  }

  if (input.note.organizationId !== input.organizationId) {
    return "skipped";
  }

  if (input.note.visibility !== NoteVisibility.STAFF_ONLY) {
    return "skipped";
  }

  await db.entryRuntimeRef.upsert({
    where: {
      organizationId_sourceModelType_sourceModelId: {
        organizationId: input.organizationId,
        sourceModelType: EntryRuntimeSourceModelType.OBSERVATION_NOTE,
        sourceModelId: input.note.id,
      },
    },
    create: {
      organizationId: input.organizationId,
      sourceModelType: EntryRuntimeSourceModelType.OBSERVATION_NOTE,
      sourceModelId: input.note.id,
      entryKind: EntryRuntimeKind.NOTE,
      authorPersonId: input.note.authorPersonId,
      visibilityClass: EntryRuntimeVisibilityClass.STAFF_ONLY,
      athletePersonId: input.note.athletePersonId,
      teamId: input.note.teamId,
      eventId: input.note.eventId,
    },
    update: {
      authorPersonId: input.note.authorPersonId,
      visibilityClass: EntryRuntimeVisibilityClass.STAFF_ONLY,
      athletePersonId: input.note.athletePersonId,
      teamId: input.note.teamId,
      eventId: input.note.eventId,
    },
  });

  return "upserted";
}

export async function getObservationNoteEntryRuntimeSummary(input: {
  organizationId: string;
  noteId: string;
}): Promise<ObservationNoteEntryRuntimeSummary> {
  const entryRuntimeRef = await db.entryRuntimeRef.findUnique({
    where: {
      organizationId_sourceModelType_sourceModelId: {
        organizationId: input.organizationId,
        sourceModelType: EntryRuntimeSourceModelType.OBSERVATION_NOTE,
        sourceModelId: input.noteId,
      },
    },
    select: {
      id: true,
      sourceModelType: true,
      sourceModelId: true,
      entryKind: true,
      authorPersonId: true,
      visibilityClass: true,
      athletePersonId: true,
      teamId: true,
      eventId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!entryRuntimeRef) {
    return {
      status: "not_linked",
      entryRuntimeRef: null,
    };
  }

  const communicationCategory = classifyEntryRuntimeCommunicationCategory(entryRuntimeRef.sourceModelType);
  return {
    status: "linked",
    communicationClassification: getInternalCommunicationEventClassification(communicationCategory),
    notificationCandidateEvaluation: getInternalNotificationCandidateEvaluation(
      classifyCommunicationCategoryNotificationCandidate(communicationCategory),
    ),
    entryRuntimeRef,
  };
}

export async function writeFollowUpTaskEntryRuntimeRef(input: {
  organizationId: string;
  task: {
    id: string;
    organizationId: string;
    createdByPersonId: string;
    sourceNoteId: string | null;
    sourceEventId: string | null;
    sourceNoteVisibility: NoteVisibility | null;
    sourceNoteEventId: string | null;
    sourceNoteTeamId: string | null;
    sourceNoteAthletePersonId: string | null;
    sourceNoteEventTeamId: string | null;
    sourceEventTeamId: string | null;
    sourceNoteTeamProgramId: string | null;
    sourceNoteEventProgramId: string | null;
    sourceEventProgramId: string | null;
  };
}): Promise<EntryRuntimeRefWriteOutcome> {
  if (!isFollowUpTaskEntryRuntimeRefWriteEnabled()) {
    return "disabled";
  }

  if (input.task.organizationId !== input.organizationId) {
    return "skipped";
  }

  const visibility = classifyFollowUpTaskOperationalVisibility({
    sourceNoteId: input.task.sourceNoteId,
    sourceEventId: input.task.sourceEventId,
    sourceNoteVisibility: input.task.sourceNoteVisibility,
    sourceNoteEventId: input.task.sourceNoteEventId,
    sourceNoteTeamId: input.task.sourceNoteTeamId,
    sourceNoteEventTeamId: input.task.sourceNoteEventTeamId,
    sourceEventTeamId: input.task.sourceEventTeamId,
    sourceNoteTeamProgramId: input.task.sourceNoteTeamProgramId,
    sourceNoteEventProgramId: input.task.sourceNoteEventProgramId,
    sourceEventProgramId: input.task.sourceEventProgramId,
  });

  if (visibility.visibilityClass === "UNRESOLVED") {
    return "skipped";
  }

  const visibilityClass =
    visibility.visibilityClass === "TEAM_STAFF"
      ? EntryRuntimeVisibilityClass.TEAM_STAFF
      : EntryRuntimeVisibilityClass.ORGANIZATION_SCOPED;

  await db.entryRuntimeRef.upsert({
    where: {
      organizationId_sourceModelType_sourceModelId: {
        organizationId: input.organizationId,
        sourceModelType: EntryRuntimeSourceModelType.FOLLOW_UP_TASK,
        sourceModelId: input.task.id,
      },
    },
    create: {
      organizationId: input.organizationId,
      sourceModelType: EntryRuntimeSourceModelType.FOLLOW_UP_TASK,
      sourceModelId: input.task.id,
      entryKind: EntryRuntimeKind.TASK,
      authorPersonId: input.task.createdByPersonId,
      visibilityClass,
      athletePersonId: input.task.sourceNoteAthletePersonId,
      teamId: visibility.teamId,
      eventId: input.task.sourceEventId ?? input.task.sourceNoteEventId,
    },
    update: {
      authorPersonId: input.task.createdByPersonId,
      visibilityClass,
      athletePersonId: input.task.sourceNoteAthletePersonId,
      teamId: visibility.teamId,
      eventId: input.task.sourceEventId ?? input.task.sourceNoteEventId,
    },
  });

  return "upserted";
}

export async function getFollowUpTaskEntryRuntimeSummary(input: {
  organizationId: string;
  taskId: string;
}): Promise<FollowUpTaskEntryRuntimeSummary> {
  const entryRuntimeRef = await db.entryRuntimeRef.findUnique({
    where: {
      organizationId_sourceModelType_sourceModelId: {
        organizationId: input.organizationId,
        sourceModelType: EntryRuntimeSourceModelType.FOLLOW_UP_TASK,
        sourceModelId: input.taskId,
      },
    },
    select: {
      id: true,
      sourceModelType: true,
      sourceModelId: true,
      entryKind: true,
      authorPersonId: true,
      visibilityClass: true,
      athletePersonId: true,
      teamId: true,
      eventId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!entryRuntimeRef) {
    return {
      status: "not_linked",
      entryRuntimeRef: null,
    };
  }

  const communicationCategory = classifyEntryRuntimeCommunicationCategory(entryRuntimeRef.sourceModelType);
  return {
    status: "linked",
    communicationClassification: getInternalCommunicationEventClassification(communicationCategory),
    notificationCandidateEvaluation: getInternalNotificationCandidateEvaluation(
      classifyCommunicationCategoryNotificationCandidate(communicationCategory),
    ),
    entryRuntimeRef,
  };
}

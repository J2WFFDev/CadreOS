import {
  EntryRuntimeKind,
  EntryRuntimeSourceModelType,
  EntryRuntimeVisibilityClass,
  NoteVisibility,
} from "@prisma/client";

import { db } from "@/lib/db";

export type EntryRuntimeRefWriteOutcome = "disabled" | "skipped" | "upserted";

export type ObservationNoteEntryRuntimeSummary =
  | {
      status: "linked";
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

  return {
    status: "linked",
    entryRuntimeRef,
  };
}

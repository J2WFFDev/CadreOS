import {
  EntryRuntimeKind,
  EntryRuntimeSourceModelType,
  EntryRuntimeVisibilityClass,
  NoteVisibility,
} from "@prisma/client";

import { db } from "@/lib/db";

export type EntryRuntimeRefWriteOutcome = "disabled" | "skipped" | "upserted";

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

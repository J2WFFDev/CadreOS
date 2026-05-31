import { EntryType } from "@prisma/client";

import { db } from "@/lib/db";
import {
  type JournalPayloadStatus,
  parseJournalEntryPayload,
  serializeJournalEntryPayload,
} from "@/lib/entries/journal-payload";

export async function saveJournalWorkflowStatus(input: {
  organizationId: string;
  entryId: string;
  payloadJson: string | null | undefined;
  journalStatus: JournalPayloadStatus;
}) {
  const existingPayload = parseJournalEntryPayload(input.payloadJson ?? null);
  const updatedPayload = { ...existingPayload, journalStatus: input.journalStatus };

  await db.entryTypePayload.upsert({
    where: { entryId_entryType: { entryId: input.entryId, entryType: EntryType.JOURNAL } },
    update: {
      payloadJson: serializeJournalEntryPayload(updatedPayload),
      isActive: true,
      archivedAt: null,
    },
    create: {
      organizationId: input.organizationId,
      entryId: input.entryId,
      entryType: EntryType.JOURNAL,
      payloadJson: serializeJournalEntryPayload(updatedPayload),
      isActive: true,
    },
  });
}

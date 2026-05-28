import { EntryStatus, EntryVisibility, JournalVersionChangeType, type Prisma } from "@prisma/client";

export type JournalSnapshotInput = {
  organizationId: string;
  entryId: string;
  versionNumber: number;
  title: string;
  content: string | null;
  visibility: EntryVisibility;
  status: EntryStatus;
  fromStatus: EntryStatus | null;
  toStatus: EntryStatus;
  capturedByPersonId: string | null;
  changeType: JournalVersionChangeType;
  changeReason?: string | null;
};

export function buildJournalVersionSnapshotCreateInput(input: JournalSnapshotInput): Prisma.JournalVersionUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    entryId: input.entryId,
    versionNumber: input.versionNumber,
    changeType: input.changeType,
    titleSnapshot: input.title,
    contentSnapshot: input.content,
    visibilityAtVersion: input.visibility,
    statusAtVersion: input.status,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    capturedByPersonId: input.capturedByPersonId,
    changeReason: input.changeReason ?? null,
  };
}

export function labelForJournalVersionChangeType(changeType: JournalVersionChangeType): string {
  if (changeType === JournalVersionChangeType.DRAFT_CREATED) return "Draft created";
  if (changeType === JournalVersionChangeType.DRAFT_UPDATED) return "Draft updated";
  if (changeType === JournalVersionChangeType.SUBMITTED) return "Submitted";
  return "Archived";
}

import { EntryStatus, type Prisma } from "@prisma/client";

export function buildEntryLifecycleWhere(status?: EntryStatus): Prisma.EntryWhereInput {
  if (status === EntryStatus.ARCHIVED) {
    // Include historical generic archives that were also marked deleted.
    return { status: EntryStatus.ARCHIVED };
  }

  if (status) {
    return { status, deletedAt: null };
  }

  return {
    status: { not: EntryStatus.ARCHIVED },
    deletedAt: null,
  };
}

export function resolveEntryRestoreStatus(previousStatus: EntryStatus | null | undefined): EntryStatus {
  return previousStatus && previousStatus !== EntryStatus.ARCHIVED ? previousStatus : EntryStatus.OPEN;
}

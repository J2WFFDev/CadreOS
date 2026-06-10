import { EntryStatus, EntryType, type Prisma } from "@prisma/client";

export type EntryLifecycleAction = "ARCHIVE" | "RESTORE";

export function resolveEntryLifecycleAction(input: {
  canManageLifecycle: boolean;
  status: EntryStatus;
  type: EntryType;
}): EntryLifecycleAction | null {
  if (!input.canManageLifecycle || input.type === EntryType.JOURNAL) {
    return null;
  }

  return input.status === EntryStatus.ARCHIVED ? "RESTORE" : "ARCHIVE";
}

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

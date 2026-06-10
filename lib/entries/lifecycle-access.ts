import { canPerformAction } from "@/lib/permissions";

export type EntryLifecycleAccessRecord = {
  createdByPersonId: string | null;
};

export function resolveEntryLifecycleAccess(input: {
  actorPersonId: string | null;
  entry: EntryLifecycleAccessRecord;
  hasElevatedPermission: boolean;
}): boolean {
  return canManageOwnEntryLifecycle(input) || input.hasElevatedPermission;
}

export function canManageOwnEntryLifecycle(input: {
  actorPersonId: string | null;
  entry: EntryLifecycleAccessRecord;
}): boolean {
  return Boolean(input.actorPersonId && input.entry.createdByPersonId === input.actorPersonId);
}

export async function canManageEntryLifecycle(input: {
  actorPersonId: string | null;
  actorUserId: string | null;
  organizationId: string;
  entry: EntryLifecycleAccessRecord;
}): Promise<boolean> {
  if (canManageOwnEntryLifecycle(input)) {
    return true;
  }

  const hasElevatedPermission = await canPerformAction({
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    action: "entry.delete",
  });
  return resolveEntryLifecycleAccess({ ...input, hasElevatedPermission });
}

export const canArchiveEntry = canManageEntryLifecycle;
export const canRestoreEntry = canManageEntryLifecycle;

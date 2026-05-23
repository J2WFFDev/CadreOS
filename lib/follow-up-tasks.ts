import { resolveActorPersonId } from "@/lib/user-account";

const TASK_STATUS_SORT_WEIGHT: Record<string, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  BLOCKED: 2,
  DONE: 3,
  CANCELLED: 4,
};

export function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function compareFollowUpTasks<T extends { status: string; dueAt: Date | null; title: string }>(
  left: T,
  right: T,
) {
  const statusDifference =
    (TASK_STATUS_SORT_WEIGHT[left.status] ?? Number.MAX_SAFE_INTEGER) -
    (TASK_STATUS_SORT_WEIGHT[right.status] ?? Number.MAX_SAFE_INTEGER);

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const leftDueAt = left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDueAt = right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  return left.title.localeCompare(right.title);
}

export async function resolveFollowUpTaskCreatorPersonId(
  organizationId: string,
  clerkUserId: string | null,
  preferredPersonId?: string | null,
): Promise<string | null> {
  return resolveActorPersonId({
    organizationId,
    clerkUserId,
    preferredPersonId,
  });
}

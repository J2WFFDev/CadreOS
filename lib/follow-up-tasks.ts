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

export function isTaskOverdue(task: { dueAt: Date | null; status: string }, now: Date = new Date()) {
  if (!task.dueAt) {
    return false;
  }

  if (task.status === "DONE" || task.status === "CANCELLED") {
    return false;
  }

  return task.dueAt.getTime() < now.getTime();
}

export function getTaskStatusBadgeClassName(status: string) {
  if (status === "DONE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  }

  if (status === "BLOCKED") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }

  if (status === "IN_PROGRESS") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  }

  if (status === "CANCELLED") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
  }

  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
}

export function isUnresolvedTaskStatus(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "BLOCKED";
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

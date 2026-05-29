import Link from "next/link";
import { EntryPriority, TaskStatus } from "@prisma/client";

import { canReadStaffOnlyContent, resolveActorRoleContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { formatDateTimeInputValue, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function hasSearchParam(searchParams: SearchParams, key: string) {
  return typeof searchParams[key] !== "undefined";
}

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { taskId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit task</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load task edit right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadStaffOnlyContent(actorRoleContext)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to edit tasks.
          </p>
        </div>
      </section>
    );
  }

  let task:
    | {
        id: string;
        title: string;
        description: string | null;
        status: string;
        assigneePersonId: string;
        dueAt: Date | null;
        sourceNoteId: string | null;
        sourceEventId: string | null;
        entry: { priority: EntryPriority } | null;
      }
    | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];
  let notes: Array<{ id: string; body: string }> = [];
  let events: Array<{ id: string; title: string; startsAt: Date }> = [];
  let queryErrorMessage = "Unable to load task edit data right now. Please try again later.";
  let queryFailed = false;

  try {
    [task, people, notes, events] = await Promise.all([
      db.followUpTask.findFirst({
        where: {
          id: taskId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          assigneePersonId: true,
          dueAt: true,
          sourceNoteId: true,
          sourceEventId: true,
          entry: { select: { priority: true } },
        },
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.observationNote.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, body: true },
        orderBy: [{ createdAt: "desc" }],
        take: 200,
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true, startsAt: true },
        orderBy: [{ startsAt: "desc" }],
        take: 200,
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before editing tasks.";
    }
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit task</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  if (!task) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Task not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const title = hasSearchParam(resolvedSearchParams, "title") ? readSearchParam(resolvedSearchParams, "title") : task.title;
  const description = hasSearchParam(resolvedSearchParams, "description")
    ? readSearchParam(resolvedSearchParams, "description")
    : task.description ?? "";
  const status = hasSearchParam(resolvedSearchParams, "status")
    ? readSearchParam(resolvedSearchParams, "status")
    : task.status || TaskStatus.OPEN;
  const assigneePersonId = hasSearchParam(resolvedSearchParams, "assigneePersonId")
    ? readSearchParam(resolvedSearchParams, "assigneePersonId")
    : task.assigneePersonId;
  const priority = hasSearchParam(resolvedSearchParams, "priority")
    ? readSearchParam(resolvedSearchParams, "priority")
    : task.entry?.priority ?? EntryPriority.MEDIUM;
  const dueAt = hasSearchParam(resolvedSearchParams, "dueAt")
    ? readSearchParam(resolvedSearchParams, "dueAt")
    : formatDateTimeInputValue(task.dueAt);
  const sourceNoteId = hasSearchParam(resolvedSearchParams, "sourceNoteId")
    ? readSearchParam(resolvedSearchParams, "sourceNoteId")
    : task.sourceNoteId ?? "";
  const sourceEventId = hasSearchParam(resolvedSearchParams, "sourceEventId")
    ? readSearchParam(resolvedSearchParams, "sourceEventId")
    : task.sourceEventId ?? "";
  const returnTo = resolveSafeReturnPath(readSearchParam(resolvedSearchParams, "returnTo"), `/tasks/${task.id}`);
  const assigneeExists = people.some((person) => person.id === assigneePersonId);
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit task</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{generalError}</p>
        </div>
      ) : null}

      <form action={`/tasks/${task.id}/edit/update`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input id="title" name="title" defaultValue={title} className="w-full rounded-md border px-3 py-2 text-sm" />
          {hasSearchParam(resolvedSearchParams, "titleError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "titleError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={description}
            rows={6}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {hasSearchParam(resolvedSearchParams, "descriptionError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "descriptionError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select id="status" name="status" defaultValue={status} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(TaskStatus).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "statusError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "statusError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="priority" className="text-sm font-medium">
              Priority
            </label>
            <select id="priority" name="priority" defaultValue={priority} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(EntryPriority).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "priorityError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "priorityError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="assigneePersonId" className="text-sm font-medium">
              Assignee
            </label>
            <select
              id="assigneePersonId"
              name="assigneePersonId"
              defaultValue={assigneePersonId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {!assigneeExists && assigneePersonId ? (
                <option value={assigneePersonId}>Current assignee is no longer valid in this organization</option>
              ) : null}
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
            {!assigneeExists && assigneePersonId ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Reassign this task to an active person in the current organization before saving.
              </p>
            ) : null}
            {hasSearchParam(resolvedSearchParams, "assigneePersonIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "assigneePersonIdError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="dueAt" className="text-sm font-medium">
            Due date (optional)
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={dueAt}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {hasSearchParam(resolvedSearchParams, "dueAtError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "dueAtError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="sourceNoteId" className="text-sm font-medium">
              Source note (optional)
            </label>
            <select id="sourceNoteId" name="sourceNoteId" defaultValue={sourceNoteId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No source note</option>
              {notes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body}
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "sourceNoteIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "sourceNoteIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="sourceEventId" className="text-sm font-medium">
              Source event (optional)
            </label>
            <select
              id="sourceEventId"
              name="sourceEventId"
              defaultValue={sourceEventId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No source event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event.startsAt.toISOString().slice(0, 10)})
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "sourceEventIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "sourceEventIdError")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save task
          </button>
          <Link href={returnTo} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

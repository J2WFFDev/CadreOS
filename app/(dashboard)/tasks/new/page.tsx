import Link from "next/link";
import { RoleType, TaskStatus } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import {
  deriveGuardianOperationalContext,
  formatGuardianFollowUpDependency,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

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

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New task</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load task creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  let notes:
    | Array<{
        id: string;
        body: string;
        athlete:
          | {
              id: string;
              firstName: string;
              lastName: string;
              athleteLinks?: Array<{
                id: string;
                guardian: {
                  _count: { userAccounts: number };
                  roles: Array<{ id: string }>;
                };
              }>;
            }
          | null;
      }>
    | null = null;
  let events: Array<{ id: string; title: string; startsAt: Date }> | null = null;
  let queryErrorMessage = "Unable to load task options right now. Please try again later.";

  try {
    [people, notes, events] = await Promise.all([
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.observationNote.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          body: true,
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              athleteLinks: {
                where: { organizationId: scope.organizationId },
                select: {
                  id: true,
                  guardian: {
                    select: {
                      _count: { select: { userAccounts: true } },
                      roles: {
                        where: {
                          organizationId: scope.organizationId,
                          roleType: RoleType.PARENT_GUARDIAN,
                        },
                        select: { id: true },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before creating tasks.";
    }
  }

  if (!people || !notes || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New task</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const title = readSearchParam(resolvedSearchParams, "title");
  const description = readSearchParam(resolvedSearchParams, "description");
  const status = readSearchParam(resolvedSearchParams, "status") || TaskStatus.OPEN;
  const assigneePersonId =
    readSearchParam(resolvedSearchParams, "assigneePersonId") || people[0]?.id || "";
  const dueAt = readSearchParam(resolvedSearchParams, "dueAt");
  const sourceNoteId = readSearchParam(resolvedSearchParams, "sourceNoteId");
  const sourceEventId = readSearchParam(resolvedSearchParams, "sourceEventId");
  const generalError = readSearchParam(resolvedSearchParams, "error");
  const selectedSourceNote = notes.find((note) => note.id === sourceNoteId) ?? null;
  const selectedSourceNoteGuardianContext =
    canViewGuardianRelationshipDetails && selectedSourceNote?.athlete
      ? deriveGuardianOperationalContext(selectedSourceNote.athlete.athleteLinks ?? [])
      : null;

  return (
    <section className="space-y-4">
      <PageHeader title="New task" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      {people.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Add at least one person before creating tasks.{" "}
          <Link href="/people/new" className="underline">
            Create a person
          </Link>
          .
        </div>
      ) : (
        <form action="/tasks/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Created-by attribution uses mock actor context and falls back to a seeded/admin organization person
            until real authentication-to-person resolution is implemented.
          </p>

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
              <label htmlFor="assigneePersonId" className="text-sm font-medium">
                Assignee
              </label>
              <select
                id="assigneePersonId"
                name="assigneePersonId"
                defaultValue={assigneePersonId}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
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
              <select
                id="sourceNoteId"
                name="sourceNoteId"
                defaultValue={sourceNoteId}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
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
              {selectedSourceNote?.athlete && selectedSourceNoteGuardianContext ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Source athlete:{" "}
                  <Link href={`/people/${selectedSourceNote.athlete.id}`} className="underline">
                    {selectedSourceNote.athlete.firstName} {selectedSourceNote.athlete.lastName}
                  </Link>
                  {" · "}
                  {formatGuardianOperationalIndicator(selectedSourceNoteGuardianContext)}
                  {" · "}
                  {formatGuardianFollowUpDependency(selectedSourceNoteGuardianContext)}
                </p>
              ) : selectedSourceNote?.athlete ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Source athlete selected. Guardian relationship diagnostics are staff-only.
                </p>
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

          <FormActions submitLabel="Create task" cancelHref="/tasks" />
        </form>
      )}
    </section>
  );
}

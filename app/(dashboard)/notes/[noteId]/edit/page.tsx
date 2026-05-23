import Link from "next/link";

import { canReadStaffOnlyContent, resolveActorRoleContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function EditNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { noteId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit note</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load note edit right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit note</h2>
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
        <h2 className="text-2xl font-semibold tracking-tight">Edit note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to edit notes.
          </p>
        </div>
      </section>
    );
  }

  let note:
    | {
        id: string;
        body: string;
        athletePersonId: string | null;
        teamId: string | null;
        eventId: string | null;
      }
    | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];
  let teams: Array<{ id: string; name: string }> = [];
  let events: Array<{ id: string; title: string; startsAt: Date }> = [];
  let queryFailed = false;

  try {
    [note, people, teams, events] = await Promise.all([
      db.observationNote.findFirst({
        where: {
          id: noteId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          body: true,
          athletePersonId: true,
          teamId: true,
          eventId: true,
        },
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true, startsAt: true },
        orderBy: [{ startsAt: "desc" }],
        take: 200,
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit note</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load note edit data right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!note) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Note not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const body = readSearchParam(resolvedSearchParams, "body") || note.body;
  const athletePersonId = readSearchParam(resolvedSearchParams, "athletePersonId") || note.athletePersonId || "";
  const teamId = readSearchParam(resolvedSearchParams, "teamId") || note.teamId || "";
  const eventId = readSearchParam(resolvedSearchParams, "eventId") || note.eventId || "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit note</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{generalError}</p>
        </div>
      ) : null}

      <form action={`/notes/${note.id}/edit/update`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="body" className="text-sm font-medium">
            Note body
          </label>
          <textarea id="body" name="body" defaultValue={body} rows={7} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "bodyError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "bodyError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="athletePersonId" className="text-sm font-medium">
              Athlete / Person (optional)
            </label>
            <select
              id="athletePersonId"
              name="athletePersonId"
              defaultValue={athletePersonId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No person link</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "athletePersonIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "athletePersonIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="teamId" className="text-sm font-medium">
              Team (optional)
            </label>
            <select id="teamId" name="teamId" defaultValue={teamId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No team link</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "teamIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "teamIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="eventId" className="text-sm font-medium">
              Event (optional)
            </label>
            <select id="eventId" name="eventId" defaultValue={eventId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No event link</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event.startsAt.toISOString().slice(0, 10)})
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "eventIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "eventIdError")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save note
          </button>
          <Link href={`/notes/${note.id}`} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

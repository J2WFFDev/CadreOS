import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams, key: string): string {
  const val = params[key];
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

function formatDateTime(value: Date) {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      {formatEnumLabel(visibility)}
    </span>
  );
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query notes right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const filterTeamId = readParam(resolvedParams, "teamId");
  const filterAthletePersonId = readParam(resolvedParams, "athletePersonId");
  const filterEventId = readParam(resolvedParams, "eventId");
  const filterAuthorPersonId = readParam(resolvedParams, "authorPersonId");
  const hasActiveFilters = !!(filterTeamId || filterAthletePersonId || filterEventId || filterAuthorPersonId);

  let notes:
    | Array<{
        id: string;
        body: string;
        visibility: string;
        createdAt: Date;
        author: { id: string; firstName: string; lastName: string };
        athlete: { id: string; firstName: string; lastName: string } | null;
        team: { id: string; name: string } | null;
        event: { id: string; title: string } | null;
      }>
    | null = null;
  let filterTeams: Array<{ id: string; name: string }> = [];
  let filterPeople: Array<{ id: string; firstName: string; lastName: string }> = [];
  let filterEvents: Array<{ id: string; title: string }> = [];
  let queryErrorMessage = "Unable to load notes right now. Please try again later.";

  try {
    const [fetchedNotes, fetchedTeams, fetchedPeople, fetchedEvents] = await Promise.all([
      db.observationNote.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(filterTeamId ? { teamId: filterTeamId } : {}),
          ...(filterAthletePersonId ? { athletePersonId: filterAthletePersonId } : {}),
          ...(filterEventId ? { eventId: filterEventId } : {}),
          ...(filterAuthorPersonId ? { authorPersonId: filterAuthorPersonId } : {}),
        },
        select: {
          id: true,
          body: true,
          visibility: true,
          createdAt: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          athlete: { select: { id: true, firstName: true, lastName: true } },
          team: { select: { id: true, name: true } },
          event: { select: { id: true, title: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true },
        orderBy: [{ startsAt: "desc" }],
        take: 100,
      }),
    ]);
    notes = fetchedNotes;
    filterTeams = fetchedTeams;
    filterPeople = fetchedPeople;
    filterEvents = fetchedEvents;
  } catch (error) {
    notes = null;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading notes.";
    }
  }

  if (!notes) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const activeFilterLabels: string[] = [];
  if (filterTeamId) {
    const team = filterTeams.find((t) => t.id === filterTeamId);
    if (team) activeFilterLabels.push(`Team: ${team.name}`);
  }
  if (filterAthletePersonId) {
    const person = filterPeople.find((p) => p.id === filterAthletePersonId);
    if (person) activeFilterLabels.push(`Athlete/Person: ${person.firstName} ${person.lastName}`);
  }
  if (filterEventId) {
    const event = filterEvents.find((e) => e.id === filterEventId);
    if (event) activeFilterLabels.push(`Event: ${event.title}`);
  }
  if (filterAuthorPersonId) {
    const author = filterPeople.find((p) => p.id === filterAuthorPersonId);
    if (author) activeFilterLabels.push(`Author: ${author.firstName} ${author.lastName}`);
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Notes"
        description="Record coaching observations about athletes, teams, and events."
        actions={
          <Link href="/notes/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New note
          </Link>
        }
      />

      {/* Filter bar */}
      <form method="GET" className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="filter-teamId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Team
            </label>
            <select
              id="filter-teamId"
              name="teamId"
              defaultValue={filterTeamId}
              className="w-36 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All teams</option>
              {filterTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-athletePersonId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Athlete / Person
            </label>
            <select
              id="filter-athletePersonId"
              name="athletePersonId"
              defaultValue={filterAthletePersonId}
              className="w-44 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All people</option>
              {filterPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-eventId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Event
            </label>
            <select
              id="filter-eventId"
              name="eventId"
              defaultValue={filterEventId}
              className="w-44 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All events</option>
              {filterEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-authorPersonId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Author
            </label>
            <select
              id="filter-authorPersonId"
              name="authorPersonId"
              defaultValue={filterAuthorPersonId}
              className="w-44 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">All authors</option>
              {filterPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Apply
            </button>
            {hasActiveFilters ? (
              <Link href="/notes" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Clear
              </Link>
            ) : null}
          </div>
        </div>

        {activeFilterLabels.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Filtered by: {activeFilterLabels.join(" · ")}
          </p>
        ) : null}
      </form>

      {notes.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No notes match the selected filters."
              : "No observation notes have been recorded yet."
          }
          actionHref={hasActiveFilters ? "/notes" : "/notes/new"}
          actionLabel={hasActiveFilters ? "Clear filters" : "Record the first note"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Athlete / Person</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Event</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/notes/${note.id}`} className="underline">
                      {note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/people/${note.author.id}`} className="underline">
                      {note.author.firstName} {note.author.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(note.createdAt)}</td>
                  <td className="px-4 py-3">
                    <VisibilityBadge visibility={note.visibility} />
                  </td>
                  <td className="px-4 py-3">
                    {note.athlete ? (
                      <Link href={`/people/${note.athlete.id}`} className="underline">
                        {note.athlete.firstName} {note.athlete.lastName}
                      </Link>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {note.team ? (
                      <Link href={`/teams/${note.team.id}`} className="underline">
                        {note.team.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {note.event ? (
                      <Link href={`/events/${note.event.id}`} className="underline">
                        {note.event.title}
                      </Link>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
        <strong className="font-medium">Future scope (deferred):</strong> A unified Entry/Inbox model is planned to consolidate notes, tasks, and other capture types into a single workflow. Inbox routing, feed behavior, journal entries, and messaging are intentionally not implemented yet. Current notes use the <code>ObservationNote</code> model.
      </div>
    </section>
  );
}

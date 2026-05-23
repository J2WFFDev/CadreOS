import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
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

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New note</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load note creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New note</h2>
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
        <h2 className="text-2xl font-semibold tracking-tight">New note</h2>
        <ErrorMessage message="You do not have staff access to create notes." />
      </section>
    );
  }

  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let teams: Array<{ id: string; name: string }> | null = null;
  let events: Array<{ id: string; title: string; startsAt: Date }> | null = null;

  try {
    [people, teams, events] = await Promise.all([
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
    people = null;
    teams = null;
    events = null;
  }

  if (!people || !teams || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New note</h2>
        <ErrorMessage message="Unable to load people, teams, and events right now. Please try again later." />
      </section>
    );
  }

  const body = readSearchParam(resolvedSearchParams, "body");
  const athletePersonId = readSearchParam(resolvedSearchParams, "athletePersonId");
  const teamId = readSearchParam(resolvedSearchParams, "teamId");
  const eventId = readSearchParam(resolvedSearchParams, "eventId");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <PageHeader title="New note" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form action="/notes/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Notes are created with staff-only visibility. Author attribution resolves from your linked organization person via Clerk authentication. If no person link is detected, attribution falls back to an admin person in the organization.
        </p>

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

        <FormActions submitLabel="Create note" cancelHref="/notes" />
      </form>
    </section>
  );
}

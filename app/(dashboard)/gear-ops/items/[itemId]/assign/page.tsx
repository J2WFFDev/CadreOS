import { GearAssignmentStatus } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { GearOfflineForm } from "@/components/gear-ops/offline-form";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AssignGearItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { itemId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Assign gear item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load assign form right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Assign gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.assign.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Assign gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: { id: string; name: string } | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let teams: Array<{ id: string; name: string }> | null = null;
  let events: Array<{ id: string; title: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load assign form right now. Please try again later.";

  try {
    [item, people, teams, events] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true },
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
        select: { id: true, title: true },
        orderBy: [{ startsAt: "desc" }],
        take: 50,
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before assigning gear items.";
    }
  }

  if (queryFailed || !people || !teams || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Assign gear item</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Assign gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gear item not found in the selected organization scope.
          </p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  const status = readSearchParam(resolvedSearchParams, "status") || GearAssignmentStatus.PENDING;
  const assignedToPersonId = readSearchParam(resolvedSearchParams, "assignedToPersonId");
  const assignedToTeamId = readSearchParam(resolvedSearchParams, "assignedToTeamId");
  const assignedToEventId = readSearchParam(resolvedSearchParams, "assignedToEventId");
  const expectedReturnAt = readSearchParam(resolvedSearchParams, "expectedReturnAt");
  const returnedAt = readSearchParam(resolvedSearchParams, "returnedAt");
  const notes = readSearchParam(resolvedSearchParams, "notes");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Assign gear item</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Item: {item.name} · Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <GearOfflineForm
        action={`/gear-ops/items/${item.id}/assign/create`}
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
        actionType="gear.assignment.create"
        subjectType="GEAR_ITEM"
        subjectId={item.id}
        subjectLabel={item.name}
        permissionKey="gearAssignment.create"
        returnHref={`/gear-ops/items/${item.id}`}
        queueLabel={`Gear assignment · ${item.name}`}
      >
        <div className="space-y-1">
          <label htmlFor="status" className="text-sm font-medium">
            Assignment status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearAssignmentStatus).map((s) => (
              <option key={s} value={s}>
                {formatGearOpsEnum(s)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "statusError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "statusError")}</p>
          ) : null}
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Select exactly one assignment context below (person, team, or event).
        </p>

        <div className="space-y-1">
          <label htmlFor="assignedToPersonId" className="text-sm font-medium">
            Assign to person (optional)
          </label>
          <select
            id="assignedToPersonId"
            name="assignedToPersonId"
            defaultValue={assignedToPersonId}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">No person context</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.lastName}, {person.firstName}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "assignedToPersonIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "assignedToPersonIdError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="assignedToTeamId" className="text-sm font-medium">
            Assign to team (optional)
          </label>
          <select
            id="assignedToTeamId"
            name="assignedToTeamId"
            defaultValue={assignedToTeamId}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">No team context</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "assignedToTeamIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "assignedToTeamIdError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="assignedToEventId" className="text-sm font-medium">
            Assign to event (optional)
          </label>
          <select
            id="assignedToEventId"
            name="assignedToEventId"
            defaultValue={assignedToEventId}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">No event context</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "assignedToEventIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "assignedToEventIdError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="expectedReturnAt" className="text-sm font-medium">
              Expected return (optional)
            </label>
            <input
              id="expectedReturnAt"
              name="expectedReturnAt"
              type="datetime-local"
              defaultValue={expectedReturnAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "expectedReturnAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "expectedReturnAtError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="returnedAt" className="text-sm font-medium">
              Returned at (optional)
            </label>
            <input
              id="returnedAt"
              name="returnedAt"
              type="datetime-local"
              defaultValue={returnedAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "returnedAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "returnedAtError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={notes}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "notesError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "notesError")}</p>
          ) : null}
        </div>

        <FormActions submitLabel="Create assignment" cancelHref={`/gear-ops/items/${item.id}`} />
      </GearOfflineForm>
    </section>
  );
}

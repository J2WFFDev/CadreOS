import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function hasSearchParam(searchParams: SearchParams, key: string) {
  return typeof searchParams[key] !== "undefined";
}

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function NewFieldOpsBookingRequestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New booking request</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load booking request creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New booking request</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let facilities: Array<{ id: string; name: string }> | null = null;
  let resources: Array<{ id: string; name: string; facilityId: string; facility: { id: string; name: string } }> | null = null;
  let programs: Array<{ id: string; name: string }> | null = null;
  let teams: Array<{ id: string; name: string; programId: string; program: { id: string; name: string } }> | null = null;
  let events: Array<{ id: string; title: string; startsAt: Date; programId: string; teamId: string | null }> | null = null;
  let queryErrorMessage = "Unable to load booking request options right now. Please try again later.";

  try {
    [facilities, resources, programs, teams, events] = await Promise.all([
      db.facility.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.facilityResource.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          name: true,
          facilityId: true,
          facility: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ facility: { name: "asc" } }, { name: "asc" }],
      }),
      db.program.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          name: true,
          programId: true,
          program: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          title: true,
          startsAt: true,
          programId: true,
          teamId: true,
        },
        orderBy: [{ startsAt: "desc" }],
        take: 200,
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before creating booking requests.";
    }
  }

  if (!facilities || !resources || !programs || !teams || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New booking request</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const facilityId = readSearchParam(resolvedSearchParams, "facilityId");
  const resourceId = readSearchParam(resolvedSearchParams, "resourceId");
  const title = readSearchParam(resolvedSearchParams, "title");
  const description = readSearchParam(resolvedSearchParams, "description");
  const startsAt = readSearchParam(resolvedSearchParams, "startsAt");
  const endsAt = readSearchParam(resolvedSearchParams, "endsAt");
  const programId = readSearchParam(resolvedSearchParams, "programId");
  const teamId = readSearchParam(resolvedSearchParams, "teamId");
  const eventId = readSearchParam(resolvedSearchParams, "eventId");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <PageHeader
        title="New booking request"
        description="Create a FieldOps booking request for an existing facility resource."
      />
      <FieldOpsSubnav current="new-booking" />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      {resources.length === 0 ? (
        <EmptyState
          message="No facility resources are available for booking requests yet."
          actionHref="/field-ops/facilities"
          actionLabel="View facilities"
        />
      ) : (
        <form
          action="/field-ops/bookings/create"
          method="post"
          className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
        >
          <div className="space-y-1">
            <label htmlFor="facilityId" className="text-sm font-medium">
              Facility
            </label>
            <select id="facilityId" name="facilityId" defaultValue={facilityId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Auto-select from resource</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "facilityIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "facilityIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="resourceId" className="text-sm font-medium">
              Resource
            </label>
            <select id="resourceId" name="resourceId" defaultValue={resourceId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Select a resource</option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} — {resource.facility.name}
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "resourceIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "resourceIdError")}</p>
            ) : null}
          </div>

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
              Description/notes (optional)
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={description}
              rows={5}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {hasSearchParam(resolvedSearchParams, "descriptionError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "descriptionError")}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="startsAt" className="text-sm font-medium">
                Starts at
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={startsAt}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {hasSearchParam(resolvedSearchParams, "startsAtError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "startsAtError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="endsAt" className="text-sm font-medium">
                Ends at
              </label>
              <input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={endsAt}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {hasSearchParam(resolvedSearchParams, "endsAtError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "endsAtError")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="programId" className="text-sm font-medium">
                Program context (optional)
              </label>
              <select id="programId" name="programId" defaultValue={programId} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">No program context</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
              {hasSearchParam(resolvedSearchParams, "programIdError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "programIdError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="teamId" className="text-sm font-medium">
                Team context (optional)
              </label>
              <select id="teamId" name="teamId" defaultValue={teamId} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">No team context</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} — {team.program.name}
                  </option>
                ))}
              </select>
              {hasSearchParam(resolvedSearchParams, "teamIdError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "teamIdError")}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="eventId" className="text-sm font-medium">
              Event linkage (optional)
            </label>
            <select id="eventId" name="eventId" defaultValue={eventId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No linked event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event.startsAt.toISOString().slice(0, 10)})
                </option>
              ))}
            </select>
            {hasSearchParam(resolvedSearchParams, "eventIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "eventIdError")}</p>
            ) : null}
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            New requests start as Requested, with precheck not run and approval pending. Conflict detection and approval
            actions are added in later phases.
          </p>

          <FormActions submitLabel="Create booking request" cancelHref="/field-ops/bookings" />
        </form>
      )}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Need to review availability first?{" "}
        <Link href="/field-ops/bookings" className="underline">
          Return to bookings
        </Link>
        .
      </p>
    </section>
  );
}

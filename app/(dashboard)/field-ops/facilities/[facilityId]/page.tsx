import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFacilityAddress, formatFieldOpsEnum } from "@/lib/field-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function getStatusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
}

export default async function FacilityDetailsPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Facility</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query facility details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Facility</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let facility:
    | {
        id: string;
        name: string;
        description: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        postalCode: string | null;
        status: string;
        resources: Array<{
          id: string;
          name: string;
          resourceType: string;
          description: string | null;
          capacity: number | null;
          status: string;
          _count: { bookings: number };
        }>;
      }
    | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load facility details right now. Please try again later.";

  try {
    facility = await db.facility.findFirst({
      where: {
        id: facilityId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        status: true,
        resources: {
          where: {
            organizationId: scope.organizationId,
          },
          select: {
            id: true,
            name: true,
            resourceType: true,
            description: true,
            capacity: true,
            status: true,
            _count: {
              select: {
                bookings: true,
              },
            },
          },
          orderBy: [{ name: "asc" }],
        },
      },
    });
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading facility details.";
    }
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Facility</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!facility) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Facility</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Facility not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const activeFacilityResources = facility.resources.filter((resource) => resource.status === "ACTIVE");
  const canRequestForFacility = facility.status === "ACTIVE" && activeFacilityResources.length > 0;

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <BackLink href="/field-ops/facilities" label="Facilities" />
        <FieldOpsSubnav current="facilities" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{facility.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {facility.description ?? "No facility description has been recorded yet."}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(facility.status)}`}>
            {formatFieldOpsEnum(facility.status)}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatFacilityAddress(facility)}</p>
        {facility.status !== "ACTIVE" ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This facility is inactive and booking requests should not be submitted here.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/field-ops/bookings?facilityId=${facility.id}`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          View facility bookings
        </Link>
        {canRequestForFacility ? (
          <Link
            href={`/field-ops/bookings/new?facilityId=${facility.id}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            New booking request
          </Link>
        ) : (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            New requests unavailable: no active resources
          </span>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Resources</h3>
        {facility.resources.length === 0 ? (
          <EmptyState message="No resources have been added to this facility yet." />
        ) : (
          <div className="space-y-3">
            {facility.resources.map((resource) => (
              <article key={resource.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-base font-medium">
                      <Link href={`/field-ops/resources/${resource.id}`} className="underline">
                        {resource.name}
                      </Link>
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {resource.description ?? "No resource description has been recorded yet."}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(resource.status)}`}>
                    {formatFieldOpsEnum(resource.status)}
                  </span>
                </div>

                {resource.status !== "ACTIVE" ? (
                  <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                    This resource is inactive and should not receive new booking requests.
                  </p>
                ) : null}

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Type</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(resource.resourceType)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Capacity</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{resource.capacity ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Bookings</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{resource._count.bookings}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

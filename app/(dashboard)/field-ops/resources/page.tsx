import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFieldOpsEnum } from "@/lib/field-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function getStatusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
}

export default async function FieldOpsResourcesPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps resources</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query FieldOps resources right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps resources</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let resources:
    | Array<{
        id: string;
        name: string;
        status: string;
        resourceType: string;
        capacity: number | null;
        facility: { id: string; name: string; status: string };
        _count: { bookings: number };
      }>
    | null = null;
  let activeResourceCount = 0;
  let queryErrorMessage = "Unable to load FieldOps resources right now. Please try again later.";

  try {
    [resources, activeResourceCount] = await Promise.all([
      db.facilityResource.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          resourceType: true,
          capacity: true,
          facility: { select: { id: true, name: true, status: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: [{ facility: { name: "asc" } }, { name: "asc" }],
      }),
      db.facilityResource.count({
        where: {
          organizationId: scope.organizationId,
          status: "ACTIVE",
          facility: { status: "ACTIVE" },
        },
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading FieldOps resources.";
    }
  }

  if (!resources) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps resources</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="FieldOps resources" description="Resource inventory with booking visibility and active/inactive status." />
      <FieldOpsSubnav current="resources" />

      {activeResourceCount > 0 ? (
        <div className="flex justify-end">
          <Link
            href="/field-ops/bookings/new"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            New booking request
          </Link>
        </div>
      ) : (
        <EmptyState message="No active resources are available for new booking requests." />
      )}

      {resources.length === 0 ? (
        <EmptyState message="No FieldOps resources have been added for this organization yet." actionHref="/field-ops/facilities" actionLabel="View facilities" />
      ) : (
        <div className="space-y-3">
          {resources.map((resource) => {
            const resourceIsInactive = resource.status !== "ACTIVE";
            const facilityIsInactive = resource.facility.status !== "ACTIVE";
            const showInactiveWarning = resourceIsInactive || facilityIsInactive;

            return (
              <article key={resource.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">
                      <Link href={`/field-ops/resources/${resource.id}`} className="underline">
                        {resource.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      <Link href={`/field-ops/facilities/${resource.facility.id}`} className="underline">
                        {resource.facility.name}
                      </Link>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(resource.status)}`}>
                      Resource: {formatFieldOpsEnum(resource.status)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(resource.facility.status)}`}>
                      Facility: {formatFieldOpsEnum(resource.facility.status)}
                    </span>
                  </div>
                </div>

                {showInactiveWarning ? (
                  <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                    Inactive resources or facilities should not receive new booking requests.
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
            );
          })}
        </div>
      )}
    </section>
  );
}

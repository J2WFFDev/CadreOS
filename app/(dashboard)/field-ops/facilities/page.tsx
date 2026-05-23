import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFacilityAddress, formatFieldOpsEnum } from "@/lib/field-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function FieldOpsFacilitiesPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query FieldOps facilities right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let facilities:
    | Array<{
        id: string;
        name: string;
        description: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        postalCode: string | null;
        status: string;
        _count: { resources: number; bookings: number };
      }>
    | null = null;
  let queryErrorMessage = "Unable to load FieldOps facilities right now. Please try again later.";

  try {
    facilities = await db.facility.findMany({
      where: { organizationId: scope.organizationId },
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
        _count: {
          select: {
            resources: true,
            bookings: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading FieldOps facilities.";
    }
  }

  if (!facilities) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="FieldOps"
        description="Read-only view of facilities, resources, and bookings for the active organization."
      />
      <FieldOpsSubnav current="facilities" />
      <div className="flex justify-end">
        <Link
          href="/field-ops/bookings/new"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          New booking request
        </Link>
      </div>

      {facilities.length === 0 ? (
        <EmptyState message="No FieldOps facilities have been added for this organization yet." />
      ) : (
        <div className="space-y-3">
          {facilities.map((facility) => (
            <article key={facility.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">
                    <Link href={`/field-ops/facilities/${facility.id}`} className="underline">
                      {facility.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {facility.description ?? "No facility description has been recorded yet."}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {formatFieldOpsEnum(facility.status)}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Address</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">{formatFacilityAddress(facility)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Resources</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">{facility._count.resources}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Bookings</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">{facility._count.bookings}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { BookingCard } from "@/components/field-ops/booking-card";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function FieldOpsBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps bookings</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query FieldOps bookings right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps bookings</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const facilityId = readSearchParam(resolvedSearchParams, "facilityId");
  const resourceId = readSearchParam(resolvedSearchParams, "resourceId");

  let bookings:
    | Array<{
        id: string;
        title: string;
        startsAt: Date;
        endsAt: Date;
        status: string;
        precheckStatus: string;
        approvalStatus: string;
        facility: { id: string; name: string };
        resource: { id: string; name: string };
        program: { id: string; name: string } | null;
        team: { id: string; name: string } | null;
        event: { id: string; title: string } | null;
      }>
    | null = null;
  let filterContext: {
    facility: { id: string; name: string } | null;
    resource: { id: string; name: string } | null;
  } = { facility: null, resource: null };
  let queryErrorMessage = "Unable to load FieldOps bookings right now. Please try again later.";

  try {
    [bookings, filterContext] = await Promise.all([
      db.resourceBooking.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(facilityId ? { facilityId } : {}),
          ...(resourceId ? { resourceId } : {}),
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          status: true,
          precheckStatus: true,
          approvalStatus: true,
          facility: { select: { id: true, name: true } },
          resource: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          event: { select: { id: true, title: true } },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      }),
      Promise.all([
        facilityId
          ? db.facility.findFirst({
              where: {
                id: facilityId,
                organizationId: scope.organizationId,
              },
              select: { id: true, name: true },
            })
          : Promise.resolve(null),
        resourceId
          ? db.facilityResource.findFirst({
              where: {
                id: resourceId,
                organizationId: scope.organizationId,
              },
              select: { id: true, name: true },
            })
          : Promise.resolve(null),
      ]).then(([facility, resource]) => ({ facility, resource })),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading FieldOps bookings.";
    }
  }

  if (!bookings) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps bookings</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const hasFilters = Boolean(facilityId || resourceId);

  return (
    <section className="space-y-4">
      <PageHeader
        title="FieldOps bookings"
        description="Read-only booking schedule across facilities and resources."
      />
      <FieldOpsSubnav current="bookings" />

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">Filters:</span>
          {filterContext.facility ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
              Facility: {filterContext.facility.name}
            </span>
          ) : null}
          {filterContext.resource ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
              Resource: {filterContext.resource.name}
            </span>
          ) : null}
          <Link href="/field-ops/bookings" className="underline">
            Clear filters
          </Link>
        </div>
      ) : null}

      {bookings.length === 0 ? (
        <EmptyState
          message={hasFilters ? "No bookings match the selected FieldOps filters yet." : "No FieldOps bookings have been recorded yet."}
          actionHref={hasFilters ? "/field-ops/bookings" : undefined}
          actionLabel={hasFilters ? "View all bookings" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </section>
  );
}

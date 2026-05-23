import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { BookingCard } from "@/components/field-ops/booking-card";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFieldOpsEnum } from "@/lib/field-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function ResourceDetailsPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Resource</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query resource details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Resource</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let resource:
    | {
        id: string;
        name: string;
        resourceType: string;
        description: string | null;
        capacity: number | null;
        status: string;
        facility: { id: string; name: string };
        bookings: Array<{
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
        }>;
      }
    | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load resource details right now. Please try again later.";

  try {
    resource = await db.facilityResource.findFirst({
      where: {
        id: resourceId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        name: true,
        resourceType: true,
        description: true,
        capacity: true,
        status: true,
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
        bookings: {
          where: {
            organizationId: scope.organizationId,
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
        },
      },
    });
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading resource details.";
    }
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Resource</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!resource) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Resource</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Resource not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <BackLink href="/field-ops/facilities" label="Facilities" />
          <span>·</span>
          <Link href={`/field-ops/facilities/${resource.facility.id}`} className="hover:text-zinc-700 dark:hover:text-zinc-200">
            {resource.facility.name}
          </Link>
        </div>
        <FieldOpsSubnav current="facilities" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{resource.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {resource.description ?? "No resource description has been recorded yet."}
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {formatFieldOpsEnum(resource.status)}
          </span>
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-3">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Facility</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            <Link href={`/field-ops/facilities/${resource.facility.id}`} className="underline">
              {resource.facility.name}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Type</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(resource.resourceType)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Capacity</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{resource.capacity ?? "—"}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-medium">Bookings</h3>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/field-ops/bookings?resourceId=${resource.id}`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              View all bookings
            </Link>
            <Link
              href={`/field-ops/bookings/new?facilityId=${resource.facility.id}&resourceId=${resource.id}`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              New booking request
            </Link>
          </div>
        </div>
        {resource.bookings.length === 0 ? (
          <EmptyState message="No bookings have been recorded for this resource yet." />
        ) : (
          <div className="space-y-3">
            {resource.bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

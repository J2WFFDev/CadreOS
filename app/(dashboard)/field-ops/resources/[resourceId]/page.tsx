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

function getStatusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
}

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
        facility: { id: string; name: string; status: string };
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
          _count: { conflicts: number };
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
            status: true,
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
            _count: { select: { conflicts: true } },
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

  const now = new Date();
  const nextFourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingResourceBookings = resource.bookings.filter(
    (booking) =>
      booking.startsAt >= now &&
      booking.startsAt < nextFourteenDays &&
      booking.status !== "DENIED" &&
      booking.status !== "CANCELED",
  );
  const upcomingBookedHours = upcomingResourceBookings.reduce((total, booking) => {
    const hours = (booking.endsAt.getTime() - booking.startsAt.getTime()) / (1000 * 60 * 60);
    return total + Math.max(hours, 0);
  }, 0);
  const nextUpcomingBooking = upcomingResourceBookings[0] ?? null;
  const resourceReadinessConcerns =
    (resource.status === "ACTIVE" ? 0 : 1) +
    (resource.facility.status === "ACTIVE" ? 0 : 1) +
    upcomingResourceBookings.filter((booking) => booking._count.conflicts > 0 || booking.approvalStatus === "PENDING").length;
  const currentlyAvailable =
    resource.status === "ACTIVE" && resource.facility.status === "ACTIVE" && upcomingResourceBookings.length === 0;

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
        <FieldOpsSubnav current="resources" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{resource.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {resource.description ?? "No resource description has been recorded yet."}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(resource.status)}`}>
            {formatFieldOpsEnum(resource.status)}
          </span>
        </div>
        {resource.status !== "ACTIVE" ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This resource is inactive and should not receive new booking requests.
          </p>
        ) : null}
        {resource.facility.status !== "ACTIVE" ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            The parent facility is inactive, so new booking requests are unavailable.
          </p>
        ) : null}
      </div>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-4">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Facility</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            <Link href={`/field-ops/facilities/${resource.facility.id}`} className="underline">
              {resource.facility.name}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Facility status</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(resource.facility.status)}</dd>
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

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Resource operational summary</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Scheduling load, upcoming reservations, readiness concerns, and current availability.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={`/field-ops/bookings?resourceId=${resource.id}&timeframe=upcoming`} className="rounded-full border px-2 py-1">
              Upcoming reservations
            </Link>
            <Link href="/field-ops/resources" className="rounded-full border px-2 py-1">
              Resource list
            </Link>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-medium">Upcoming reservations (14 days)</dt>
            <dd className={upcomingResourceBookings.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {upcomingResourceBookings.length}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Scheduled hours (14 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{upcomingBookedHours.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="font-medium">Readiness concerns</dt>
            <dd className={resourceReadinessConcerns > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {resourceReadinessConcerns}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Availability status</dt>
            <dd className={currentlyAvailable ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-600 dark:text-zinc-400"}>
              {currentlyAvailable ? "Available now" : "Currently allocated or not ready"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Next upcoming reservation</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {nextUpcomingBooking ? (
                <>
                  <Link href={`/field-ops/bookings/${nextUpcomingBooking.id}`} className="underline">
                    {nextUpcomingBooking.title}
                  </Link>{" "}
                  · {formatFieldOpsDateTime(nextUpcomingBooking.startsAt)}
                </>
              ) : (
                "No upcoming reservation in the next 14 days."
              )}
            </dd>
          </div>
        </dl>
      </div>

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
            {resource.status === "ACTIVE" && resource.facility.status === "ACTIVE" ? (
              <Link
                href={`/field-ops/bookings/new?facilityId=${resource.facility.id}&resourceId=${resource.id}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                New booking request
              </Link>
            ) : (
              <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                New requests unavailable while resource or facility is inactive
              </span>
            )}
          </div>
        </div>
        {resource.bookings.length === 0 ? (
          <EmptyState message="No bookings have been recorded for this resource yet." />
        ) : (
          <div className="space-y-3">
            {resource.bookings.map((booking) => (
              <BookingCard key={booking.id} booking={{ ...booking, conflictCount: booking._count.conflicts }} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import Link from "next/link";
import { ApprovalStatus, BookingStatus, PrecheckStatus, Prisma } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { BookingCard } from "@/components/field-ops/booking-card";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFieldOpsEnum } from "@/lib/field-ops";
import { appendReturnToParam } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_FILTERS = Object.values(BookingStatus);
const APPROVAL_FILTERS = Object.values(ApprovalStatus);
const PRECHECK_FILTERS = Object.values(PrecheckStatus);
const BOOKING_LIST_SELECT = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  status: true,
  precheckStatus: true,
  approvalStatus: true,
  facility: { select: { id: true, name: true, status: true } },
  resource: { select: { id: true, name: true, status: true } },
  program: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  event: { select: { id: true, title: true } },
  _count: { select: { conflicts: true } },
} satisfies Prisma.ResourceBookingSelect;

type BookingListItem = Prisma.ResourceBookingGetPayload<{
  select: typeof BOOKING_LIST_SELECT;
}>;

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readSearchParamValues(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value.filter((item) => item.length > 0);
  }

  if (!value) {
    return [];
  }

  return [value];
}

function buildHref(pathname: string, filters: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
  const rawApprovalStatus = readSearchParam(resolvedSearchParams, "approvalStatus");
  const rawPrecheckStatus = readSearchParam(resolvedSearchParams, "precheckStatus");
  const timeframe = readSearchParam(resolvedSearchParams, "timeframe") || "all";
  const hasConflicts = readSearchParam(resolvedSearchParams, "hasConflicts");
  const created = readSearchParam(resolvedSearchParams, "created") || readSearchParam(resolvedSearchParams, "bookingRequestCreated");
  const statusValues = readSearchParamValues(resolvedSearchParams, "status").filter((value): value is BookingStatus =>
    STATUS_FILTERS.includes(value as BookingStatus),
  );
  const selectedStatus = statusValues[0] ?? "";
  const approvalStatus = APPROVAL_FILTERS.includes(rawApprovalStatus as ApprovalStatus)
    ? (rawApprovalStatus as ApprovalStatus)
    : "";
  const precheckStatus = PRECHECK_FILTERS.includes(rawPrecheckStatus as PrecheckStatus)
    ? (rawPrecheckStatus as PrecheckStatus)
    : "";
  const now = new Date();

  let queryErrorMessage = "Unable to load FieldOps bookings right now. Please try again later.";
  let data:
    | {
        bookings: BookingListItem[];
        facilities: Array<{ id: string; name: string }>;
        resources: Array<{ id: string; name: string; facilityId: string }>;
        activeResourceCount: number;
      }
    | null = null;

  try {
    const bookingWhere: Prisma.ResourceBookingWhereInput = {
      organizationId: scope.organizationId,
      ...(facilityId ? { facilityId } : {}),
      ...(resourceId ? { resourceId } : {}),
      ...(statusValues.length > 0 ? { status: { in: statusValues } } : {}),
      ...(approvalStatus ? { approvalStatus } : {}),
      ...(precheckStatus ? { precheckStatus } : {}),
      ...(hasConflicts === "yes"
        ? {
            conflicts: {
              some: {},
            },
          }
        : {}),
      ...(hasConflicts === "no"
        ? {
            conflicts: {
              none: {},
            },
          }
        : {}),
      ...(timeframe === "upcoming"
        ? {
            startsAt: { gte: now },
          }
        : {}),
      ...(timeframe === "past"
        ? {
            startsAt: { lt: now },
          }
        : {}),
    };

    const [bookings, facilities, resources, activeResourceCount] = await Promise.all([
      db.resourceBooking.findMany({
        where: bookingWhere,
        select: BOOKING_LIST_SELECT,
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      }),
      db.facility.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.facilityResource.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true, facilityId: true },
        orderBy: [{ name: "asc" }],
      }),
      db.facilityResource.count({
        where: {
          organizationId: scope.organizationId,
          status: "ACTIVE",
          facility: { status: "ACTIVE" },
        },
      }),
    ]);

    data = { bookings, facilities, resources, activeResourceCount };
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading FieldOps bookings.";
    }
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps bookings</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const filteredResources = facilityId
    ? data.resources.filter((resource) => resource.facilityId === facilityId)
    : data.resources;
  const hasFilters = Boolean(
    facilityId || resourceId || selectedStatus || approvalStatus || precheckStatus || hasConflicts || timeframe !== "all",
  );
  const currentBookingsScopeHref = buildHref("/field-ops/bookings", {
    facilityId,
    resourceId,
    status: selectedStatus,
    approvalStatus,
    precheckStatus,
    timeframe: timeframe === "all" ? "" : timeframe,
    hasConflicts,
  });
  const newBookingBaseHref = resourceId ? `/field-ops/bookings/new?resourceId=${resourceId}` : "/field-ops/bookings/new";
  const newBookingHref = appendReturnToParam(newBookingBaseHref, currentBookingsScopeHref);

  return (
    <section className="space-y-4">
      <PageHeader title="FieldOps bookings" description="Booking requests, approvals, conflicts, and schedule filters." />
      <FieldOpsSubnav current={approvalStatus === "PENDING" ? "approvals" : "bookings"} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Requests and approvals</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Use filters to review pending approvals, conflicts, and history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/field-ops/bookings?approvalStatus=PENDING"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Pending approvals
          </Link>
          {data.activeResourceCount > 0 ? (
            <Link
              href={newBookingHref}
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
      </div>

      {created === "1" ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">Booking request created successfully.</p>
        </div>
      ) : null}

      <form method="get" className="grid gap-3 rounded-lg border bg-white p-4 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="status" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Status
          </label>
          <select id="status" name="status" defaultValue={selectedStatus} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {formatFieldOpsEnum(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="approvalStatus" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Approval
          </label>
          <select
            id="approvalStatus"
            name="approvalStatus"
            defaultValue={approvalStatus}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All approval states</option>
            {APPROVAL_FILTERS.map((value) => (
              <option key={value} value={value}>
                {formatFieldOpsEnum(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="precheckStatus" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Precheck
          </label>
          <select
            id="precheckStatus"
            name="precheckStatus"
            defaultValue={precheckStatus}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All precheck states</option>
            {PRECHECK_FILTERS.map((value) => (
              <option key={value} value={value}>
                {formatFieldOpsEnum(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="facilityId" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Facility
          </label>
          <select id="facilityId" name="facilityId" defaultValue={facilityId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">All facilities</option>
            {data.facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="resourceId" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Resource
          </label>
          <select id="resourceId" name="resourceId" defaultValue={resourceId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">All resources</option>
            {filteredResources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="timeframe" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Timeframe
          </label>
          <select id="timeframe" name="timeframe" defaultValue={timeframe} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="hasConflicts" className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Conflicts
          </label>
          <select
            id="hasConflicts"
            name="hasConflicts"
            defaultValue={hasConflicts}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="yes">With conflicts</option>
            <option value="no">No conflicts</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply filters
          </button>
          <Link href="/field-ops/bookings" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Clear
          </Link>
        </div>
      </form>

      {data.bookings.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? "No bookings match the selected filters."
              : approvalStatus === "PENDING"
                ? "No pending approvals found."
                : hasConflicts === "yes"
                  ? "No bookings with conflicts found."
                  : "No FieldOps bookings have been recorded yet."
          }
          actionHref={hasFilters ? "/field-ops/bookings" : undefined}
          actionLabel={hasFilters ? "View all bookings" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {data.bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={{ ...booking, conflictCount: booking._count.conflicts }}
              detailHref={appendReturnToParam(`/field-ops/bookings/${booking.id}`, currentBookingsScopeHref)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

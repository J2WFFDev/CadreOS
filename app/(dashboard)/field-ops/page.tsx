import { ApprovalStatus, BookingStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-lg transition hover:opacity-90">
      {content}
    </Link>
  );
}

export default async function FieldOpsDashboardPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load the FieldOps dashboard right now."} />
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

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "field-ops.overview.access",
    entityType: "resourceBooking",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="FieldOps"
          description="MVP operations summary for facilities, resources, booking requests, and approvals."
        />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view FieldOps reporting surfaces.
          </p>
        </div>
      </section>
    );
  }

  const now = new Date();
  const nextFourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  let summary:
    | {
        totalFacilities: number;
        activeFacilities: number;
        totalResources: number;
        totalRequests: number;
        pendingApprovals: number;
        approvedBookings: number;
        deniedOrCanceledBookings: number;
        bookingsWithConflicts: number;
        upcomingApprovedBookings: number;
        upcomingBookingsFourteenDays: number;
        todayBookings: number;
        resourcesWithUpcomingLoad: number;
        resourcesWithoutUpcomingLoad: number;
        readinessConcerns: number;
        upcomingBookedHours: number;
      }
    | null = null;
  let queryErrorMessage = "Unable to load FieldOps dashboard metrics right now. Please try again later.";

  try {
    const [
      totalFacilities,
      activeFacilities,
      totalResources,
      totalRequests,
      pendingApprovals,
      approvedBookings,
      deniedOrCanceledBookings,
      bookingsWithConflicts,
      upcomingApprovedBookings,
      upcomingBookingsFourteenDays,
      todayBookings,
      upcomingResourceReservations,
      inactiveFacilities,
      inactiveResources,
      activeResources,
    ] = await Promise.all([
      db.facility.count({
        where: { organizationId: scope.organizationId },
      }),
      db.facility.count({
        where: { organizationId: scope.organizationId, status: "ACTIVE" },
      }),
      db.facilityResource.count({
        where: { organizationId: scope.organizationId },
      }),
      db.resourceBooking.count({
        where: { organizationId: scope.organizationId },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          approvalStatus: ApprovalStatus.PENDING,
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          status: BookingStatus.APPROVED,
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          status: {
            in: [BookingStatus.DENIED, BookingStatus.CANCELED],
          },
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          conflicts: {
            some: {},
          },
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          status: BookingStatus.APPROVED,
          startsAt: {
            gte: now,
          },
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          startsAt: {
            gte: now,
            lt: nextFourteenDays,
          },
          status: {
            notIn: [BookingStatus.DENIED, BookingStatus.CANCELED],
          },
        },
      }),
      db.resourceBooking.count({
        where: {
          organizationId: scope.organizationId,
          startsAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
          status: {
            notIn: [BookingStatus.DENIED, BookingStatus.CANCELED],
          },
        },
      }),
      db.resourceBooking.findMany({
        where: {
          organizationId: scope.organizationId,
          startsAt: {
            gte: now,
            lt: nextFourteenDays,
          },
          status: {
            notIn: [BookingStatus.DENIED, BookingStatus.CANCELED],
          },
        },
        select: {
          startsAt: true,
          endsAt: true,
          resourceId: true,
        },
      }),
      db.facility.count({
        where: {
          organizationId: scope.organizationId,
          status: {
            not: "ACTIVE",
          },
        },
      }),
      db.facilityResource.count({
        where: {
          organizationId: scope.organizationId,
          status: {
            not: "ACTIVE",
          },
        },
      }),
      db.facilityResource.count({
        where: {
          organizationId: scope.organizationId,
          status: "ACTIVE",
          facility: { status: "ACTIVE" },
        },
      }),
    ]);

    const resourcesWithUpcomingLoad = new Set(upcomingResourceReservations.map((booking) => booking.resourceId)).size;
    const resourcesWithoutUpcomingLoad = Math.max(activeResources - resourcesWithUpcomingLoad, 0);
    const upcomingBookedHours = upcomingResourceReservations.reduce((total, booking) => {
      const hours = (booking.endsAt.getTime() - booking.startsAt.getTime()) / (1000 * 60 * 60);
      return total + Math.max(hours, 0);
    }, 0);

    summary = {
      totalFacilities,
      activeFacilities,
      totalResources,
      totalRequests,
      pendingApprovals,
      approvedBookings,
      deniedOrCanceledBookings,
      bookingsWithConflicts,
      upcomingApprovedBookings,
      upcomingBookingsFourteenDays,
      todayBookings,
      resourcesWithUpcomingLoad,
      resourcesWithoutUpcomingLoad,
      readinessConcerns: pendingApprovals + bookingsWithConflicts + inactiveFacilities + inactiveResources,
      upcomingBookedHours: Number(upcomingBookedHours.toFixed(1)),
    };
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading FieldOps dashboard.";
    }
  }

  if (!summary) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FieldOps</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="FieldOps" description="MVP operations summary for facilities, resources, booking requests, and approvals." />
      <FieldOpsSubnav current="overview" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Total facilities" value={summary.totalFacilities} href="/field-ops/facilities" />
        <SummaryCard label="Active facilities" value={summary.activeFacilities} href="/field-ops/facilities" />
        <SummaryCard label="Total resources" value={summary.totalResources} href="/field-ops/resources" />
        <SummaryCard label="Total booking requests" value={summary.totalRequests} href="/field-ops/bookings" />
        <SummaryCard
          label="Pending approvals"
          value={summary.pendingApprovals}
          href="/field-ops/bookings?approvalStatus=PENDING"
        />
        <SummaryCard label="Approved bookings" value={summary.approvedBookings} href="/field-ops/bookings?approvalStatus=APPROVED" />
        <SummaryCard
          label="Denied or canceled"
          value={summary.deniedOrCanceledBookings}
          href="/field-ops/bookings?status=DENIED&status=CANCELED"
        />
        <SummaryCard
          label="Bookings with conflicts"
          value={summary.bookingsWithConflicts}
          href="/field-ops/bookings?hasConflicts=yes"
        />
        <SummaryCard
          label="Upcoming approved"
          value={summary.upcomingApprovedBookings}
          href="/field-ops/bookings?approvalStatus=APPROVED&timeframe=upcoming"
        />
        <SummaryCard label="Upcoming reservations (14d)" value={summary.upcomingBookingsFourteenDays} href="/field-ops/bookings?timeframe=upcoming" />
        <SummaryCard label="Reservations today" value={summary.todayBookings} href="/field-ops/bookings?timeframe=upcoming" />
        <SummaryCard label="Resources with upcoming load" value={summary.resourcesWithUpcomingLoad} href="/field-ops/resources" />
        <SummaryCard label="Resources currently available" value={summary.resourcesWithoutUpcomingLoad} href="/field-ops/resources" />
        <SummaryCard label="Readiness concerns" value={summary.readinessConcerns} href="/field-ops/bookings?hasConflicts=yes" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {summary.pendingApprovals === 0 ? (
          <EmptyState message="No pending approvals right now." />
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {summary.pendingApprovals} booking request{summary.pendingApprovals === 1 ? "" : "s"} waiting for approval.
            </p>
          </div>
        )}
        {summary.bookingsWithConflicts === 0 ? (
          <EmptyState message="No booking conflicts are currently recorded." />
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {summary.bookingsWithConflicts} booking{summary.bookingsWithConflicts === 1 ? "" : "s"} have conflict flags.
            </p>
          </div>
        )}
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Scheduling load summary (14 days)</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upcoming reserved time: {summary.upcomingBookedHours} hour{summary.upcomingBookedHours === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Loaded resources: {summary.resourcesWithUpcomingLoad} · Available resources: {summary.resourcesWithoutUpcomingLoad}
          </p>
        </div>
      </div>

      {summary.resourcesWithoutUpcomingLoad + summary.resourcesWithUpcomingLoad === 0 ? (
        <EmptyState
          message="No active resources are available, so booking requests are currently disabled."
          actionHref="/field-ops/resources"
          actionLabel="Review resources"
        />
      ) : (
        <div className="flex justify-end">
          <Link
            href="/field-ops/bookings/new"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            New booking request
          </Link>
        </div>
      )}
    </section>
  );
}

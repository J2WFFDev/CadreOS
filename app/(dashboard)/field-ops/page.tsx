import { ApprovalStatus, BookingStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
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

  const now = new Date();
  let summary:
    | {
        totalRequests: number;
        pendingApprovals: number;
        approvedBookings: number;
        deniedOrCanceledBookings: number;
        bookingsWithConflicts: number;
        upcomingApprovedBookings: number;
      }
    | null = null;
  let activeResourceCount = 0;
  let queryErrorMessage = "Unable to load FieldOps dashboard metrics right now. Please try again later.";

  try {
    const [
      totalRequests,
      pendingApprovals,
      approvedBookings,
      deniedOrCanceledBookings,
      bookingsWithConflicts,
      upcomingApprovedBookings,
      activeResources,
    ] = await Promise.all([
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
      db.facilityResource.count({
        where: {
          organizationId: scope.organizationId,
          status: "ACTIVE",
          facility: { status: "ACTIVE" },
        },
      }),
    ]);

    summary = {
      totalRequests,
      pendingApprovals,
      approvedBookings,
      deniedOrCanceledBookings,
      bookingsWithConflicts,
      upcomingApprovedBookings,
    };
    activeResourceCount = activeResources;
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
      </div>

      {activeResourceCount === 0 ? (
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

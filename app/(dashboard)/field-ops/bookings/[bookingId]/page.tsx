import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFieldOpsDateTime, formatFieldOpsEnum } from "@/lib/field-ops";
import { appendReturnToParam, resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { canPerformAction } from "@/lib/permissions";
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

function hasSearchParam(searchParams: SearchParams, key: string) {
  return readSearchParam(searchParams, key).length > 0;
}

function getBookingStatusBadgeClass(status: string) {
  if (status === "APPROVED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (status === "DENIED" || status === "CANCELED") {
    return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  }

  if (status === "COMPLETED") {
    return "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100";
  }

  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

function getApprovalBadgeClass(approvalStatus: string) {
  if (approvalStatus === "APPROVED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (approvalStatus === "DENIED") {
    return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  }

  if (approvalStatus === "PENDING") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

export default async function BookingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { bookingId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Booking</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query booking details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Booking</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let booking:
    | {
        id: string;
        title: string;
        description: string | null;
        startsAt: Date;
        endsAt: Date;
        status: string;
        precheckStatus: string;
        approvalStatus: string;
        requestedBy: { id: string; firstName: string; lastName: string };
        approvedBy: { id: string; firstName: string; lastName: string } | null;
        facility: { id: string; name: string; status: string };
        resource: { id: string; name: string; status: string };
        program: { id: string; name: string } | null;
        team: { id: string; name: string } | null;
        event: { id: string; title: string } | null;
        conflicts: Array<{
          id: string;
          conflictType: string;
          severity: string;
          message: string;
          createdAt: Date;
          relatedBooking: { id: string; title: string } | null;
        }>;
      }
    | null = null;
  let queryErrorMessage = "Unable to load booking details right now. Please try again later.";
  let queryFailed = false;

  try {
    booking = await db.resourceBooking.findFirst({
      where: {
        id: bookingId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        status: true,
        precheckStatus: true,
        approvalStatus: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        facility: { select: { id: true, name: true, status: true } },
        resource: { select: { id: true, name: true, status: true } },
        program: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        event: { select: { id: true, title: true } },
        conflicts: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            conflictType: true,
            severity: true,
            message: true,
            createdAt: true,
            relatedBooking: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    queryFailed = true;

    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading booking details.";
    }
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Booking</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!booking) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Booking</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Booking not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const hasConflictWarning = booking.conflicts.length > 0;
  const hasBlockingConflict = booking.conflicts.some((conflict) => conflict.severity === "BLOCKING");
  const isPendingApproval = booking.approvalStatus === "PENDING";
  const isDecisionLockedByStatus = ["COMPLETED", "CANCELED", "DENIED"].includes(booking.status);
  const canShowApprovalActions = isPendingApproval && !isDecisionLockedByStatus;
  const hasInactiveContext = booking.facility.status !== "ACTIVE" || booking.resource.status !== "ACTIVE";
  const returnTo = resolveSafeReturnPath(readSearchParam(resolvedSearchParams, "returnTo"), "/field-ops/bookings");
  const decisionReturnTo = appendReturnToParam(`/field-ops/bookings/${booking.id}`, returnTo);
  const canApproveOrDeny =
    scope.auth.clerkUserId &&
    (await Promise.all([
      canPerformAction({
        actorUserId: scope.auth.clerkUserId,
        organizationId: scope.organizationId,
        action: "booking.approve",
        programId: booking.program?.id,
        teamId: booking.team?.id,
        eventId: booking.event?.id,
      }),
      canPerformAction({
        actorUserId: scope.auth.clerkUserId,
        organizationId: scope.organizationId,
        action: "booking.deny",
        programId: booking.program?.id,
        teamId: booking.team?.id,
        eventId: booking.event?.id,
      }),
    ])).some(Boolean);

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <BackLink href={returnTo} label="Bookings" />
        <FieldOpsSubnav current={booking.approvalStatus === "PENDING" ? "approvals" : "bookings"} />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{booking.title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <Link href={`/field-ops/facilities/${booking.facility.id}`} className="underline">
                {booking.facility.name}
              </Link>{" "}
              ·{" "}
              <Link href={`/field-ops/resources/${booking.resource.id}`} className="underline">
                {booking.resource.name}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBookingStatusBadgeClass(booking.status)}`}>
              Status: {formatFieldOpsEnum(booking.status)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getApprovalBadgeClass(booking.approvalStatus)}`}>
              Approval: {formatFieldOpsEnum(booking.approvalStatus)}
            </span>
          </div>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {booking.description ?? "No booking description has been provided."}
        </p>
        {hasInactiveContext ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Inactive facility/resource context is attached to this booking.
          </p>
        ) : null}
      </div>

      {readSearchParam(resolvedSearchParams, "decisionOutcome") === "approved" ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">Booking approved successfully.</p>
        </div>
      ) : null}

      {readSearchParam(resolvedSearchParams, "decisionOutcome") === "denied" ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">Booking denied successfully.</p>
        </div>
      ) : null}

      {hasSearchParam(resolvedSearchParams, "decisionError") ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
          <p className="text-sm text-red-800 dark:text-red-200">{readSearchParam(resolvedSearchParams, "decisionError")}</p>
        </div>
      ) : null}

      {hasConflictWarning ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Conflict warning: {booking.conflicts.length} conflict{booking.conflicts.length === 1 ? "" : "s"} detected in
            precheck.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Approval decision</h3>
        {canShowApprovalActions ? (
          canApproveOrDeny ? (
            <div className="mt-3 space-y-3">
              {hasBlockingConflict ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Blocking conflicts are present. This request cannot be approved unless policy adds override support.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <form action={`/field-ops/bookings/${booking.id}/decision`} method="post" className="contents">
                  <input type="hidden" name="decision" value="approve" />
                  <input type="hidden" name="returnTo" value={decisionReturnTo} />
                  <button
                    type="submit"
                    disabled={hasBlockingConflict}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve booking
                  </button>
                </form>
                <form action={`/field-ops/bookings/${booking.id}/decision`} method="post" className="contents">
                  <input type="hidden" name="decision" value="deny" />
                  <input type="hidden" name="returnTo" value={decisionReturnTo} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-700 px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Deny booking
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              You do not have permission to approve or deny this booking request.
            </p>
          )
        ) : isDecisionLockedByStatus ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Approval actions are unavailable once a booking is denied, canceled, or completed.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This booking request has already been decided.
          </p>
        )}
      </div>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Start</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsDateTime(booking.startsAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">End</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsDateTime(booking.endsAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Precheck</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {formatFieldOpsEnum(booking.precheckStatus)}
            {booking.conflicts.length > 0 ? ` (${booking.conflicts.length} conflict${booking.conflicts.length === 1 ? "" : "s"})` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Approval</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.approvalStatus)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Facility status</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.facility.status)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Resource status</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.resource.status)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Requested by</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {booking.requestedBy.firstName} {booking.requestedBy.lastName}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Decision by</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {booking.approvedBy ? `${booking.approvedBy.firstName} ${booking.approvedBy.lastName}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Program</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {booking.program ? (
              <Link href={`/programs/${booking.program.id}`} className="underline">
                {booking.program.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Team</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {booking.team ? (
              <Link href={`/teams/${booking.team.id}`} className="underline">
                {booking.team.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Event</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {booking.event ? (
              <Link href={`/events/${booking.event.id}`} className="underline">
                {booking.event.title}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Precheck conflicts</h3>
        {booking.conflicts.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            No conflicts were detected for this booking.
          </div>
        ) : (
          <div className="space-y-3">
            {booking.conflicts.map((conflict) => (
              <article key={conflict.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {formatFieldOpsEnum(conflict.severity)} · {formatFieldOpsEnum(conflict.conflictType)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatFieldOpsDateTime(conflict.createdAt)}</p>
                </div>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">{conflict.message}</p>
                {conflict.relatedBooking ? (
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                    Related booking:{" "}
                    <Link href={appendReturnToParam(`/field-ops/bookings/${conflict.relatedBooking.id}`, returnTo)} className="underline">
                      {conflict.relatedBooking.title}
                    </Link>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

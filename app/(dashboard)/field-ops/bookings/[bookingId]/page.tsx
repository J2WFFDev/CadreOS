import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FieldOpsSubnav } from "@/components/field-ops/subnav";
import { db } from "@/lib/db";
import { formatFieldOpsDateTime, formatFieldOpsEnum } from "@/lib/field-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
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
        facility: { id: string; name: string };
        resource: { id: string; name: string };
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
        facility: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true } },
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

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <BackLink href="/field-ops/bookings" label="Bookings" />
        <FieldOpsSubnav current="bookings" />
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
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {formatFieldOpsEnum(booking.status)}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {booking.description ?? "No booking description has been provided."}
        </p>
      </div>

      {hasConflictWarning ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Conflict warning: {booking.conflicts.length} conflict{booking.conflicts.length === 1 ? "" : "s"} detected in
            precheck.
          </p>
        </div>
      ) : null}

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
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.precheckStatus)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Approval</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.approvalStatus)}</dd>
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
                    <Link href={`/field-ops/bookings/${conflict.relatedBooking.id}`} className="underline">
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

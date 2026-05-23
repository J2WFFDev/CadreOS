import Link from "next/link";

import { formatFieldOpsDateTime, formatFieldOpsEnum } from "@/lib/field-ops";

type BookingCardProps = {
  booking: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    precheckStatus: string;
    approvalStatus: string;
    facility: { id: string; name: string; status?: string };
    resource: { id: string; name: string; status?: string };
    program: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    event: { id: string; title: string } | null;
    conflictCount?: number;
  };
};

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

function renderLinkedContext(booking: BookingCardProps["booking"]) {
  if (!booking.program && !booking.team && !booking.event) {
    return <span>—</span>;
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {booking.program ? (
        <Link href={`/programs/${booking.program.id}`} className="underline">
          Program: {booking.program.name}
        </Link>
      ) : null}
      {booking.team ? (
        <Link href={`/teams/${booking.team.id}`} className="underline">
          Team: {booking.team.name}
        </Link>
      ) : null}
      {booking.event ? (
        <Link href={`/events/${booking.event.id}`} className="underline">
          Event: {booking.event.title}
        </Link>
      ) : null}
    </div>
  );
}

function getStatusBadgeClass(status: string) {
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

function getPrecheckBadgeClass(precheckStatus: string) {
  if (precheckStatus === "PASSED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (precheckStatus === "FAILED") {
    return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  }

  if (precheckStatus === "WARNING") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

export function BookingCard({ booking }: BookingCardProps) {
  const hasConflictWarning = (booking.conflictCount ?? 0) > 0;
  const hasInactiveContext = booking.facility.status !== "ACTIVE" || booking.resource.status !== "ACTIVE";

  return (
    <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-medium">
            <Link href={`/field-ops/bookings/${booking.id}`} className="underline">
              {booking.title}
            </Link>
          </h3>
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
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(booking.status)}`}>
            Status: {formatFieldOpsEnum(booking.status)}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getApprovalBadgeClass(booking.approvalStatus)}`}>
            Approval: {formatFieldOpsEnum(booking.approvalStatus)}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPrecheckBadgeClass(booking.precheckStatus)}`}>
            Precheck: {formatFieldOpsEnum(booking.precheckStatus)}
          </span>
        </div>
      </div>

      {hasConflictWarning ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Conflict warning: {booking.conflictCount} conflict{booking.conflictCount === 1 ? "" : "s"} detected.
          </p>
        </div>
      ) : null}

      {hasInactiveContext ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          Inactive facility/resource context is present for this booking.
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Start</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsDateTime(booking.startsAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">End</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsDateTime(booking.endsAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Approval</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.approvalStatus)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Linked context</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{renderLinkedContext(booking)}</dd>
        </div>
      </dl>
    </article>
  );
}

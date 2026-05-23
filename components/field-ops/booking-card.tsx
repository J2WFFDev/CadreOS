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
    facility: { id: string; name: string };
    resource: { id: string; name: string };
    program: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    event: { id: string; title: string } | null;
  };
};

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

export function BookingCard({ booking }: BookingCardProps) {
  return (
    <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-medium">{booking.title}</h3>
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
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Precheck</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatFieldOpsEnum(booking.precheckStatus)}</dd>
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

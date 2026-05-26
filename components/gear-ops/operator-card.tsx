/**
 * GearOperatorCard — a simplified gear item card for field-operator and cage views.
 *
 * Designed for:
 * - Coaches, volunteers, equipment cage staff, and event operators
 * - Mobile and tablet use with generous tap targets
 * - Card-first layout that surfaces the most operationally important signals
 *
 * Shows:
 * - Item name (link to detail)
 * - Category name
 * - Availability chip (primary operator signal)
 * - Readiness chip (secondary signal)
 * - Current custody holder (if checked out or assigned)
 * - Primary quick action (check out, check in, view, or scan)
 *
 * Hides:
 * - SKU, serial, barcode
 * - Full assignment/checkout history
 * - Maintenance log detail
 */

import Link from "next/link";

import { GearAvailabilityChip, GearReadinessChip } from "@/components/gear-ops/status-badge";
import { type GearAvailabilitySignal } from "@/lib/gear-ops-ui";
import type { InventoryReadinessState } from "@prisma/client";

export type GearOperatorCardProps = {
  id: string;
  name: string;
  categoryName: string;
  categoryId: string;
  availabilitySignal: GearAvailabilitySignal;
  readinessState: InventoryReadinessState | null;
  custodyHolder?: string | null;
  custodyHolderId?: string | null;
  primaryActionLabel: string;
  primaryActionHref: string;
};

export function GearOperatorCard({
  id,
  name,
  categoryName,
  categoryId,
  availabilitySignal,
  readinessState,
  custodyHolder,
  custodyHolderId,
  primaryActionLabel,
  primaryActionHref,
}: GearOperatorCardProps) {
  return (
    <article className="flex flex-col justify-between gap-3 rounded-lg border bg-white p-4 dark:bg-zinc-900 sm:flex-row sm:items-center">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <GearAvailabilityChip signal={availabilitySignal} />
          <GearReadinessChip state={readinessState} />
        </div>
        <h3 className="text-base font-semibold leading-tight">
          <Link
            href={`/gear-ops/items/${id}`}
            className="hover:underline focus:outline-none focus-visible:underline"
          >
            {name}
          </Link>
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/gear-ops/categories/${categoryId}`} className="hover:underline">
            {categoryName}
          </Link>
          {custodyHolder ? (
            <>
              {" · "}
              {custodyHolderId ? (
                <Link href={`/people/${custodyHolderId}`} className="hover:underline">
                  {custodyHolder}
                </Link>
              ) : (
                custodyHolder
              )}
            </>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Link
          href={`/gear-ops/items/${id}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Details
        </Link>
        <Link
          href={primaryActionHref}
          className="inline-flex min-h-[44px] items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {primaryActionLabel}
        </Link>
      </div>
    </article>
  );
}

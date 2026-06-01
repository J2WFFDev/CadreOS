/**
 * GearStatusBadge — renders a rounded-full chip for lifecycle, condition,
 * readiness, checkout, assignment, or availability status.
 *
 * GearReadinessChip — compact inline readiness pill for list/card views.
 * GearAvailabilityBanner — larger bordered box for item-level availability.
 */

import type {
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

import {
  getAssignmentBadgeClass,
  getAssignmentLabel,
  getAvailabilitySignalChipClass,
  getAvailabilitySignalLabel,
  getCheckoutBadgeClass,
  getCheckoutLabel,
  getConditionBadgeClass,
  getConditionLabel,
  getInventoryTypeBadgeClass,
  getInventoryTypeLabel,
  getLifecycleBadgeClass,
  getLifecycleLabel,
  getReadinessBadgeClass,
  getReadinessLabel,
  toneToBoxClass,
  type GearAvailabilitySignal,
  type LifecycleTone,
} from "@/lib/gear-ops-ui";

const BASE_CHIP = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function GearLifecycleBadge({ status }: { status: GearItemLifecycleStatus }) {
  return (
    <span className={`${BASE_CHIP} ${getLifecycleBadgeClass(status)}`}>
      {getLifecycleLabel(status)}
    </span>
  );
}

export function GearConditionBadge({ status }: { status: GearConditionStatus | null }) {
  return (
    <span className={`${BASE_CHIP} ${getConditionBadgeClass(status)}`}>
      {getConditionLabel(status)}
    </span>
  );
}

export function GearReadinessChip({ state }: { state: InventoryReadinessState | null }) {
  return (
    <span className={`${BASE_CHIP} ${getReadinessBadgeClass(state)}`}>
      {getReadinessLabel(state)}
    </span>
  );
}

export function GearCheckoutBadge({ status }: { status: GearCheckoutStatus }) {
  return (
    <span className={`${BASE_CHIP} ${getCheckoutBadgeClass(status)}`}>
      {getCheckoutLabel(status)}
    </span>
  );
}

export function GearAssignmentBadge({ status }: { status: GearAssignmentStatus }) {
  return (
    <span className={`${BASE_CHIP} ${getAssignmentBadgeClass(status)}`}>
      {getAssignmentLabel(status)}
    </span>
  );
}

export function GearInventoryTypeBadge({ type }: { type: GearInventoryType }) {
  return (
    <span className={`${BASE_CHIP} ${getInventoryTypeBadgeClass(type)}`}>
      {getInventoryTypeLabel(type)}
    </span>
  );
}

export function GearAvailabilityChip({ signal }: { signal: GearAvailabilitySignal }) {
  return (
    <span className={`${BASE_CHIP} ${getAvailabilitySignalChipClass(signal)}`}>
      {getAvailabilitySignalLabel(signal)}
    </span>
  );
}

/** A larger bordered box — used at the top of item detail pages. */
export function GearAvailabilityBanner({
  signal,
  detail,
}: {
  signal: GearAvailabilitySignal;
  detail?: string;
}) {
  const toneMap: Record<GearAvailabilitySignal, LifecycleTone> = {
    AVAILABLE: "success",
    RESERVED: "info",
    HELD: "info",
    CHECKED_OUT: "info",
    INSPECTION_NEEDED: "warning",
    RETIRED: "danger",
    ASSIGNED: "info",
    MAINTENANCE: "warning",
    UNAVAILABLE: "danger",
  };

  const tone = toneMap[signal];

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneToBoxClass(tone)}`}>
      <p className="font-semibold">{getAvailabilitySignalLabel(signal)}</p>
      {detail ? <p className="mt-0.5 opacity-80">{detail}</p> : null}
    </div>
  );
}

import {
  GearReservationMode,
  GearReservationStatus,
  type Prisma,
} from "@prisma/client";

import { buildGearReservationVisibilityWhere } from "@/lib/gear-ops-access";
import { db } from "@/lib/db";
import {
  countOpenGearWorkflowTasksByCategory,
  listOpenGearWorkflowTasks,
} from "@/lib/gear-ops-workflows";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

export type GearDashboardCoreMetrics = {
  totalCategories: number;
  totalItems: number;
  durableItems: number;
  consumableItems: number;
  activeAvailableItems: number;
  assignedOrCheckedOutItems: number;
  maintenanceItems: number;
  conditionConcernItems: number;
  activeAssignmentRecords: number;
  openCheckoutRecords: number;
  lowAvailabilityConsumablesCount: number;
  consumableUsageUnits30d: number;
  consumableReplenishmentUnits30d: number;
  consumableNetDelta30d: number;
};

export type GearDashboardSummary = {
  totalCategories: number;
  totalItems: number;
  durableItems: number;
  consumableItems: number;
  activeAvailableItems: number;
  assignedOrCheckedOutItems: number;
  maintenanceItems: number;
  conditionConcernItems: number;
  activeAssignmentRecords: number;
  openCheckoutRecords: number;
  activeReservations: number;
  activeHolds: number;
  upcomingReservations: number;
  conflictingReservations: number;
  lowAvailabilityConsumables: number;
  consumableUsageUnits30d: number;
  consumableReplenishmentUnits30d: number;
  consumableNetDelta30d: number;
  readinessConcerns: number;
};

export type GearReservationDashboardMetrics = {
  activeReservations: number;
  activeHolds: number;
  upcomingReservations: number;
  conflictingReservations: number;
  unavailableReason: string | null;
};

export type GearWorkflowDashboardMetrics = {
  openMaintenanceWorkflowTasks: number;
  openMissingWorkflowTasks: number;
  openDamageWorkflowTasks: number;
  recentWorkflowTasks: Awaited<ReturnType<typeof listOpenGearWorkflowTasks>>;
  unavailableReason: string | null;
};

type ReservationMetricDeps = {
  gearReservationCount: typeof db.gearReservation.count;
};

type WorkflowMetricDeps = {
  countOpenGearWorkflowTasksByCategory: typeof countOpenGearWorkflowTasksByCategory;
  listOpenGearWorkflowTasks: typeof listOpenGearWorkflowTasks;
};

const defaultReservationDeps: ReservationMetricDeps = {
  gearReservationCount: db.gearReservation.count.bind(db.gearReservation),
};

const defaultWorkflowDeps: WorkflowMetricDeps = {
  countOpenGearWorkflowTasksByCategory,
  listOpenGearWorkflowTasks,
};

export function buildGearDashboardSummary(input: {
  core: GearDashboardCoreMetrics;
  reservations: Pick<
    GearReservationDashboardMetrics,
    "activeReservations" | "activeHolds" | "upcomingReservations" | "conflictingReservations"
  >;
}): GearDashboardSummary {
  const { core, reservations } = input;

  return {
    totalCategories: core.totalCategories,
    totalItems: core.totalItems,
    durableItems: core.durableItems,
    consumableItems: core.consumableItems,
    activeAvailableItems: core.activeAvailableItems,
    assignedOrCheckedOutItems: core.assignedOrCheckedOutItems,
    maintenanceItems: core.maintenanceItems,
    conditionConcernItems: core.conditionConcernItems,
    activeAssignmentRecords: core.activeAssignmentRecords,
    openCheckoutRecords: core.openCheckoutRecords,
    activeReservations: reservations.activeReservations,
    activeHolds: reservations.activeHolds,
    upcomingReservations: reservations.upcomingReservations,
    conflictingReservations: reservations.conflictingReservations,
    lowAvailabilityConsumables: core.lowAvailabilityConsumablesCount,
    consumableUsageUnits30d: core.consumableUsageUnits30d,
    consumableReplenishmentUnits30d: core.consumableReplenishmentUnits30d,
    consumableNetDelta30d: core.consumableNetDelta30d,
    readinessConcerns:
      core.maintenanceItems +
      core.conditionConcernItems +
      core.lowAvailabilityConsumablesCount,
  };
}

export async function loadGearReservationDashboardMetrics(
  input: {
    organizationId: string;
    gearItemWhere: Prisma.GearItemWhereInput;
    now?: Date;
  },
  deps: ReservationMetricDeps = defaultReservationDeps,
): Promise<GearReservationDashboardMetrics> {
  const now = input.now ?? new Date();
  const reservationVisibilityWhere = buildGearReservationVisibilityWhere({
    organizationId: input.organizationId,
    gearItemWhere: input.gearItemWhere,
  });

  try {
    const [activeReservations, activeHolds, upcomingReservations, conflictingReservations] = await Promise.all([
      deps.gearReservationCount({
        where: {
          ...reservationVisibilityWhere,
          status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW] },
          mode: GearReservationMode.HARD_RESERVATION,
          windowStartAt: { lte: now },
          windowEndAt: { gte: now },
        },
      }),
      deps.gearReservationCount({
        where: {
          ...reservationVisibilityWhere,
          status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW] },
          mode: GearReservationMode.SOFT_HOLD,
          windowStartAt: { lte: now },
          windowEndAt: { gte: now },
        },
      }),
      deps.gearReservationCount({
        where: {
          ...reservationVisibilityWhere,
          status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW] },
          windowStartAt: { gt: now },
        },
      }),
      deps.gearReservationCount({
        where: {
          ...reservationVisibilityWhere,
          status: GearReservationStatus.CONFLICT,
        },
      }),
    ]);

    return {
      activeReservations,
      activeHolds,
      upcomingReservations,
      conflictingReservations,
      unavailableReason: null,
    };
  } catch (error) {
    console.warn("[GearOps] Reservation dashboard metrics unavailable:", error);

    return {
      activeReservations: 0,
      activeHolds: 0,
      upcomingReservations: 0,
      conflictingReservations: 0,
      unavailableReason: buildDashboardMetricUnavailableReason(error),
    };
  }
}

export async function loadGearWorkflowDashboardMetrics(
  input: {
    organizationId: string;
    limit?: number;
  },
  deps: WorkflowMetricDeps = defaultWorkflowDeps,
): Promise<GearWorkflowDashboardMetrics> {
  try {
    const [openMaintenanceWorkflowTasks, openMissingWorkflowTasks, openDamageWorkflowTasks, recentWorkflowTasks] =
      await Promise.all([
        deps.countOpenGearWorkflowTasksByCategory({ organizationId: input.organizationId, category: "maintenance" }),
        deps.countOpenGearWorkflowTasksByCategory({ organizationId: input.organizationId, category: "missing" }),
        deps.countOpenGearWorkflowTasksByCategory({ organizationId: input.organizationId, category: "damage" }),
        deps.listOpenGearWorkflowTasks({ organizationId: input.organizationId, limit: input.limit ?? 5 }),
      ]);

    return {
      openMaintenanceWorkflowTasks,
      openMissingWorkflowTasks,
      openDamageWorkflowTasks,
      recentWorkflowTasks,
      unavailableReason: null,
    };
  } catch (error) {
    console.warn("[GearOps] Workflow dashboard metrics unavailable:", error);

    return {
      openMaintenanceWorkflowTasks: 0,
      openMissingWorkflowTasks: 0,
      openDamageWorkflowTasks: 0,
      recentWorkflowTasks: [],
      unavailableReason: buildDashboardMetricUnavailableReason(error),
    };
  }
}

function buildDashboardMetricUnavailableReason(error: unknown) {
  if (isSchemaUnavailableError(error)) {
    const detail = describeSchemaUnavailableError(error);
    return detail ? `Unavailable: ${detail}.` : "Unavailable: schema setup required.";
  }

  return "Unavailable right now.";
}

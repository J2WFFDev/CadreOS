import {
  EventGearPlanStatus,
  EventGearRequirementType,
  GearReservationStatus,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
} from "@/lib/prisma-client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOfflineForm } from "@/components/gear-ops/offline-form";
import { GearPendingSubjectCard } from "@/components/gear-ops/pending-subject-card";
import {
  deriveEventGearAssignmentStatus,
  deriveEventGearAvailability,
  formatEventGearEnum,
  getEventGearAvailabilityBadgeClass,
  getEventGearPlanStatusBadgeClass,
  summarizeEventGearPlan,
  summarizeEventGearRequirement,
} from "@/lib/event-gear";
import {
  canReadStaffOnlyContent,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  formatGearOpsDateTime,
  getGearConditionBadgeClass,
  getGearLifecycleBadgeClass,
  getReadinessBadgeClass,
} from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { formatDateTimeInputValue, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type HistoryItem = {
  timestamp: Date;
  title: string;
  detail: string;
  href?: string;
};

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function buildStatusToneClass(hasValue: boolean) {
  return hasValue
    ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
    : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function loadEventGearEvent(organizationId: string, eventId: string) {
  return db.event.findFirst({
    where: { id: eventId, organizationId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      program: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      gearPlan: {
        select: {
          id: true,
          status: true,
          stagingLocationId: true,
          recoveryLocationId: true,
          deploymentLocationText: true,
          checklistNotes: true,
          stagingNotes: true,
          recoveryNotes: true,
          readinessCheckedAt: true,
          preparedAt: true,
          stagingLocation: { select: { id: true, name: true, locationCode: true } },
          recoveryLocation: { select: { id: true, name: true, locationCode: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
          requirements: {
            orderBy: [{ requirementType: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              label: true,
              requirementType: true,
              quantityNeeded: true,
              notes: true,
              gearCategory: { select: { id: true, name: true } },
              assignments: {
                orderBy: [{ assignedAt: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  assignedAt: true,
                  stagedAt: true,
                  recoveredAt: true,
                  conditionOnRecovery: true,
                  maintenanceFlag: true,
                  notes: true,
                  recoveryNotes: true,
                  assignedBy: { select: { id: true, firstName: true, lastName: true } },
                  stagedBy: { select: { id: true, firstName: true, lastName: true } },
                  recoveredBy: { select: { id: true, firstName: true, lastName: true } },
                  stagedFromLocation: { select: { id: true, name: true, locationCode: true } },
                  stagedToLocation: { select: { id: true, name: true, locationCode: true } },
                  recoveredToLocation: { select: { id: true, name: true, locationCode: true } },
                  gearItem: {
                    select: {
                      id: true,
                      name: true,
                      inventoryType: true,
                      lifecycleStatus: true,
                      readinessState: true,
                      conditionStatus: true,
                      quantityOnHand: true,
                      quantityMin: true,
                      category: { select: { id: true, name: true } },
                      location: { select: { id: true, name: true, locationCode: true } },
                      checkouts: {
                        where: { organizationId },
                        orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
                        take: 6,
                        select: {
                          id: true,
                          eventId: true,
                          status: true,
                          checkedOutAt: true,
                          returnedAt: true,
                          checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
                          issuedBy: { select: { id: true, firstName: true, lastName: true } },
                          returnedBy: { select: { id: true, firstName: true, lastName: true } },
                          receivedBy: { select: { id: true, firstName: true, lastName: true } },
                        },
                      },
                      assignments: {
                        where: {
                          organizationId,
                          status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] },
                        },
                        orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
                        take: 6,
                        select: {
                          id: true,
                          status: true,
                          assignedAt: true,
                          assignedToPersonId: true,
                          assignedToTeamId: true,
                          assignedToEventId: true,
                          assignedTo: { select: { id: true, firstName: true, lastName: true } },
                          assignedTeam: { select: { id: true, name: true } },
                          assignedEvent: { select: { id: true, title: true } },
                        },
                      },
                      reservations: {
                        where: {
                          status: {
                            in: [
                              GearReservationStatus.ACTIVE,
                              GearReservationStatus.PENDING_REVIEW,
                              GearReservationStatus.CONFLICT,
                            ],
                          },
                        },
                        select: {
                          mode: true,
                          status: true,
                          approvalStatus: true,
                          windowStartAt: true,
                          windowEndAt: true,
                          reservedForEventId: true,
                        },
                      },
                      maintenanceLogs: {
                        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
                        take: 2,
                        select: { id: true, maintenanceType: true, performedAt: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export default async function EventGearPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load event gear workflows right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const organizationId = scope.organizationId;

  const actorRoleContext = await resolveActorRoleContext({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadStaffOnlyContent(actorRoleContext)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">You do not have staff access to view event gear workflows.</p>
        </div>
      </section>
    );
  }

  const gearAccess = await resolveGearOpsReadAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "events.gear.access",
  });

  if (!gearAccess.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{gearAccess.denialMessage}</p>
        </div>
      </section>
    );
  }

  const defaultQueryErrorMessage = "Unable to load event gear workflows right now. Please try again later.";

  const eventResult = await (async () => {
    try {
      return {
        event: await loadEventGearEvent(organizationId, eventId),
        queryErrorMessage: defaultQueryErrorMessage,
      };
    } catch (error) {
      return {
        event: null,
        queryErrorMessage: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before loading event gear workflows."
          : defaultQueryErrorMessage,
      };
    }
  })();
  const event = eventResult.event;
  const queryErrorMessage = eventResult.queryErrorMessage;

  if (!event) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  let locations;
  let categories;
  let visibleGearItems;
  let eventCheckouts;
  let eventConsumableTransactions;

  try {
    [locations, categories, visibleGearItems, eventCheckouts, eventConsumableTransactions] = await Promise.all([
      db.inventoryLocation.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, locationCode: true },
        orderBy: [{ name: "asc" }],
      }),
      db.gearCategory.findMany({
        where: { organizationId },
        select: { id: true, name: true, inventoryType: true },
        orderBy: [{ name: "asc" }],
      }),
      db.gearItem.findMany({
        where: {
          AND: [
            gearAccess.where,
            {
              OR: [{ programId: null }, { programId: event.program.id }],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          inventoryType: true,
          lifecycleStatus: true,
          readinessState: true,
          conditionStatus: true,
          quantityOnHand: true,
          quantityMin: true,
          category: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, locationCode: true } },
          reservations: {
            where: {
              status: {
                in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW, GearReservationStatus.CONFLICT],
              },
            },
            select: {
              mode: true,
              status: true,
              approvalStatus: true,
              windowStartAt: true,
              windowEndAt: true,
              reservedForEventId: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
      db.gearCheckout.findMany({
        where: { organizationId, eventId },
        orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          checkedOutAt: true,
          returnedAt: true,
          purposeNotes: true,
          returnNotes: true,
          conditionOnReturn: true,
          gearItem: { select: { id: true, name: true } },
          checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
          issuedBy: { select: { id: true, firstName: true, lastName: true } },
          returnedBy: { select: { id: true, firstName: true, lastName: true } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      db.consumableTransaction.findMany({
        where: { organizationId, eventId },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          transactionType: true,
          quantityDelta: true,
          recordedAt: true,
          notes: true,
          gearItem: { select: { id: true, name: true } },
          recordedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);
  } catch (error) {
    const supportQueryErrorMessage = isSchemaUnavailableError(error)
      ? "Database schema is not available yet. Run database setup before loading event gear workflows."
      : queryErrorMessage;

    if (isSchemaUnavailableError(error)) {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
          <ErrorMessage message={supportQueryErrorMessage} />
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event gear</h2>
        <ErrorMessage message={supportQueryErrorMessage} />
      </section>
    );
  }

  const plan = event.gearPlan;
  const nowInputValue = formatDateTimeInputValue(new Date());
  const eventWindowEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 4 * 60 * 60 * 1000);
  const planSaved = readSearchParam(resolvedSearchParams, "planSaved") === "1";
  const planError = readSearchParam(resolvedSearchParams, "planError");
  const requirementSaved = readSearchParam(resolvedSearchParams, "requirementSaved") === "1";
  const requirementError = readSearchParam(resolvedSearchParams, "requirementError");
  const assignmentSaved = readSearchParam(resolvedSearchParams, "assignmentSaved") === "1";
  const assignmentError = readSearchParam(resolvedSearchParams, "assignmentError");
  const stagingSaved = readSearchParam(resolvedSearchParams, "stagingSaved") === "1";
  const stagingError = readSearchParam(resolvedSearchParams, "stagingError");
  const recoverySaved = readSearchParam(resolvedSearchParams, "recoverySaved") === "1";
  const recoveryError = readSearchParam(resolvedSearchParams, "recoveryError");
  const assignedGearItemIds = new Set(
    plan?.requirements.flatMap((requirement) => requirement.assignments.map((assignment) => assignment.gearItem.id)) ?? [],
  );
  const overlapsEventWindow = (startAt: Date, endAt: Date) =>
    startAt.getTime() < eventWindowEnd.getTime() && event.startsAt.getTime() < endAt.getTime();

  const requirementViews =
    plan?.requirements.map((requirement) => {
      const assignments = requirement.assignments.map((assignment) => {
        const activeEventCheckout = assignment.gearItem.checkouts.find((checkout) => checkout.eventId === event.id) ?? null;
        const blockingCheckout = assignment.gearItem.checkouts.find(
          (checkout) => checkout.eventId !== event.id && (checkout.status === GearCheckoutStatus.OPEN || checkout.status === GearCheckoutStatus.OVERDUE),
        ) ?? null;
        const blockingAssignment = assignment.gearItem.assignments.some(
          (gearAssignment) =>
            gearAssignment.assignedToEventId !== event.id &&
            (gearAssignment.assignedToEventId || gearAssignment.assignedToTeamId || gearAssignment.assignedToPersonId),
        );
        const blockingReservation =
          assignment.gearItem.reservations.find(
            (reservation) =>
              reservation.reservedForEventId !== event.id &&
              overlapsEventWindow(reservation.windowStartAt, reservation.windowEndAt),
          ) ?? null;
        const assignmentSnapshot = {
          stagedAt: assignment.stagedAt,
          recoveredAt: assignment.recoveredAt,
          activeEventCheckout: activeEventCheckout
            ? { status: activeEventCheckout.status, returnedAt: activeEventCheckout.returnedAt }
            : null,
          blockingCheckout: blockingCheckout ? { status: blockingCheckout.status, returnedAt: blockingCheckout.returnedAt } : null,
          blockingAssignment,
          blockingReservationMode: blockingReservation?.mode ?? null,
          reservationNeedsApproval: blockingReservation?.approvalStatus === "PENDING",
          gearItem: {
            id: assignment.gearItem.id,
            lifecycleStatus: assignment.gearItem.lifecycleStatus,
            readinessState: assignment.gearItem.readinessState,
            conditionStatus: assignment.gearItem.conditionStatus,
            quantityOnHand: assignment.gearItem.quantityOnHand,
            quantityMin: assignment.gearItem.quantityMin,
          },
        };

        return {
          ...assignment,
          activeEventCheckout,
          blockingCheckout,
          blockingAssignment,
          blockingReservation,
          operationalStatus: deriveEventGearAssignmentStatus(assignmentSnapshot),
          availability: deriveEventGearAvailability(assignmentSnapshot),
        };
      });

      const summary = summarizeEventGearRequirement({
        requirementType: requirement.requirementType,
        quantityNeeded: requirement.quantityNeeded,
        assignments: assignments.map((assignment) => ({
          stagedAt: assignment.stagedAt,
          recoveredAt: assignment.recoveredAt,
          activeEventCheckout: assignment.activeEventCheckout
            ? { status: assignment.activeEventCheckout.status, returnedAt: assignment.activeEventCheckout.returnedAt }
            : null,
          blockingCheckout: assignment.blockingCheckout
            ? { status: assignment.blockingCheckout.status, returnedAt: assignment.blockingCheckout.returnedAt }
            : null,
          blockingAssignment: assignment.blockingAssignment,
          blockingReservationMode: assignment.blockingReservation?.mode ?? null,
          reservationNeedsApproval: assignment.blockingReservation?.approvalStatus === "PENDING",
          gearItem: {
            id: assignment.gearItem.id,
            lifecycleStatus: assignment.gearItem.lifecycleStatus,
            readinessState: assignment.gearItem.readinessState,
            conditionStatus: assignment.gearItem.conditionStatus,
            quantityOnHand: assignment.gearItem.quantityOnHand,
            quantityMin: assignment.gearItem.quantityMin,
          },
        })),
      });

      const availableGearItems = visibleGearItems.filter((item) => {
        if (requirement.gearCategory?.id && item.category.id !== requirement.gearCategory.id) {
          return false;
        }
        const blockingReservation = item.reservations.find(
          (reservation) =>
            reservation.reservedForEventId !== event.id &&
            overlapsEventWindow(reservation.windowStartAt, reservation.windowEndAt) &&
            (reservation.mode === "HARD_RESERVATION" || reservation.approvalStatus === "PENDING"),
        );
        if (blockingReservation) {
          return false;
        }
        return !assignedGearItemIds.has(item.id);
      });

      return {
        ...requirement,
        assignments,
        summary,
        availableGearItems,
      };
    }) ?? [];

  const planSummary = plan
    ? summarizeEventGearPlan({
        requirements: requirementViews.map((requirement) => ({
          requirementType: requirement.requirementType,
          quantityNeeded: requirement.quantityNeeded,
          assignments: requirement.assignments.map((assignment) => ({
            stagedAt: assignment.stagedAt,
            recoveredAt: assignment.recoveredAt,
            activeEventCheckout: assignment.activeEventCheckout
              ? { status: assignment.activeEventCheckout.status, returnedAt: assignment.activeEventCheckout.returnedAt }
              : null,
            blockingCheckout: assignment.blockingCheckout
              ? { status: assignment.blockingCheckout.status, returnedAt: assignment.blockingCheckout.returnedAt }
              : null,
            blockingAssignment: assignment.blockingAssignment,
            blockingReservationMode: assignment.blockingReservation?.mode ?? null,
            reservationNeedsApproval: assignment.blockingReservation?.approvalStatus === "PENDING",
            gearItem: {
              id: assignment.gearItem.id,
              lifecycleStatus: assignment.gearItem.lifecycleStatus,
              readinessState: assignment.gearItem.readinessState,
              conditionStatus: assignment.gearItem.conditionStatus,
              quantityOnHand: assignment.gearItem.quantityOnHand,
              quantityMin: assignment.gearItem.quantityMin,
            },
          })),
        })),
      })
    : null;

  const missingRequirements = requirementViews.filter((requirement) => requirement.summary.gapCount > 0);
  const deployedAssignments = requirementViews.flatMap((requirement) =>
    requirement.assignments
      .filter((assignment) => assignment.operationalStatus === "DEPLOYED")
      .map((assignment) => ({ requirement, assignment })),
  );
  const recoveryQueue = requirementViews.flatMap((requirement) =>
    requirement.assignments
      .filter((assignment) => assignment.operationalStatus === "RETURNED")
      .map((assignment) => ({ requirement, assignment })),
  );

  const historyItems: HistoryItem[] = [];
  for (const requirement of requirementViews) {
    for (const assignment of requirement.assignments) {
      if (assignment.stagedAt) {
        historyItems.push({
          timestamp: assignment.stagedAt,
          title: `${assignment.gearItem.name} staged`,
          detail: `${requirement.label}${assignment.stagedToLocation ? ` · ${assignment.stagedToLocation.name}` : ""}`,
          href: `/gear-ops/items/${assignment.gearItem.id}`,
        });
      }
      if (assignment.recoveredAt) {
        historyItems.push({
          timestamp: assignment.recoveredAt,
          title: `${assignment.gearItem.name} recovered`,
          detail: `${requirement.label}${assignment.recoveredToLocation ? ` · ${assignment.recoveredToLocation.name}` : ""}`,
          href: `/gear-ops/items/${assignment.gearItem.id}`,
        });
      }
    }
  }
  for (const checkout of eventCheckouts) {
    historyItems.push({
      timestamp: checkout.checkedOutAt,
      title: `${checkout.gearItem.name} checked out`,
      detail: `${checkout.checkedOutBy.firstName} ${checkout.checkedOutBy.lastName}${checkout.purposeNotes ? ` · ${checkout.purposeNotes}` : ""}`,
      href: `/gear-ops/items/${checkout.gearItem.id}`,
    });
    if (checkout.returnedAt) {
      historyItems.push({
        timestamp: checkout.returnedAt,
        title: `${checkout.gearItem.name} returned`,
        detail: checkout.receivedBy ? `${checkout.receivedBy.firstName} ${checkout.receivedBy.lastName}` : checkout.returnNotes ?? "Return recorded",
        href: `/gear-ops/items/${checkout.gearItem.id}`,
      });
    }
  }
  for (const transaction of eventConsumableTransactions) {
    historyItems.push({
      timestamp: transaction.recordedAt,
      title: `${transaction.gearItem.name} ${formatEventGearEnum(transaction.transactionType)}`,
      detail: `Delta ${transaction.quantityDelta > 0 ? "+" : ""}${transaction.quantityDelta}`,
      href: `/gear-ops/items/${transaction.gearItem.id}`,
    });
  }
  historyItems.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href={`/events/${event.id}`} label={event.title} />
        <h2 className="text-2xl font-semibold tracking-tight">Event gear planning and deployment</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {event.title} · {event.program.name}
          {event.team ? ` · ${event.team.name}` : ""} · Starts {formatDateTime(event.startsAt)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/events/${event.id}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Event details
        </Link>
        <Link href="/gear-ops/scan?scanContext=CHECKOUT" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Rapid event checkout
        </Link>
        <Link href="/gear-ops/scan?scanContext=CHECKIN" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Rapid event return
        </Link>
        <Link href="/gear-ops/scan?scanContext=CAGE_VAULT" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Vault / cage flow
        </Link>
      </div>

      {planSaved || requirementSaved || assignmentSaved || stagingSaved || recoverySaved ? (
        <div className={buildStatusToneClass(true)}>Event gear workflow updates were saved.</div>
      ) : null}
      {planError ? <div className={buildStatusToneClass(false)}>{planError}</div> : null}
      {requirementError ? <div className={buildStatusToneClass(false)}>{requirementError}</div> : null}
      {assignmentError ? <div className={buildStatusToneClass(false)}>{assignmentError}</div> : null}
      {stagingError ? <div className={buildStatusToneClass(false)}>{stagingError}</div> : null}
      {recoveryError ? <div className={buildStatusToneClass(false)}>{recoveryError}</div> : null}

      <div id="plan-settings" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Event gear plan</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Keep planning lightweight: define what is needed, stage it from storage, and use existing rapid checkout and return workflows for custody.
            </p>
          </div>
          {plan ? (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getEventGearPlanStatusBadgeClass(plan.status)}`}>
              {formatEventGearEnum(plan.status)}
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              No plan yet
            </span>
          )}
        </div>

        <GearOfflineForm
          action={`/events/${event.id}/gear/plan/save`}
          className="mt-4 grid gap-4 lg:grid-cols-2"
          actionType="event.gear.plan.save"
          subjectType="EVENT"
          subjectId={event.id}
          subjectLabel={event.title}
          permissionKey="events.gear.plan.save"
          returnHref={`/events/${event.id}/gear`}
          queueLabel={`Event gear plan · ${event.title}`}
        >
          <div className="space-y-1">
            <label htmlFor="status" className="text-sm font-medium">Plan status</label>
            <select id="status" name="status" defaultValue={plan?.status ?? EventGearPlanStatus.DRAFT} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(EventGearPlanStatus).map((status) => (
                <option key={status} value={status}>{formatEventGearEnum(status)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="deploymentLocationText" className="text-sm font-medium">Deployment location / context</label>
            <input
              id="deploymentLocationText"
              name="deploymentLocationText"
              defaultValue={plan?.deploymentLocationText ?? event.location ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Range 2, home field, camp admin table, etc."
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="stagingLocationId" className="text-sm font-medium">Staging location</label>
            <select id="stagingLocationId" name="stagingLocationId" defaultValue={plan?.stagingLocationId ?? ""} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No default staging location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}{location.locationCode ? ` (${location.locationCode})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="recoveryLocationId" className="text-sm font-medium">Recovery location</label>
            <select id="recoveryLocationId" name="recoveryLocationId" defaultValue={plan?.recoveryLocationId ?? ""} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No default recovery location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}{location.locationCode ? ` (${location.locationCode})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="checklistNotes" className="text-sm font-medium">Checklist notes</label>
            <textarea id="checklistNotes" name="checklistNotes" defaultValue={plan?.checklistNotes ?? ""} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Ready checks, pickup notes, vault prep, last-minute reminders." />
          </div>
          <div className="space-y-1">
            <label htmlFor="stagingNotes" className="text-sm font-medium">Staging notes</label>
            <textarea id="stagingNotes" name="stagingNotes" defaultValue={plan?.stagingNotes ?? ""} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="recoveryNotes" className="text-sm font-medium">Recovery notes</label>
            <textarea id="recoveryNotes" name="recoveryNotes" defaultValue={plan?.recoveryNotes ?? ""} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              Readiness checked {formatDateTime(plan?.readinessCheckedAt ?? null)} · Prepared {formatDateTime(plan?.preparedAt ?? null)}
              {plan?.preparedBy ? ` by ${plan.preparedBy.firstName} ${plan.preparedBy.lastName}` : ""}
            </div>
            <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
              {plan ? "Update plan" : "Create plan"}
            </button>
          </div>
        </GearOfflineForm>
      </div>

      {planSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900"><p className="text-xs uppercase tracking-wide text-zinc-500">Requirements</p><p className="mt-2 text-2xl font-semibold">{planSummary.requirementCount}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{planSummary.requiredRequirementCount} required · {planSummary.optionalRequirementCount} optional · {planSummary.supportRequirementCount} support</p></article>
          <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900"><p className="text-xs uppercase tracking-wide text-zinc-500">Assignments</p><p className="mt-2 text-2xl font-semibold">{planSummary.assignmentCount}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{planSummary.stagedCount} staged · {planSummary.deployedCount} deployed · {planSummary.recoveredCount} recovered</p></article>
          <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900"><p className="text-xs uppercase tracking-wide text-zinc-500">Readiness</p><p className="mt-2 text-2xl font-semibold">{planSummary.readyCount}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{planSummary.limitedUseCount} limited-use · {planSummary.unavailableCount} unavailable</p></article>
          <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900"><p className="text-xs uppercase tracking-wide text-zinc-500">Concerns</p><p className="mt-2 text-2xl font-semibold">{planSummary.concernCount}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{planSummary.gapCount} gaps · {planSummary.outOfServiceCount} out of service · {planSummary.maintenanceNeededCount} maintenance-needed</p></article>
        </div>
      ) : null}

      <GearPendingSubjectCard
        subjectType="EVENT"
        subjectId={event.id}
        title="Pending event field actions"
        emptyMessage="No local pending or failed event gear actions are attached to this event."
      />

      <div id="requirements" className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Add event gear requirement</h3>
            <GearOfflineForm
              action={`/events/${event.id}/gear/requirements/create`}
              className="mt-4 grid gap-4 md:grid-cols-2"
              actionType="event.gear.requirement.create"
              subjectType="EVENT"
              subjectId={event.id}
              subjectLabel={event.title}
              permissionKey="events.gear.requirement.create"
              returnHref={`/events/${event.id}/gear`}
              queueLabel={`Event requirement · ${event.title}`}
            >
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="label" className="text-sm font-medium">Requirement label</label>
                <input id="label" name="label" className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Radios, timers, banners, first aid kit, cones..." />
              </div>
              <div className="space-y-1">
                <label htmlFor="requirementType" className="text-sm font-medium">Requirement type</label>
                <select id="requirementType" name="requirementType" defaultValue={EventGearRequirementType.REQUIRED} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.values(EventGearRequirementType).map((type) => <option key={type} value={type}>{formatEventGearEnum(type)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="quantityNeeded" className="text-sm font-medium">Quantity needed</label>
                <input id="quantityNeeded" name="quantityNeeded" type="number" min={1} defaultValue={1} className="w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label htmlFor="gearCategoryId" className="text-sm font-medium">Preferred category</label>
                <select id="gearCategoryId" name="gearCategoryId" defaultValue="" className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Any category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {formatEventGearEnum(category.inventoryType)}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="notes" className="text-sm font-medium">Notes</label>
                <textarea id="notes" name="notes" rows={2} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Optional/support context, vault handling, ammo or consumable expectations, etc." />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black" disabled={!plan}>
                  Add requirement
                </button>
              </div>
            </GearOfflineForm>
            {!plan ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Create the plan first to start adding requirements.</p> : null}
          </div>

          {requirementViews.length === 0 ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              No gear requirements are defined for this event yet.
            </div>
          ) : (
            requirementViews.map((requirement) => (
              <article key={requirement.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{requirement.label}</h3>
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {formatEventGearEnum(requirement.requirementType)}
                      </span>
                      {requirement.gearCategory ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                          {requirement.gearCategory.name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Need {requirement.quantityNeeded} · Assigned {requirement.summary.assignedCount} · Gap {requirement.summary.gapCount}
                    </p>
                    {requirement.notes ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{requirement.notes}</p> : null}
                  </div>
                  <div className="text-right text-xs text-zinc-600 dark:text-zinc-400">
                    <p>{requirement.summary.readyCount} ready</p>
                    <p>{requirement.summary.limitedUseCount} limited-use</p>
                    <p>{requirement.summary.unavailableCount} unavailable</p>
                    <p>{requirement.summary.outOfServiceCount + requirement.summary.maintenanceNeededCount} service concerns</p>
                  </div>
                </div>

                <GearOfflineForm
                  action={`/events/${event.id}/gear/assignments/create`}
                  className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]"
                  actionType="event.gear.assignment.create"
                  subjectType="EVENT"
                  subjectId={event.id}
                  subjectLabel={event.title}
                  permissionKey="events.gear.assignment.create"
                  returnHref={`/events/${event.id}/gear`}
                  queueLabel={`Event assignment · ${requirement.label}`}
                >
                  <input type="hidden" name="requirementId" value={requirement.id} />
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor={`gearItemId-${requirement.id}`}>Assign specific inventory item</label>
                    <select id={`gearItemId-${requirement.id}`} name="gearItemId" defaultValue="" className="w-full rounded-md border px-3 py-2 text-sm">
                      <option value="">Select gear item</option>
                      {visibleGearItems
                        .filter((item) => !requirement.assignments.some((assignment) => assignment.gearItem.id === item.id))
                        .filter((item) => (requirement.gearCategory ? item.category.id === requirement.gearCategory.id : true))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.category.name} · {formatEventGearEnum(item.lifecycleStatus)}
                            {item.reservations.some(
                              (reservation) =>
                                reservation.reservedForEventId !== event.id &&
                                overlapsEventWindow(reservation.windowStartAt, reservation.windowEndAt),
                            )
                              ? " · Hold / reserve context"
                              : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-end justify-end">
                    <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Assign item</button>
                  </div>
                </GearOfflineForm>

                {requirement.assignments.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No inventory items are assigned to this requirement yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {requirement.assignments.map((assignment) => {
                      const checkoutHref = `/gear-ops/items/${assignment.gearItem.id}/checkout?eventId=${event.id}&status=OPEN&checkedOutAt=${encodeURIComponent(nowInputValue)}&expectedReturnAt=${encodeURIComponent(formatDateTimeInputValue(event.endsAt))}&purposeNotes=${encodeURIComponent(requirement.label)}`;
                      const latestEventCheckout = assignment.activeEventCheckout;
                      const returnHref = latestEventCheckout
                        ? `/gear-ops/items/${assignment.gearItem.id}/checkouts/${latestEventCheckout.id}/edit?status=RETURNED&returnedAt=${encodeURIComponent(nowInputValue)}`
                        : `/gear-ops/items/${assignment.gearItem.id}`;

                      return (
                        <div key={assignment.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <Link href={`/gear-ops/items/${assignment.gearItem.id}`} className="font-medium underline">
                                {assignment.gearItem.name}
                              </Link>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                {assignment.gearItem.category.name}
                                {assignment.gearItem.location ? ` · ${assignment.gearItem.location.name}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className={`inline-flex rounded-full px-2 py-1 font-medium ${getEventGearAvailabilityBadgeClass(assignment.availability)}`}>{formatEventGearEnum(assignment.availability)}</span>
                              <span className="inline-flex rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{formatEventGearEnum(assignment.operationalStatus)}</span>
                              <span className={`inline-flex rounded-full px-2 py-1 font-medium ${getGearLifecycleBadgeClass(assignment.gearItem.lifecycleStatus)}`}>{formatEventGearEnum(assignment.gearItem.lifecycleStatus)}</span>
                              {assignment.gearItem.readinessState ? <span className={`inline-flex rounded-full px-2 py-1 font-medium ${getReadinessBadgeClass(assignment.gearItem.readinessState)}`}>{formatEventGearEnum(assignment.gearItem.readinessState)}</span> : null}
                              {assignment.gearItem.conditionStatus ? <span className={`inline-flex rounded-full px-2 py-1 font-medium ${getGearConditionBadgeClass(assignment.gearItem.conditionStatus)}`}>{formatEventGearEnum(assignment.gearItem.conditionStatus)}</span> : null}
                            </div>
                          </div>

                          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                            <div><dt className="font-medium">Assigned</dt><dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(assignment.assignedAt)}</dd></div>
                            <div><dt className="font-medium">Staged</dt><dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(assignment.stagedAt)}</dd></div>
                            <div><dt className="font-medium">Returned</dt><dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(latestEventCheckout?.returnedAt ?? null)}</dd></div>
                            <div><dt className="font-medium">Recovered</dt><dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(assignment.recoveredAt)}</dd></div>
                          </dl>

                          {assignment.blockingCheckout ? (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                              Another open checkout is still active for this item.
                            </p>
                          ) : null}
                          {assignment.blockingAssignment ? (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                              Another active assignment already claims this item.
                            </p>
                          ) : null}
                          {assignment.blockingReservation ? (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                              Another reservation or hold overlaps this event window.
                            </p>
                          ) : null}
                          {assignment.notes ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Plan note: {assignment.notes}</p> : null}
                          {assignment.recoveryNotes ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Recovery note: {assignment.recoveryNotes}</p> : null}

                          <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            {!assignment.stagedAt && !assignment.recoveredAt ? (
                              <GearOfflineForm
                                action={`/events/${event.id}/gear/staging`}
                                className="flex flex-wrap items-center gap-2"
                                actionType="event.gear.staging"
                                subjectType="EVENT"
                                subjectId={event.id}
                                subjectLabel={event.title}
                                permissionKey="events.gear.staging"
                                returnHref={`/events/${event.id}/gear`}
                                queueLabel={`Event staging · ${assignment.gearItem.name}`}
                              >
                                <input type="hidden" name="eventGearAssignmentId" value={assignment.id} />
                                <select name="stagedToLocationId" defaultValue={plan?.stagingLocationId ?? assignment.gearItem.location?.id ?? ""} className="rounded-md border px-2 py-1 text-sm">
                                  <option value="">Use current / no change</option>
                                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                </select>
                                <button type="submit" className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">Stage</button>
                              </GearOfflineForm>
                            ) : null}
                            {!latestEventCheckout && !assignment.recoveredAt ? (
                              <Link href={checkoutHref} className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">Issue / checkout</Link>
                            ) : null}
                            {latestEventCheckout && (latestEventCheckout.status === GearCheckoutStatus.OPEN || latestEventCheckout.status === GearCheckoutStatus.OVERDUE) ? (
                              <Link href={returnHref} className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">Return / check in</Link>
                            ) : null}
                            {latestEventCheckout?.returnedAt && !assignment.recoveredAt ? (
                              <GearOfflineForm
                                action={`/events/${event.id}/gear/recovery`}
                                className="grid gap-2 rounded-md border p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                                actionType="event.gear.recovery"
                                subjectType="EVENT"
                                subjectId={event.id}
                                subjectLabel={event.title}
                                permissionKey="events.gear.recovery"
                                returnHref={`/events/${event.id}/gear`}
                                queueLabel={`Event recovery · ${assignment.gearItem.name}`}
                              >
                                <input type="hidden" name="eventGearAssignmentId" value={assignment.id} />
                                <select name="recoveredToLocationId" defaultValue={plan?.recoveryLocationId ?? assignment.gearItem.location?.id ?? ""} className="rounded-md border px-2 py-1 text-sm">
                                  <option value="">No recovery location update</option>
                                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                </select>
                                <select name="conditionOnRecovery" defaultValue={assignment.conditionOnRecovery ?? assignment.gearItem.conditionStatus ?? ""} className="rounded-md border px-2 py-1 text-sm">
                                  <option value="">Keep current condition</option>
                                  {Object.values(GearConditionStatus).map((condition) => <option key={condition} value={condition}>{formatEventGearEnum(condition)}</option>)}
                                </select>
                                <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"><input type="checkbox" name="maintenanceFlag" defaultChecked={assignment.maintenanceFlag} /> Maintenance flag</label>
                                <textarea name="recoveryNotes" rows={2} className="md:col-span-2 rounded-md border px-2 py-1 text-sm" placeholder="Damage, missing parts, consumable follow-up, cage notes..." />
                                <div className="md:col-span-1 flex justify-end"><button type="submit" className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">Complete recovery</button></div>
                              </GearOfflineForm>
                            ) : null}
                            {assignment.gearItem.inventoryType === GearInventoryType.CONSUMABLE ? (
                              <Link href={`/gear-ops/items/${assignment.gearItem.id}/consumables/new?eventId=${event.id}&recordedAt=${encodeURIComponent(nowInputValue)}`} className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">Adjust consumable</Link>
                            ) : null}
                            <Link href={`/gear-ops/items/${assignment.gearItem.id}/maintenance/new?performedAt=${encodeURIComponent(nowInputValue)}`} className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">Maintenance log</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Readiness summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between"><dt>Ready gear</dt><dd>{planSummary?.readyCount ?? 0}</dd></div>
              <div className="flex items-center justify-between"><dt>Missing / not assigned</dt><dd>{planSummary?.gapCount ?? 0}</dd></div>
              <div className="flex items-center justify-between"><dt>Unavailable</dt><dd>{planSummary?.unavailableCount ?? 0}</dd></div>
              <div className="flex items-center justify-between"><dt>Out of service</dt><dd>{planSummary?.outOfServiceCount ?? 0}</dd></div>
              <div className="flex items-center justify-between"><dt>Limited-use</dt><dd>{planSummary?.limitedUseCount ?? 0}</dd></div>
              <div className="flex items-center justify-between"><dt>Maintenance-needed</dt><dd>{planSummary?.maintenanceNeededCount ?? 0}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              Limited-use highlights fair-condition or needs-inspection gear. Unavailable highlights active custody conflicts. Out-of-service and maintenance-needed gear should be swapped before departure when possible.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Missing / unreturned view</h3>
            {missingRequirements.length === 0 && deployedAssignments.length === 0 && recoveryQueue.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No current event gear gaps or recovery actions are visible.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                {missingRequirements.length > 0 ? (
                  <div>
                    <p className="font-medium">Requirement gaps</p>
                    <ul className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-400">
                      {missingRequirements.map((requirement) => (
                        <li key={requirement.id}>{requirement.label}: {requirement.summary.gapCount} still needed</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {deployedAssignments.length > 0 ? (
                  <div>
                    <p className="font-medium">Still deployed / unreturned</p>
                    <ul className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-400">
                      {deployedAssignments.map(({ assignment }) => (
                        <li key={assignment.id}>{assignment.gearItem.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {recoveryQueue.length > 0 ? (
                  <div>
                    <p className="font-medium">Returned, awaiting cage / vault recovery</p>
                    <ul className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-400">
                      {recoveryQueue.map(({ assignment }) => (
                        <li key={assignment.id}>{assignment.gearItem.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div id="recovery-review" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Deployment and recovery workflow</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>1. Plan required, optional, and support gear for the event.</li>
              <li>2. Assign specific inventory items and stage them from vault or cage locations.</li>
              <li>3. Use rapid/mobile checkout or item checkout links to issue gear to the event transport or operator.</li>
              <li>4. Use rapid return or item return links to record custody hand-back after the event.</li>
              <li>5. Complete recovery back into storage, flag condition issues, and log maintenance or consumable adjustments as needed.</li>
            </ul>
          </div>

          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Event gear history timeline</h3>
            {historyItems.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No event gear history has been recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {historyItems.slice(0, 12).map((item, index) => (
                  <li key={`${item.title}-${index}`} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.href ? <Link href={item.href} className="underline">{item.title}</Link> : item.title}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatGearOpsDateTime(item.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Event-linked checkouts and consumables</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="font-medium">Event custody records</h4>
            {eventCheckouts.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No checkout records are linked to this event yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {eventCheckouts.slice(0, 8).map((checkout) => (
                  <li key={checkout.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/gear-ops/items/${checkout.gearItem.id}`} className="font-medium underline">{checkout.gearItem.name}</Link>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatEventGearEnum(checkout.status)}</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(checkout.checkedOutAt)} · {checkout.checkedOutBy.firstName} {checkout.checkedOutBy.lastName}</p>
                    {checkout.returnedAt ? <p className="text-zinc-600 dark:text-zinc-400">Returned {formatGearOpsDateTime(checkout.returnedAt)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="font-medium">Event consumable adjustments</h4>
            {eventConsumableTransactions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No consumable transactions are linked to this event yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {eventConsumableTransactions.slice(0, 8).map((transaction) => (
                  <li key={transaction.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/gear-ops/items/${transaction.gearItem.id}`} className="font-medium underline">{transaction.gearItem.name}</Link>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatEventGearEnum(transaction.transactionType)}</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(transaction.recordedAt)} · {transaction.quantityDelta > 0 ? "+" : ""}{transaction.quantityDelta}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

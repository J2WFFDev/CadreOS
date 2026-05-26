import {
  ApprovalStatus,
  GearReservationMode,
  GearReservationStatus,
  InventoryMovementType,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  evaluateGearReservationConflicts,
  formatGearReservationEnum,
} from "@/lib/gear-reservations";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";
import {
  gearReservationWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearReservationFormValues = {
  status: string;
  mode: string;
  purpose: string;
  holdType: string;
  reservedForPersonId: string;
  reservedForTeamId: string;
  reservedForEventId: string;
  programId: string;
  quantityRequested: string;
  windowStartAt: string;
  windowEndAt: string;
  notes: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  input: {
    values: GearReservationFormValues;
    fieldErrors?: Partial<Record<keyof GearReservationFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/reserve`, requestUrl);

  Object.entries(input.values).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (input.fieldErrors) {
    Object.entries(input.fieldErrors).forEach(([key, message]) => {
      if (message) {
        url.searchParams.set(`${key}Error`, message);
      }
    });
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

async function ensureRecordInOrganization(
  kind: "person" | "team" | "event" | "program",
  id: string,
  organizationId: string,
) {
  const where = { id, organizationId };
  const select = { id: true };
  let record: { id: string } | null = null;
  if (kind === "person") record = await db.person.findFirst({ where, select });
  else if (kind === "team") record = await db.team.findFirst({ where, select });
  else if (kind === "event") record = await db.event.findFirst({ where, select });
  else record = await db.program.findFirst({ where, select });
  return Boolean(record);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: GearReservationFormValues = {
    status: getStringField(formData, "status"),
    mode: getStringField(formData, "mode"),
    purpose: getStringField(formData, "purpose"),
    holdType: getStringField(formData, "holdType"),
    reservedForPersonId: getStringField(formData, "reservedForPersonId"),
    reservedForTeamId: getStringField(formData, "reservedForTeamId"),
    reservedForEventId: getStringField(formData, "reservedForEventId"),
    programId: getStringField(formData, "programId"),
    quantityRequested: getStringField(formData, "quantityRequested"),
    windowStartAt: getStringField(formData, "windowStartAt"),
    windowEndAt: getStringField(formData, "windowEndAt"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: scope.errorMessage ?? "Unable to create reservation right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = gearReservationWorkflowSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        fieldErrors: {
          status: fieldErrors.status?.[0],
          mode: fieldErrors.mode?.[0],
          purpose: fieldErrors.purpose?.[0],
          holdType: fieldErrors.holdType?.[0],
          reservedForPersonId: fieldErrors.reservedForPersonId?.[0],
          reservedForTeamId: fieldErrors.reservedForTeamId?.[0],
          reservedForEventId: fieldErrors.reservedForEventId?.[0],
          programId: fieldErrors.programId?.[0],
          quantityRequested: fieldErrors.quantityRequested?.[0],
          windowStartAt: fieldErrors.windowStartAt?.[0],
          windowEndAt: fieldErrors.windowEndAt?.[0],
          notes: fieldErrors.notes?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearReservation.create",
    });

    const item = await db.gearItem.findFirst({
      where: { id: itemId, organizationId: organizationId },
      select: {
        id: true,
        inventoryType: true,
        quantityOnHand: true,
        lifecycleStatus: true,
        readinessState: true,
        category: { select: { guardianApprovalRequired: true } },
      },
    });

    if (!item) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, { values, error: "Gear item not found in this organization." }),
        303,
      );
    }

    for (const [kind, value, field] of [
      ["person", parsed.data.reservedForPersonId, "reservedForPersonId"],
      ["team", parsed.data.reservedForTeamId, "reservedForTeamId"],
      ["event", parsed.data.reservedForEventId, "reservedForEventId"],
      ["program", parsed.data.programId, "programId"],
    ] as const) {
      if (value && !(await ensureRecordInOrganization(kind, value, organizationId))) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
            values,
            fieldErrors: { [field]: `The selected ${kind} does not exist in this organization.` },
            error: `${formatGearReservationEnum(kind)} not found in this organization.`,
          }),
          303,
        );
      }
    }

    const requestedByPersonId = await resolveActorPersonId({
      organizationId: organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!requestedByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "No organization person is available for reservation attribution yet.",
        }),
        303,
      );
    }

    const [existingReservations, currentOpenCheckoutCount, currentAssignmentCount] = await Promise.all([
      db.gearReservation.findMany({
        where: {
          organizationId: organizationId,
          gearItemId: itemId,
          status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW, GearReservationStatus.CONFLICT] },
        },
        select: {
          id: true,
          gearItemId: true,
          mode: true,
          status: true,
          approvalStatus: true,
          holdType: true,
          purpose: true,
          quantityRequested: true,
          windowStartAt: true,
          windowEndAt: true,
          reservedForPersonId: true,
          reservedForTeamId: true,
          reservedForEventId: true,
          programId: true,
          conflictSummary: true,
        },
      }),
      db.gearCheckout.count({
        where: { organizationId: organizationId, gearItemId: itemId, status: { in: ["OPEN", "OVERDUE"] } },
      }),
      db.gearAssignment.count({
        where: { organizationId: organizationId, gearItemId: itemId, status: { in: ["PENDING", "ACTIVE", "OVERDUE"] } },
      }),
    ]);

    const approvalRequired =
      item.category.guardianApprovalRequired &&
      Boolean(parsed.data.reservedForPersonId) &&
      parsed.data.mode === GearReservationMode.HARD_RESERVATION;

    const conflicts = evaluateGearReservationConflicts({
      lifecycleStatus: item.lifecycleStatus,
      readinessState: item.readinessState,
      inventoryType: item.inventoryType,
      quantityOnHand: item.quantityOnHand,
      currentOpenCheckoutCount,
      currentAssignmentCount,
      requestedMode: parsed.data.mode,
      requestedHoldType: parsed.data.holdType,
      requestedQuantity: parsed.data.quantityRequested,
      requestedWindowStartAt: parsed.data.windowStartAt,
      requestedWindowEndAt: parsed.data.windowEndAt,
      existingReservations,
      approvalRequired,
    });

    const blockingWithoutApproval = conflicts.some(
      (conflict) => conflict.severity === "blocking" && conflict.code !== "APPROVAL_REQUIRED",
    );

    let status = parsed.data.status;
    if (status !== GearReservationStatus.DRAFT) {
      if (blockingWithoutApproval) {
        status = GearReservationStatus.CONFLICT;
      } else if (approvalRequired || status === GearReservationStatus.PENDING_REVIEW) {
        status = GearReservationStatus.PENDING_REVIEW;
      } else {
        status = GearReservationStatus.ACTIVE;
      }
    }

    const approvalStatus = approvalRequired
      ? status === GearReservationStatus.ACTIVE
        ? ApprovalStatus.APPROVED
        : ApprovalStatus.PENDING
      : ApprovalStatus.NOT_REQUIRED;
    const conflictSummary = conflicts.length > 0 ? conflicts.map((conflict) => conflict.message).join(" ") : null;

    const reservation = await db.$transaction(async (tx) => {
      const createdReservation = await tx.gearReservation.create({
        data: {
          organizationId: organizationId!,
          gearItemId: itemId,
          programId: parsed.data.programId,
          reservedForPersonId: parsed.data.reservedForPersonId,
          reservedForTeamId: parsed.data.reservedForTeamId,
          reservedForEventId: parsed.data.reservedForEventId,
          requestedByPersonId,
          mode: parsed.data.mode,
          holdType: parsed.data.holdType,
          purpose: parsed.data.purpose,
          status,
          approvalStatus,
          quantityRequested: parsed.data.quantityRequested,
          windowStartAt: parsed.data.windowStartAt,
          windowEndAt: parsed.data.windowEndAt,
          notes: parsed.data.notes,
          conflictSummary,
        },
      });

      if (status !== GearReservationStatus.DRAFT) {
        await tx.inventoryMovement.create({
          data: {
            organizationId: organizationId!,
            gearItemId: itemId,
            movementType: InventoryMovementType.RESERVED,
            actorPersonId: requestedByPersonId,
            relatedRecordType: "GEAR_RESERVATION",
            relatedRecordId: createdReservation.id,
            notes: `${formatGearReservationEnum(parsed.data.mode)} · ${formatGearReservationEnum(status)}${conflictSummary ? ` · ${conflictSummary}` : ""}`,
            occurredAt: new Date(),
          },
        });
      }

      return createdReservation;
    });

    const url = new URL(`/gear-ops/items/${itemId}`, request.url);
    url.searchParams.set("reservationSaved", "1");
    url.searchParams.set("reservationId", reservation.id);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating reservations."
            : "Unable to create reservation right now. Please try again.",
      }),
      303,
    );
  }
}

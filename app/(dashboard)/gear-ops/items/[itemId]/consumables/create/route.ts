import { GearInventoryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";
import {
  gearConsumableTransactionWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type ConsumableTransactionFormValues = {
  transactionType: string;
  quantityDelta: string;
  recordedAt: string;
  eventId: string;
  notes: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  input: {
    values: ConsumableTransactionFormValues;
    fieldErrors?: Partial<Record<keyof ConsumableTransactionFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/consumables/new`, requestUrl);

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: ConsumableTransactionFormValues = {
    transactionType: getStringField(formData, "transactionType"),
    quantityDelta: getStringField(formData, "quantityDelta"),
    recordedAt: getStringField(formData, "recordedAt"),
    eventId: getStringField(formData, "eventId"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: scope.errorMessage ?? "Unable to create consumable transaction right now.",
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

  const parsed = gearConsumableTransactionWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        fieldErrors: {
          transactionType: fieldErrors.transactionType?.[0],
          quantityDelta: fieldErrors.quantityDelta?.[0],
          recordedAt: fieldErrors.recordedAt?.[0],
          eventId: fieldErrors.eventId?.[0],
          notes: fieldErrors.notes?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "gearConsumableTransaction.create",
    });

    const item = await db.gearItem.findFirst({
      where: { id: itemId, organizationId: scope.organizationId },
      select: { id: true, inventoryType: true },
    });

    if (!item) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "Gear item not found in this organization.",
        }),
        303,
      );
    }

    if (item.inventoryType !== GearInventoryType.CONSUMABLE) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "Consumable transactions only apply to items marked as CONSUMABLE.",
        }),
        303,
      );
    }

    if (parsed.data.eventId) {
      const event = await db.event.findFirst({
        where: { id: parsed.data.eventId, organizationId: scope.organizationId },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
            values,
            fieldErrors: {
              eventId: "The selected event does not exist in this organization.",
            },
            error: "Event not found in this organization.",
          }),
          303,
        );
      }
    }

    const recordedByPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!recordedByPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "No organization person is available for transaction attribution yet.",
        }),
        303,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.consumableTransaction.create({
        data: {
          organizationId: scope.organizationId!,
          gearItemId: itemId,
          transactionType: parsed.data.transactionType,
          quantityDelta: parsed.data.quantityDelta,
          recordedByPersonId,
          eventId: parsed.data.eventId,
          recordedAt: parsed.data.recordedAt,
          notes: parsed.data.notes,
        },
      });

      await tx.gearItem.update({
        where: { id: itemId },
        data: {
          quantityOnHand: { increment: parsed.data.quantityDelta },
        },
      });
    });

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating consumable transactions."
            : "Unable to create consumable transaction right now. Please try again.",
      }),
      303,
    );
  }
}

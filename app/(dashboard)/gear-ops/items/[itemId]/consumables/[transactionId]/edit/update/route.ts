import { GearInventoryType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
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
  transactionId: string,
  input: {
    values: ConsumableTransactionFormValues;
    fieldErrors?: Partial<Record<keyof ConsumableTransactionFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/consumables/${transactionId}/edit`, requestUrl);

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

class ConsumableTransactionNotFoundError extends Error {
  constructor() {
    super("Consumable transaction not found.");
    this.name = "ConsumableTransactionNotFoundError";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string; transactionId: string }> },
) {
  const { itemId, transactionId } = await params;
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
      buildErrorRedirectUrl(request.url, itemId, transactionId, {
        values,
        error: scope.errorMessage ?? "Unable to update consumable transaction right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, transactionId, {
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
      buildErrorRedirectUrl(request.url, itemId, transactionId, {
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
      action: "gearConsumableTransaction.update",
    });

    const item = await db.gearItem.findFirst({
      where: { id: itemId, organizationId: scope.organizationId },
      select: { id: true, inventoryType: true },
    });

    if (!item) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, transactionId, {
          values,
          error: "Gear item not found in this organization.",
        }),
        303,
      );
    }

    if (item.inventoryType !== GearInventoryType.CONSUMABLE) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, transactionId, {
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
          buildErrorRedirectUrl(request.url, itemId, transactionId, {
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

    await db.$transaction(async (tx) => {
      const existing = await tx.consumableTransaction.findFirst({
        where: {
          id: transactionId,
          gearItemId: itemId,
          organizationId: scope.organizationId!,
        },
        select: { quantityDelta: true },
      });

      if (!existing) {
        throw new ConsumableTransactionNotFoundError();
      }

      const updated = await tx.consumableTransaction.updateMany({
        where: {
          id: transactionId,
          gearItemId: itemId,
          organizationId: scope.organizationId!,
        },
        data: {
          transactionType: parsed.data.transactionType,
          quantityDelta: parsed.data.quantityDelta,
          recordedAt: parsed.data.recordedAt,
          eventId: parsed.data.eventId,
          notes: parsed.data.notes,
        },
      });

      if (updated.count === 0) {
        throw new ConsumableTransactionNotFoundError();
      }

      const deltaAdjustment = parsed.data.quantityDelta - existing.quantityDelta;
      if (deltaAdjustment !== 0) {
        await tx.gearItem.update({
          where: { id: itemId },
          data: {
            quantityOnHand: { increment: deltaAdjustment },
          },
        });
      }
    });

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, transactionId, {
        values,
        error:
          error instanceof ConsumableTransactionNotFoundError
            ? "Consumable transaction not found for this gear item in the selected organization."
            : isPermissionDeniedError(error)
              ? error.message
              : isSchemaUnavailableError(error)
                ? "Database schema is not available yet. Run database setup before editing consumable transactions."
                : "Unable to update consumable transaction right now. Please try again.",
      }),
      303,
    );
  }
}

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearInspectionWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearInspectionFormValues = {
  result: string;
  context: string;
  inspectedByPersonId: string;
  performedAt: string;
  notes: string;
  nextInspectionDueAt: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  input: {
    values: GearInspectionFormValues;
    fieldErrors?: Partial<Record<keyof GearInspectionFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/inspect/new`, requestUrl);

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

/**
 * Derive the GearInspectionDueStatus string to persist after recording an inspection.
 *
 * Rules (Arc 20Y):
 * - Failed result types (FAILED, MAINTENANCE_NEEDED, OUT_OF_SERVICE) → OVERDUE
 *   (forces the item back into an actionable state until re-inspected or serviced)
 * - LIMITED_USE → DUE (needs monitoring, but not blocked)
 * - If a nextInspectionDueAt date was set and it's in the future → CURRENT
 * - Otherwise → CURRENT (freshly inspected)
 */
function deriveInspectionDueStatus(
  result: string,
  nextInspectionDueAt: Date | null,
  now: Date,
): "CURRENT" | "DUE" | "DUE_SOON" | "OVERDUE" | "NOT_SCHEDULED" {
  if (result === "FAILED" || result === "MAINTENANCE_NEEDED" || result === "OUT_OF_SERVICE") {
    return "OVERDUE";
  }

  if (result === "LIMITED_USE") {
    return "DUE";
  }

  if (nextInspectionDueAt) {
    const msUntilDue = nextInspectionDueAt.getTime() - now.getTime();
    const dueSoonMs = 14 * 24 * 60 * 60 * 1000; // default 14 days
    if (msUntilDue < 0) {
      return "OVERDUE";
    }
    if (msUntilDue <= dueSoonMs) {
      return "DUE_SOON";
    }
    return "CURRENT";
  }

  return "CURRENT";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: GearInspectionFormValues = {
    result: getStringField(formData, "result"),
    context: getStringField(formData, "context"),
    inspectedByPersonId: getStringField(formData, "inspectedByPersonId"),
    performedAt: getStringField(formData, "performedAt"),
    notes: getStringField(formData, "notes"),
    nextInspectionDueAt: getStringField(formData, "nextInspectionDueAt"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: scope.errorMessage ?? "Unable to create inspection record right now.",
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

  const parsed = gearInspectionWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        fieldErrors: {
          result: fieldErrors.result?.[0],
          context: fieldErrors.context?.[0],
          inspectedByPersonId: fieldErrors.inspectedByPersonId?.[0],
          performedAt: fieldErrors.performedAt?.[0],
          notes: fieldErrors.notes?.[0],
          nextInspectionDueAt: fieldErrors.nextInspectionDueAt?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearInspection.create",
    });

    const item = await db.gearItem.findFirst({
      where: { id: itemId, organizationId: organizationId },
      select: { id: true, nextInspectionDueAt: true },
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

    const inspector = await db.person.findFirst({
      where: { id: parsed.data.inspectedByPersonId, organizationId: organizationId },
      select: { id: true },
    });

    if (!inspector) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          fieldErrors: {
            inspectedByPersonId: "The selected person does not exist in this organization.",
          },
          error: "Inspected-by person not found in this organization.",
        }),
        303,
      );
    }

    const now = new Date();
    const nextDue = parsed.data.nextInspectionDueAt ?? item.nextInspectionDueAt ?? null;
    const newStatus = deriveInspectionDueStatus(values.result, nextDue, now);

    await db.$transaction([
      db.gearInspectionRecord.create({
        data: {
          organizationId: organizationId,
          gearItemId: itemId,
          inspectedByPersonId: parsed.data.inspectedByPersonId,
          result: parsed.data.result,
          context: parsed.data.context,
          notes: parsed.data.notes,
          performedAt: parsed.data.performedAt,
          nextInspectionDueAt: parsed.data.nextInspectionDueAt,
        },
      }),
      db.gearItem.update({
        where: { id: itemId },
        data: {
          lastInspectedAt: parsed.data.performedAt,
          lastInspectionResult: parsed.data.result,
          inspectionDueStatus: newStatus,
          ...(parsed.data.nextInspectionDueAt !== null
            ? { nextInspectionDueAt: parsed.data.nextInspectionDueAt }
            : {}),
        },
      }),
    ]);

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating inspection records."
            : "Unable to create inspection record right now. Please try again.",
      }),
      303,
    );
  }
}

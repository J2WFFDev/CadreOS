import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearMaintenanceWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearMaintenanceFormValues = {
  maintenanceType: string;
  performedByPersonId: string;
  performedAt: string;
  conditionBefore: string;
  conditionAfter: string;
  notes: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  input: {
    values: GearMaintenanceFormValues;
    fieldErrors?: Partial<Record<keyof GearMaintenanceFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/maintenance/new`, requestUrl);

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

  const values: GearMaintenanceFormValues = {
    maintenanceType: getStringField(formData, "maintenanceType"),
    performedByPersonId: getStringField(formData, "performedByPersonId"),
    performedAt: getStringField(formData, "performedAt"),
    conditionBefore: getStringField(formData, "conditionBefore"),
    conditionAfter: getStringField(formData, "conditionAfter"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: scope.errorMessage ?? "Unable to create maintenance log right now.",
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

  const parsed = gearMaintenanceWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        fieldErrors: {
          maintenanceType: fieldErrors.maintenanceType?.[0],
          performedByPersonId: fieldErrors.performedByPersonId?.[0],
          performedAt: fieldErrors.performedAt?.[0],
          conditionBefore: fieldErrors.conditionBefore?.[0],
          conditionAfter: fieldErrors.conditionAfter?.[0],
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
      action: "gearMaintenance.create",
    });

    const item = await db.gearItem.findFirst({
      where: { id: itemId, organizationId: scope.organizationId },
      select: { id: true },
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

    const performedBy = await db.person.findFirst({
      where: { id: parsed.data.performedByPersonId, organizationId: scope.organizationId },
      select: { id: true },
    });

    if (!performedBy) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          fieldErrors: {
            performedByPersonId: "The selected person does not exist in this organization.",
          },
          error: "Performed-by person not found in this organization.",
        }),
        303,
      );
    }

    await db.gearMaintenanceLog.create({
      data: {
        organizationId: scope.organizationId,
        gearItemId: itemId,
        performedByPersonId: parsed.data.performedByPersonId,
        maintenanceType: parsed.data.maintenanceType,
        performedAt: parsed.data.performedAt,
        conditionBefore: parsed.data.conditionBefore,
        conditionAfter: parsed.data.conditionAfter,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating maintenance logs."
            : "Unable to create maintenance log right now. Please try again.",
      }),
      303,
    );
  }
}

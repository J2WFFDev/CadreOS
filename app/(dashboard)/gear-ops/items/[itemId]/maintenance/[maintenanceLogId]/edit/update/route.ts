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
  maintenanceLogId: string,
  input: {
    values: GearMaintenanceFormValues;
    fieldErrors?: Partial<Record<keyof GearMaintenanceFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/maintenance/${maintenanceLogId}/edit`, requestUrl);

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
  { params }: { params: Promise<{ itemId: string; maintenanceLogId: string }> },
) {
  const { itemId, maintenanceLogId } = await params;
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
      buildErrorRedirectUrl(request.url, itemId, maintenanceLogId, {
        values,
        error: scope.errorMessage ?? "Unable to update maintenance log right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, maintenanceLogId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = gearMaintenanceWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, maintenanceLogId, {
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
      organizationId: organizationId,
      action: "gearMaintenance.update",
    });

    const performedBy = await db.person.findFirst({
      where: { id: parsed.data.performedByPersonId, organizationId: organizationId },
      select: { id: true },
    });

    if (!performedBy) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, maintenanceLogId, {
          values,
          fieldErrors: {
            performedByPersonId: "The selected person does not exist in this organization.",
          },
          error: "Performed-by person not found in this organization.",
        }),
        303,
      );
    }

    const updated = await db.gearMaintenanceLog.updateMany({
      where: {
        id: maintenanceLogId,
        gearItemId: itemId,
        organizationId: organizationId,
      },
      data: {
        maintenanceType: parsed.data.maintenanceType,
        performedByPersonId: parsed.data.performedByPersonId,
        performedAt: parsed.data.performedAt,
        conditionBefore: parsed.data.conditionBefore,
        conditionAfter: parsed.data.conditionAfter,
        notes: parsed.data.notes,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, maintenanceLogId, {
          values,
          error: "Maintenance log not found for this gear item in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, maintenanceLogId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing maintenance logs."
            : "Unable to update maintenance log right now. Please try again.",
      }),
      303,
    );
  }
}

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { validateAssetIdFormat } from "@/lib/gear-asset-id";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearItemWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearItemFormValues = {
  name: string;
  gearCategoryId: string;
  inventoryType: string;
  programId: string;
  assetId: string;
  sku: string;
  serialNumber: string;
  barcodeValue: string;
  quantityOnHand: string;
  quantityMin: string;
  lifecycleStatus: string;
  conditionStatus: string;
  notes: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  input: {
    values: GearItemFormValues;
    fieldErrors?: Partial<Record<keyof GearItemFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/edit`, requestUrl);

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

  const values: GearItemFormValues = {
    name: getStringField(formData, "name"),
    gearCategoryId: getStringField(formData, "gearCategoryId"),
    inventoryType: getStringField(formData, "inventoryType"),
    programId: getStringField(formData, "programId"),
    assetId: getStringField(formData, "assetId"),
    sku: getStringField(formData, "sku"),
    serialNumber: getStringField(formData, "serialNumber"),
    barcodeValue: getStringField(formData, "barcodeValue"),
    quantityOnHand: getStringField(formData, "quantityOnHand"),
    quantityMin: getStringField(formData, "quantityMin"),
    lifecycleStatus: getStringField(formData, "lifecycleStatus"),
    conditionStatus: getStringField(formData, "conditionStatus"),
    notes: getStringField(formData, "notes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: scope.errorMessage ?? "Unable to update gear item right now.",
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

  // Validate optional admin-supplied Asset ID format before schema validation.
  const assetIdFormatError = validateAssetIdFormat(values.assetId);
  if (assetIdFormatError) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        fieldErrors: { assetId: assetIdFormatError } as Partial<Record<keyof GearItemFormValues, string>>,
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  const parsed = gearItemWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        fieldErrors: {
          name: fieldErrors.name?.[0],
          gearCategoryId: fieldErrors.gearCategoryId?.[0],
          inventoryType: fieldErrors.inventoryType?.[0],
          sku: fieldErrors.sku?.[0],
          serialNumber: fieldErrors.serialNumber?.[0],
          barcodeValue: fieldErrors.barcodeValue?.[0],
          quantityOnHand: fieldErrors.quantityOnHand?.[0],
          quantityMin: fieldErrors.quantityMin?.[0],
          lifecycleStatus: fieldErrors.lifecycleStatus?.[0],
          conditionStatus: fieldErrors.conditionStatus?.[0],
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
      action: "gearItem.update",
    });

    // Verify category belongs to this organization (cross-org reference guard)
    const category = await db.gearCategory.findFirst({
      where: {
        id: parsed.data.gearCategoryId,
        organizationId: organizationId,
      },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          fieldErrors: {
            gearCategoryId: "The selected category does not exist in this organization.",
          },
          error: "Category not found in this organization.",
        }),
        303,
      );
    }

    // Verify program belongs to this organization if provided (cross-org reference guard)
    if (parsed.data.programId) {
      const program = await db.program.findFirst({
        where: {
          id: parsed.data.programId,
          organizationId: organizationId,
        },
        select: { id: true },
      });

      if (!program) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
            values,
            fieldErrors: {
              programId: "The selected program does not exist in this organization.",
            },
            error: "Program not found in this organization.",
          }),
          303,
        );
      }
    }

    const updated = await db.gearItem.updateMany({
      where: {
        id: itemId,
        organizationId: organizationId,
      },
      data: {
        name: parsed.data.name,
        gearCategoryId: parsed.data.gearCategoryId,
        inventoryType: parsed.data.inventoryType,
        programId: parsed.data.programId,
        // Only update assetId when the admin explicitly supplies one; leave existing value
        // unchanged if the field was submitted empty (empty string = no change).
        ...(values.assetId.trim() ? { assetId: values.assetId.trim().toUpperCase() } : {}),
        sku: parsed.data.sku,
        serialNumber: parsed.data.serialNumber,
        barcodeValue: parsed.data.barcodeValue,
        quantityOnHand: parsed.data.quantityOnHand,
        quantityMin: parsed.data.quantityMin,
        lifecycleStatus: parsed.data.lifecycleStatus,
        conditionStatus: parsed.data.conditionStatus,
        notes: parsed.data.notes,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          error: "Gear item not found in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      const isAssetIdConflict = target.some((f) => f === "assetId");
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, {
          values,
          fieldErrors: {
            ...(isAssetIdConflict
              ? { assetId: "A gear item with this Asset ID already exists in this organization." }
              : { serialNumber: "A gear item with this serial number already exists in this organization." }),
          },
          error: isAssetIdConflict
            ? "Asset ID already exists in this organization."
            : "Serial number already exists in this organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing gear items."
            : "Unable to update gear item right now. Please try again.",
      }),
      303,
    );
  }
}

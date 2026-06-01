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
  manufacturer: string;
  model: string;
  assetId: string;
  sku: string;
  serialNumber: string;
  barcodeValue: string;
  qrCodeValue: string;
  quantityOnHand: string;
  unitType: string;
  quantityMin: string;
  lifecycleStatus: string;
  conditionStatus: string;
  inventoryCondition: string;
  locationId: string;
  storageLocationText: string;
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
    manufacturer: getStringField(formData, "manufacturer"),
    model: getStringField(formData, "model"),
    assetId: getStringField(formData, "assetId"),
    sku: getStringField(formData, "sku"),
    serialNumber: getStringField(formData, "serialNumber"),
    barcodeValue: getStringField(formData, "barcodeValue"),
    qrCodeValue: getStringField(formData, "qrCodeValue"),
    quantityOnHand: getStringField(formData, "quantityOnHand"),
    unitType: getStringField(formData, "unitType"),
    quantityMin: getStringField(formData, "quantityMin"),
    lifecycleStatus: getStringField(formData, "lifecycleStatus"),
    conditionStatus: getStringField(formData, "conditionStatus"),
    inventoryCondition: getStringField(formData, "inventoryCondition"),
    locationId: getStringField(formData, "locationId"),
    storageLocationText: getStringField(formData, "storageLocationText"),
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
          manufacturer: fieldErrors.manufacturer?.[0],
          model: fieldErrors.model?.[0],
          sku: fieldErrors.sku?.[0],
          serialNumber: fieldErrors.serialNumber?.[0],
          barcodeValue: fieldErrors.barcodeValue?.[0],
          qrCodeValue: fieldErrors.qrCodeValue?.[0],
          quantityOnHand: fieldErrors.quantityOnHand?.[0],
          unitType: fieldErrors.unitType?.[0],
          quantityMin: fieldErrors.quantityMin?.[0],
          lifecycleStatus: fieldErrors.lifecycleStatus?.[0],
          conditionStatus: fieldErrors.conditionStatus?.[0],
          inventoryCondition: fieldErrors.inventoryCondition?.[0],
          locationId: fieldErrors.locationId?.[0],
          storageLocationText: fieldErrors.storageLocationText?.[0],
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

    if (parsed.data.locationId) {
      const location = await db.inventoryLocation.findFirst({
        where: {
          id: parsed.data.locationId,
          organizationId: organizationId,
        },
        select: { id: true },
      });

      if (!location) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, {
            values,
            fieldErrors: {
              locationId: "The selected location does not exist in this organization.",
            },
            error: "Location not found in this organization.",
          }),
          303,
        );
      }
    }

    const suppliedAssetId = values.assetId.trim().toUpperCase();
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
        manufacturer: parsed.data.manufacturer,
        model: parsed.data.model,
        // Only update assetId when the admin explicitly supplies one; leave existing value
        // unchanged if the field was submitted empty (empty string = no change).
        ...(suppliedAssetId ? { assetId: suppliedAssetId } : {}),
        sku: parsed.data.sku,
        serialNumber: parsed.data.serialNumber,
        barcodeValue: parsed.data.barcodeValue,
        qrCodeValue: parsed.data.qrCodeValue,
        quantityOnHand: parsed.data.quantityOnHand,
        unitType: parsed.data.unitType,
        quantityMin: parsed.data.quantityMin,
        lifecycleStatus: parsed.data.lifecycleStatus,
        conditionStatus: parsed.data.conditionStatus,
        inventoryCondition: parsed.data.inventoryCondition,
        locationId: parsed.data.locationId,
        storageLocationText: parsed.data.storageLocationText,
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

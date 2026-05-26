import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
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
  redirectBase: string,
  input: {
    values: GearItemFormValues;
    fieldErrors?: Partial<Record<keyof GearItemFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(redirectBase, requestUrl);

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

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: GearItemFormValues = {
    name: getStringField(formData, "name"),
    gearCategoryId: getStringField(formData, "gearCategoryId"),
    inventoryType: getStringField(formData, "inventoryType"),
    programId: getStringField(formData, "programId"),
    sku: getStringField(formData, "sku"),
    serialNumber: getStringField(formData, "serialNumber"),
    barcodeValue: getStringField(formData, "barcodeValue"),
    quantityOnHand: getStringField(formData, "quantityOnHand"),
    quantityMin: getStringField(formData, "quantityMin"),
    lifecycleStatus: getStringField(formData, "lifecycleStatus"),
    conditionStatus: getStringField(formData, "conditionStatus"),
    notes: getStringField(formData, "notes"),
  };

  const redirectBase = "/gear-ops/items/new";

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, redirectBase, {
        values,
        error: scope.errorMessage ?? "Unable to create gear item right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, redirectBase, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = gearItemWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, redirectBase, {
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
      organizationId: scope.organizationId,
      action: "gearItem.create",
    });

    // Verify category belongs to this organization (cross-org reference guard)
    const category = await db.gearCategory.findFirst({
      where: {
        id: parsed.data.gearCategoryId,
        organizationId: scope.organizationId,
      },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, redirectBase, {
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
          organizationId: scope.organizationId,
        },
        select: { id: true },
      });

      if (!program) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, redirectBase, {
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

    const created = await db.gearItem.create({
      data: {
        organizationId: scope.organizationId,
        name: parsed.data.name,
        gearCategoryId: parsed.data.gearCategoryId,
        inventoryType: parsed.data.inventoryType,
        programId: parsed.data.programId,
        sku: parsed.data.sku,
        serialNumber: parsed.data.serialNumber,
        barcodeValue: parsed.data.barcodeValue,
        quantityOnHand: parsed.data.quantityOnHand,
        quantityMin: parsed.data.quantityMin,
        lifecycleStatus: parsed.data.lifecycleStatus,
        conditionStatus: parsed.data.conditionStatus,
        notes: parsed.data.notes,
      },
      select: { id: true },
    });

    return NextResponse.redirect(new URL(`/gear-ops/items/${created.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, redirectBase, {
          values,
          fieldErrors: {
            serialNumber: "A gear item with this serial number already exists in this organization.",
          },
          error: "Serial number already exists in this organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, redirectBase, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating gear items."
            : "Unable to create gear item right now. Please try again.",
      }),
      303,
    );
  }
}

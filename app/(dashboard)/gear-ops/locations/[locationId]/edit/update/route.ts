import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { updateInventoryLocation, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { validateInventoryLocationFields } from "@/lib/inventory-ops/location-validation";
import { getOrganizationScope } from "@/lib/organization-context";

type EditLocationFormValues = {
  name: string;
  locationCode: string;
  description: string;
  isActive: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  locationId: string,
  input: {
    values: EditLocationFormValues;
    fieldErrors?: Partial<Record<keyof EditLocationFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/locations/${locationId}/edit`, requestUrl);

  url.searchParams.set("name", input.values.name);
  url.searchParams.set("locationCode", input.values.locationCode);
  url.searchParams.set("description", input.values.description);
  url.searchParams.set("isActive", input.values.isActive);

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
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const values: EditLocationFormValues = {
    name: (formData.get("name") as string | null)?.trim() ?? "",
    locationCode: (formData.get("locationCode") as string | null)?.trim() ?? "",
    description: (formData.get("description") as string | null)?.trim() ?? "",
    isActive: ((formData.get("isActive") as string | null) ?? "true").trim(),
  };

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, locationId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const access = await resolveInventoryOpsWriteAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.locations.update",
  });

  if (!access.allowed) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, locationId, {
        values,
        error: access.denialMessage ?? "Access denied.",
      }),
      303,
    );
  }

  const validationErrors = validateInventoryLocationFields(values);
  const fieldErrors: Partial<Record<keyof EditLocationFormValues, string>> = {
    ...validationErrors,
  };
  if (values.isActive !== "true" && values.isActive !== "false") {
    fieldErrors.isActive = "Status must be Active or Inactive.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, locationId, {
        values,
        fieldErrors,
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  const duplicateWhere: Prisma.InventoryLocationWhereInput = {
    organizationId,
    id: { not: locationId },
    OR: [{ name: { equals: values.name, mode: "insensitive" } }],
  };
  if (values.locationCode) {
    duplicateWhere.OR?.push({
      locationCode: { equals: values.locationCode, mode: "insensitive" },
    });
  }

  const duplicateLocation = await db.inventoryLocation.findFirst({
    where: duplicateWhere,
    select: { id: true, name: true, locationCode: true },
  });

  if (duplicateLocation) {
    const codeToCheck = values.locationCode || null;
    const isCodeConflict =
      codeToCheck !== null &&
      duplicateLocation.locationCode !== null &&
      duplicateLocation.locationCode.localeCompare(codeToCheck, undefined, {
        sensitivity: "accent",
      }) === 0;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, locationId, {
        values,
        fieldErrors: isCodeConflict
          ? { locationCode: "A location with this code already exists in this organization." }
          : { name: "A location with this name already exists in this organization." },
        error: isCodeConflict
          ? "Location code already exists in this organization."
          : "Location name already exists in this organization.",
      }),
      303,
    );
  }

  try {
    const updated = await updateInventoryLocation({
      organizationId,
      locationId,
      name: values.name,
      locationCode: values.locationCode || null,
      description: values.description || null,
      isActive: values.isActive === "true",
    });

    if (!updated) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, locationId, {
          values,
          error: "Location not found in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/gear-ops/locations/${locationId}`, request.url), 303);
  } catch {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, locationId, {
        values,
        error: "Unable to update location right now. Please try again.",
      }),
      303,
    );
  }
}

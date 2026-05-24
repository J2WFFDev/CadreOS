import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearCategoryWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(
  requestUrl: string,
  categoryId: string,
  input: {
    values: { name: string; inventoryType: string; description: string };
    fieldErrors?: Partial<Record<"name" | "inventoryType" | "description", string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/categories/${categoryId}/edit`, requestUrl);

  url.searchParams.set("name", input.values.name);
  url.searchParams.set("inventoryType", input.values.inventoryType);
  url.searchParams.set("description", input.values.description);

  if (input.fieldErrors?.name) {
    url.searchParams.set("nameError", input.fieldErrors.name);
  }
  if (input.fieldErrors?.inventoryType) {
    url.searchParams.set("inventoryTypeError", input.fieldErrors.inventoryType);
  }
  if (input.fieldErrors?.description) {
    url.searchParams.set("descriptionError", input.fieldErrors.description);
  }
  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    name: getStringField(formData, "name"),
    inventoryType: getStringField(formData, "inventoryType"),
    description: getStringField(formData, "description"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, categoryId, {
        values,
        error: scope.errorMessage ?? "Unable to update gear category right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, categoryId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = gearCategoryWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, categoryId, {
        values,
        fieldErrors: {
          name: fieldErrors.name?.[0],
          inventoryType: fieldErrors.inventoryType?.[0],
          description: fieldErrors.description?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "gearCategory.update",
    });

    const updated = await db.gearCategory.updateMany({
      where: {
        id: categoryId,
        organizationId: scope.organizationId,
      },
      data: {
        name: parsed.data.name,
        inventoryType: parsed.data.inventoryType,
        description: parsed.data.description,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, categoryId, {
          values,
          error: "Gear category not found in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/gear-ops/categories/${categoryId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, categoryId, {
          values,
          fieldErrors: {
            name: "A category with this name already exists in this organization.",
          },
          error: "Category name already exists in this organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, categoryId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing gear categories."
            : "Unable to update gear category right now. Please try again.",
      }),
      303,
    );
  }
}

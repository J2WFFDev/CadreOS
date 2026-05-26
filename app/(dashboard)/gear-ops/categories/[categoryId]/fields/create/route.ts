import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearCategoryFieldWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, categoryId: string, key: string, value: string) {
  const url = new URL(`/gear-ops/categories/${categoryId}`, requestUrl);
  url.searchParams.set(key, value);
  return url;
}

function normalizeFieldOptions(fieldType: string, fieldOptions: string | null) {
  if (fieldType !== "select" || !fieldOptions) {
    return null;
  }

  const options = fieldOptions
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);

  return JSON.stringify(options);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    fieldKey: getStringField(formData, "fieldKey"),
    fieldLabel: getStringField(formData, "fieldLabel"),
    fieldType: getStringField(formData, "fieldType"),
    fieldOptions: getStringField(formData, "fieldOptions"),
    required: getStringField(formData, "required"),
    displayOrder: getStringField(formData, "displayOrder"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, categoryId, "fieldError", scope.errorMessage ?? "Unable to add the custom field right now."),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(buildRedirectUrl(request.url, categoryId, "fieldError", "No organization context is available yet."), 303);
  }

  const parsed = gearCategoryFieldWorkflowSchema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        categoryId,
        "fieldError",
        parsed.error.flatten().formErrors[0] ??
          parsed.error.issues[0]?.message ??
          "Invalid field configuration. Check the field key, type, and select options.",
      ),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "gearCategoryField.create",
    });

    const category = await db.gearCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: scope.organizationId,
      },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, categoryId, "fieldError", "Gear category not found in this organization."),
        303,
      );
    }

    await db.gearCategoryField.create({
      data: {
        organizationId: scope.organizationId,
        categoryId,
        fieldKey: parsed.data.fieldKey,
        fieldLabel: parsed.data.fieldLabel,
        fieldType: parsed.data.fieldType,
        fieldOptions: normalizeFieldOptions(parsed.data.fieldType, parsed.data.fieldOptions),
        required: parsed.data.required,
        displayOrder: parsed.data.displayOrder,
      },
    });

    return NextResponse.redirect(buildRedirectUrl(request.url, categoryId, "fieldSaved", "1"), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, categoryId, "fieldError", "A field with this key already exists for the category."),
        303,
      );
    }

    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        categoryId,
        "fieldError",
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before adding category fields."
            : "Unable to add the custom field right now. Please try again.",
      ),
      303,
    );
  }
}

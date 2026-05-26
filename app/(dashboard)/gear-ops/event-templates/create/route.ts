import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  eventGearRequirementTemplateWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type EventTemplateFormValues = {
  name: string;
  label: string;
  gearCategoryId: string;
  requirementType: string;
  quantityNeeded: string;
  notes: string;
  description: string;
  isActive: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  redirectBase: string,
  input: {
    values: EventTemplateFormValues;
    fieldErrors?: Partial<Record<string, string>>;
    error?: string;
  },
) {
  const url = new URL(redirectBase, requestUrl);

  Object.entries(input.values).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (input.fieldErrors) {
    Object.entries(input.fieldErrors).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(`${key}Error`, value);
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

  const values: EventTemplateFormValues = {
    name: getStringField(formData, "name"),
    label: getStringField(formData, "label"),
    gearCategoryId: getStringField(formData, "gearCategoryId"),
    requirementType: getStringField(formData, "requirementType"),
    quantityNeeded: getStringField(formData, "quantityNeeded"),
    notes: getStringField(formData, "notes"),
    description: getStringField(formData, "description"),
    isActive: getStringField(formData, "isActive"),
  };

  const redirectBase = "/gear-ops/event-templates/new";

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, redirectBase, {
        values,
        error: scope.errorMessage ?? "Unable to create the event template right now.",
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
  const organizationId = scope.organizationId;

  const parsed = eventGearRequirementTemplateWorkflowSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [key, value?.[0] ?? ""]),
    );

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, redirectBase, {
        values,
        fieldErrors,
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "eventGearRequirementTemplate.create",
    });

    if (parsed.data.gearCategoryId) {
      const category = await db.gearCategory.findFirst({
        where: {
          id: parsed.data.gearCategoryId,
          organizationId: organizationId,
        },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, redirectBase, {
            values,
            fieldErrors: { gearCategoryId: "The selected category does not exist in this organization." },
            error: "Category not found in this organization.",
          }),
          303,
        );
      }
    }

    await db.eventGearRequirementTemplate.create({
      data: {
        organizationId: organizationId,
        name: parsed.data.name,
        label: parsed.data.label,
        gearCategoryId: parsed.data.gearCategoryId,
        requirementType: parsed.data.requirementType,
        quantityNeeded: parsed.data.quantityNeeded,
        notes: parsed.data.notes,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
      },
    });

    const successUrl = new URL("/gear-ops/event-templates", request.url);
    successUrl.searchParams.set("saved", "1");
    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, redirectBase, {
          values,
          fieldErrors: { name: "A template with this name already exists in this organization." },
          error: "Template name already exists in this organization.",
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
            ? "Database schema is not available yet. Run database setup before creating event templates."
            : "Unable to create the event template right now. Please try again.",
      }),
      303,
    );
  }
}

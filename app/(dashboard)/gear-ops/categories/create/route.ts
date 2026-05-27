import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getGearCategoryTemplate } from "@/lib/gear-category-config";
import {
  buildGearOpsSchemaUnavailableMessage,
  getGearOpsSchemaStatus,
} from "@/lib/gear-ops-schema-status";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearCategoryWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearCategoryFormValues = {
  name: string;
  inventoryType: string;
  description: string;
  behaviorType: string;
  custodyMode: string;
  primaryIdentifierType: string;
  reportGroup: string;
  reportLabel: string;
  requiresReturnInspection: string;
  requiresMaintenanceTracking: string;
  maintenanceFrequency: string;
  maintenanceIntervalDays: string;
  supportsConsumableTracking: string;
  consumableLowStockDefault: string;
  supportsEventDeployment: string;
  isKitContainer: string;
  guardianApprovalRequired: string;
  templateSlug: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  input: {
    values: { name: string; inventoryType: string; description: string };
    fieldErrors?: Partial<Record<string, string>>;
    error?: string;
    missingTables?: string[];
    missingColumns?: string[];
  },
) {
  const url = new URL("/gear-ops/categories/new", requestUrl);

  url.searchParams.set("name", input.values.name);
  url.searchParams.set("inventoryType", input.values.inventoryType);
  url.searchParams.set("description", input.values.description);

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

  if (input.missingTables && input.missingTables.length > 0) {
    url.searchParams.set("missingTables", input.missingTables.join(","));
  }

  if (input.missingColumns && input.missingColumns.length > 0) {
    url.searchParams.set("missingColumns", input.missingColumns.join(","));
  }

  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: GearCategoryFormValues = {
    name: getStringField(formData, "name"),
    inventoryType: getStringField(formData, "inventoryType"),
    description: getStringField(formData, "description"),
    behaviorType: getStringField(formData, "behaviorType"),
    custodyMode: getStringField(formData, "custodyMode"),
    primaryIdentifierType: getStringField(formData, "primaryIdentifierType"),
    reportGroup: getStringField(formData, "reportGroup"),
    reportLabel: getStringField(formData, "reportLabel"),
    requiresReturnInspection: getStringField(formData, "requiresReturnInspection"),
    requiresMaintenanceTracking: getStringField(formData, "requiresMaintenanceTracking"),
    maintenanceFrequency: getStringField(formData, "maintenanceFrequency"),
    maintenanceIntervalDays: getStringField(formData, "maintenanceIntervalDays"),
    supportsConsumableTracking: getStringField(formData, "supportsConsumableTracking"),
    consumableLowStockDefault: getStringField(formData, "consumableLowStockDefault"),
    supportsEventDeployment: getStringField(formData, "supportsEventDeployment"),
    isKitContainer: getStringField(formData, "isKitContainer"),
    guardianApprovalRequired: getStringField(formData, "guardianApprovalRequired"),
    templateSlug: getStringField(formData, "templateSlug"),
  };

  const basicValues = {
    name: values.name,
    inventoryType: values.inventoryType,
    description: values.description,
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values: basicValues,
        error: scope.errorMessage ?? "Unable to create gear category right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values: basicValues,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const schemaStatus = await getGearOpsSchemaStatus("category-creation");
  if (!schemaStatus.schemaReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values: basicValues,
        error: buildGearOpsSchemaUnavailableMessage(schemaStatus, "Run database setup before creating gear categories."),
        missingTables: schemaStatus.missingTables,
        missingColumns: schemaStatus.missingColumns,
      }),
      303,
    );
  }

  const parsed = gearCategoryWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const flatErrors = Object.fromEntries(
      Object.entries(fieldErrors).map(([key, message]) => [key, message?.[0] ?? ""]),
    );

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values: basicValues,
        fieldErrors: flatErrors,
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  if (parsed.data.templateSlug && !getGearCategoryTemplate(parsed.data.templateSlug)) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values: basicValues,
        fieldErrors: { templateSlug: "Selected starter template is no longer available." },
        error: "Please choose a valid starter template.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearCategory.create",
    });

    const created = await db.gearCategory.create({
      data: {
        organizationId: organizationId,
        name: parsed.data.name,
        inventoryType: parsed.data.inventoryType,
        description: parsed.data.description,
        templateSlug: parsed.data.templateSlug,
        behaviorType: parsed.data.behaviorType,
        custodyMode: parsed.data.custodyMode,
        requiresReturnInspection: parsed.data.requiresReturnInspection,
        requiresMaintenanceTracking: parsed.data.requiresMaintenanceTracking,
        maintenanceFrequency: parsed.data.maintenanceFrequency,
        maintenanceIntervalDays: parsed.data.maintenanceIntervalDays,
        primaryIdentifierType: parsed.data.primaryIdentifierType,
        supportsConsumableTracking: parsed.data.supportsConsumableTracking,
        consumableLowStockDefault: parsed.data.consumableLowStockDefault,
        supportsEventDeployment: parsed.data.supportsEventDeployment,
        reportGroup: parsed.data.reportGroup,
        reportLabel: parsed.data.reportLabel,
        isKitContainer: parsed.data.isKitContainer,
        guardianApprovalRequired: parsed.data.guardianApprovalRequired,
      },
      select: { id: true },
    });

    return NextResponse.redirect(new URL(`/gear-ops/categories/${created.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values: basicValues,
          fieldErrors: {
            name: "A category with this name already exists in this organization.",
          },
          error: "Category name already exists in this organization.",
        }),
        303,
      );
    }

    const categorySchemaMissing = isSchemaUnavailableError(error) && !schemaStatus.schemaReady;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values: basicValues,
        error: isPermissionDeniedError(error)
          ? error.message
          : categorySchemaMissing
            ? buildGearOpsSchemaUnavailableMessage(schemaStatus, "Run database setup before creating gear categories.")
            : "Unable to create gear category right now. Please try again.",
        missingTables: categorySchemaMissing ? schemaStatus.missingTables : undefined,
        missingColumns: categorySchemaMissing ? schemaStatus.missingColumns : undefined,
      }),
      303,
    );
  }
}

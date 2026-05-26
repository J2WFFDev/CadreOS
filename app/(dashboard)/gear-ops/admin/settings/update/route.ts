import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearOpsOrganizationSettingsWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, key?: string, value?: string) {
  const url = new URL("/gear-ops/admin", requestUrl);
  if (key && value) {
    url.searchParams.set(key, value);
  }
  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    defaultCustodyMode: getStringField(formData, "defaultCustodyMode"),
    enableGuardianApproval: getStringField(formData, "enableGuardianApproval"),
    enableConsumableTracking: getStringField(formData, "enableConsumableTracking"),
    enableEventDeployment: getStringField(formData, "enableEventDeployment"),
    enableReadinessTracking: getStringField(formData, "enableReadinessTracking"),
    enableMaintenanceTracking: getStringField(formData, "enableMaintenanceTracking"),
    defaultReportGroup: getStringField(formData, "defaultReportGroup"),
    adminNotes: getStringField(formData, "adminNotes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, "error", scope.errorMessage ?? "Unable to update GearOps admin settings right now."),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "error", "No organization context is available yet."), 303);
  }

  const access = await resolveGearOpsAdminAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!access.allowed) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "error", access.denialMessage ?? "Organization admin access is required."), 303);
  }

  const parsed = gearOpsOrganizationSettingsWorkflowSchema.safeParse(values);
  if (!parsed.success) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        "error",
        parsed.error.flatten().formErrors[0] ?? parsed.error.issues[0]?.message ?? "Please review the admin settings.",
      ),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "gearOpsSettings.update",
    });

    await db.gearOpsOrganizationSettings.upsert({
      where: { organizationId: scope.organizationId },
      update: {
        defaultCustodyMode: parsed.data.defaultCustodyMode,
        enableGuardianApproval: parsed.data.enableGuardianApproval,
        enableConsumableTracking: parsed.data.enableConsumableTracking,
        enableEventDeployment: parsed.data.enableEventDeployment,
        enableReadinessTracking: parsed.data.enableReadinessTracking,
        enableMaintenanceTracking: parsed.data.enableMaintenanceTracking,
        defaultReportGroup: parsed.data.defaultReportGroup,
        adminNotes: parsed.data.adminNotes,
      },
      create: {
        organizationId: scope.organizationId,
        defaultCustodyMode: parsed.data.defaultCustodyMode,
        enableGuardianApproval: parsed.data.enableGuardianApproval,
        enableConsumableTracking: parsed.data.enableConsumableTracking,
        enableEventDeployment: parsed.data.enableEventDeployment,
        enableReadinessTracking: parsed.data.enableReadinessTracking,
        enableMaintenanceTracking: parsed.data.enableMaintenanceTracking,
        defaultReportGroup: parsed.data.defaultReportGroup,
        adminNotes: parsed.data.adminNotes,
      },
    });

    return NextResponse.redirect(buildRedirectUrl(request.url, "saved", "1"), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        "error",
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before updating GearOps admin settings."
            : "Unable to update GearOps admin settings right now. Please try again.",
      ),
      303,
    );
  }
}

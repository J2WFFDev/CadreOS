import { NextResponse } from "next/server";

import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import {
  GEAR_OPS_ALL_SCOPES,
  getGearOpsSchemaStatus,
} from "@/lib/gear-ops-schema-status";
import { getGearOpsItemsReadiness } from "@/lib/gear-ops-items-diagnostics";
import { getOrganizationScope } from "@/lib/organization-context";

export async function GET() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return NextResponse.json(
      { error: scope.errorMessage ?? "Database connection is not available." },
      { status: 503 },
    );
  }

  if (!scope.organizationId) {
    return NextResponse.json({ error: "No organization context is available." }, { status: 400 });
  }

  const access = await resolveGearOpsAdminAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.denialMessage ?? "Organization admin access is required." },
      { status: 403 },
    );
  }

  const [results, itemsReadiness] = await Promise.all([
    Promise.all(GEAR_OPS_ALL_SCOPES.map((s) => getGearOpsSchemaStatus(s))),
    getGearOpsItemsReadiness({
      organizationId: scope.organizationId,
      route: "/api/gear-ops/schema-diagnostics",
    }),
  ]);

  const statusByKey = new Map(itemsReadiness.statuses.map((status) => [status.key, status]));
  const diagnosticCodes = itemsReadiness.statuses
    .map((status) => status.diagnostic?.code ?? null)
    .filter((code): code is string => Boolean(code));

  return NextResponse.json({
    diagnostics: results,
    gearOpsItemsSummary: {
      baseSchemaAvailable: itemsReadiness.baseSchemaAvailable,
      itemLoadAvailable: itemsReadiness.itemsLoadAvailable,
      categoriesAvailable: statusByKey.get("categories")?.available ?? false,
      templatesAvailable: statusByKey.get("templates")?.available ?? false,
      custodyAvailable: statusByKey.get("custody")?.available ?? false,
      locationsAvailable: statusByKey.get("locations")?.available ?? false,
      auditAvailable: statusByKey.get("audit")?.available ?? false,
      diagnosticCodes,
    },
  });
}

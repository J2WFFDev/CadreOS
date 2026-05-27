import { NextResponse } from "next/server";

import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import {
  GEAR_OPS_ALL_SCOPES,
  getGearOpsSchemaStatus,
} from "@/lib/gear-ops-schema-status";
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

  const results = await Promise.all(GEAR_OPS_ALL_SCOPES.map((s) => getGearOpsSchemaStatus(s)));

  return NextResponse.json({ diagnostics: results });
}

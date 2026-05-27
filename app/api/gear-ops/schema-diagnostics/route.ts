import { NextResponse } from "next/server";

import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import {
  getGearOpsSchemaStatus,
  type GearOpsSchemaScope,
} from "@/lib/gear-ops-schema-status";
import { getOrganizationScope } from "@/lib/organization-context";

const ALL_SCOPES: GearOpsSchemaScope[] = [
  "core",
  "category-creation",
  "item-creation",
  "kits",
  "reports",
  "event-templates",
  "audits",
  "admin",
];

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

  const results = await Promise.all(ALL_SCOPES.map((s) => getGearOpsSchemaStatus(s)));

  return NextResponse.json({ diagnostics: results });
}

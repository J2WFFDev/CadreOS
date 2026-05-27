import { NextResponse } from "next/server";

import {
  getGearOpsSchemaStatus,
  isGearOpsSchemaScope,
  type GearOpsSchemaScope,
} from "@/lib/gear-ops-schema-status";
import { getOrganizationScope } from "@/lib/organization-context";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope");
  const scope: GearOpsSchemaScope = isGearOpsSchemaScope(requestedScope) ? requestedScope : "core";
  const [status, organizationScope] = await Promise.all([
    getGearOpsSchemaStatus(scope),
    getOrganizationScope(),
  ]);

  return NextResponse.json({
    ...status,
    organizationContext:
      organizationScope.databaseReady && organizationScope.organizationId
        ? {
            organizationId: organizationScope.organizationId,
            organizationName: organizationScope.organizationName ?? null,
          }
        : null,
  });
}

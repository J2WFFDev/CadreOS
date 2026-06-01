import { NextResponse } from "next/server";

import { returnGearItemToService } from "@/lib/gear-ops-workflows";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePhase1CMutationPermission } from "@/lib/workflows";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/gear-ops/items/${itemId}`);

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  await requirePhase1CMutationPermission({
    organizationId: scope.organizationId,
    action: "gearMaintenance.create",
  });

  await returnGearItemToService({
    organizationId: scope.organizationId,
    itemId,
    actorPersonId: scope.auth.personId,
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

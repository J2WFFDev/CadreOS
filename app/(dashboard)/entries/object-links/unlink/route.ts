import { NextResponse } from "next/server";

import { defaultRelationshipTypeForEntryObjectTarget, isEntryObjectLinkTargetType } from "@/lib/entries/object-links";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { mapEntryObjectLinkTargetToGraphNodeType, unlinkOperationalRecords } from "@/lib/operational-graph";
import { unlinkEntryFromObject } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const entryId = String(formData.get("entryId") ?? "").trim();
  const targetTypeValue = String(formData.get("targetType") ?? "").trim().toUpperCase();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${entryId}`);

  if (
    !scope.databaseReady ||
    !scope.organizationId ||
    !scope.auth.personId ||
    !entryId ||
    !targetId ||
    !isEntryObjectLinkTargetType(targetTypeValue)
  ) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: organizationId,
      action: "entry.update",
    });

    await unlinkEntryFromObject({
      organizationId: organizationId,
      entryId,
      targetType: targetTypeValue,
      targetId,
      actorPersonId: scope.auth.personId,
    });

    try {
      await unlinkOperationalRecords({
        organizationId: organizationId,
        from: { nodeType: "ENTRY", nodeId: entryId },
        to: { nodeType: mapEntryObjectLinkTargetToGraphNodeType(targetTypeValue), nodeId: targetId },
        relationshipType: defaultRelationshipTypeForEntryObjectTarget(targetTypeValue),
        actorPersonId: scope.auth.personId,
      });
    } catch {
      // Do not block entry object-link unlink when no matching graph edge exists.
    }
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

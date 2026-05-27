import { NextResponse } from "next/server";

import {
  defaultRelationshipTypeForEntryObjectTarget,
  entryObjectTargetExists,
  isEntryObjectLinkTargetType,
} from "@/lib/entries/object-links";
import { db } from "@/lib/db";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { mapEntryObjectLinkTargetToGraphNodeType, linkOperationalRecords } from "@/lib/operational-graph";
import { linkEntryToObject } from "@/lib/operational-entry";
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
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const [entryExists, targetExists] = await Promise.all([
    db.entry.findFirst({
      where: { id: entryId, organizationId: organizationId, deletedAt: null },
      select: { id: true },
    }),
    entryObjectTargetExists({
      organizationId: organizationId,
      targetType: targetTypeValue,
      targetId,
    }),
  ]);

  if (!entryExists || !targetExists) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  try {
    await linkEntryToObject({
      organizationId: organizationId,
      entryId,
      targetType: targetTypeValue,
      targetId,
      createdByPersonId: scope.auth.personId,
    });

    await linkOperationalRecords({
      organizationId: organizationId,
      from: { nodeType: "ENTRY", nodeId: entryId },
      to: { nodeType: mapEntryObjectLinkTargetToGraphNodeType(targetTypeValue), nodeId: targetId },
      relationshipType: defaultRelationshipTypeForEntryObjectTarget(targetTypeValue),
      createdByPersonId: scope.auth.personId,
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

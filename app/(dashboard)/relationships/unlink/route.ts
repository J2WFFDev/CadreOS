import { NextResponse } from "next/server";

import {
  isFoundationRelationshipNodeType,
  isFoundationRelationshipType,
  removeFoundationRelationship,
} from "@/lib/entry-relationships";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const fromNodeType = String(formData.get("fromNodeType") ?? "").trim().toUpperCase();
  const fromNodeId = String(formData.get("fromNodeId") ?? "").trim();
  const toNodeType = String(formData.get("toNodeType") ?? "").trim().toUpperCase();
  const toNodeId = String(formData.get("toNodeId") ?? "").trim();
  const relationshipType = String(formData.get("relationshipType") ?? "").trim().toUpperCase();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/entries");

  if (
    !scope.databaseReady ||
    !scope.organizationId ||
    !isFoundationRelationshipNodeType(fromNodeType) ||
    !isFoundationRelationshipNodeType(toNodeType) ||
    !isFoundationRelationshipType(relationshipType) ||
    !fromNodeId ||
    !toNodeId
  ) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  try {
    await removeFoundationRelationship({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      from: { nodeType: fromNodeType, nodeId: fromNodeId },
      to: { nodeType: toNodeType, nodeId: toNodeId },
      relationshipType,
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

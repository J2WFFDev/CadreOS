import { OperationalGraphNodeType, OperationalRelationshipType } from "@prisma/client";
import { NextResponse } from "next/server";

import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { unlinkOperationalRecords } from "@/lib/operational-graph";
import { requirePermission } from "@/lib/permissions";

function isOperationalNodeType(value: string): value is OperationalGraphNodeType {
  return Object.values(OperationalGraphNodeType).includes(value as OperationalGraphNodeType);
}

function isRelationshipType(value: string): value is OperationalRelationshipType {
  return Object.values(OperationalRelationshipType).includes(value as OperationalRelationshipType);
}

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
    !scope.auth.personId ||
    !isOperationalNodeType(fromNodeType) ||
    !isOperationalNodeType(toNodeType) ||
    !isRelationshipType(relationshipType) ||
    !fromNodeId ||
    !toNodeId
  ) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: scope.organizationId,
      action: "entry.update",
    });

    await unlinkOperationalRecords({
      organizationId: scope.organizationId,
      from: { nodeType: fromNodeType, nodeId: fromNodeId },
      to: { nodeType: toNodeType, nodeId: toNodeId },
      relationshipType,
      actorPersonId: scope.auth.personId,
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

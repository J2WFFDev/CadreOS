import { OperationalGraphNodeType, OperationalRelationshipType } from "@prisma/client";
import { NextResponse } from "next/server";

import { linkOperationalRecords, listRelatedOperationalRecords, unlinkOperationalRecords } from "@/lib/operational-graph";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

function isOperationalNodeType(value: string): value is OperationalGraphNodeType {
  return Object.values(OperationalGraphNodeType).includes(value as OperationalGraphNodeType);
}

function isOperationalRelationshipType(value: string): value is OperationalRelationshipType {
  return Object.values(OperationalRelationshipType).includes(value as OperationalRelationshipType);
}

export async function GET(request: Request) {
  const scope = await getOrganizationScope();
  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.json({ error: "Organization context unavailable." }, { status: 400 });
  }

  const url = new URL(request.url);
  const nodeType = String(url.searchParams.get("nodeType") ?? "").trim().toUpperCase();
  const nodeId = String(url.searchParams.get("nodeId") ?? "").trim();
  const limit = Number.parseInt(String(url.searchParams.get("limit") ?? "30"), 10);

  if (!isOperationalNodeType(nodeType) || !nodeId) {
    return NextResponse.json({ error: "nodeType and nodeId are required." }, { status: 400 });
  }

  const related = await listRelatedOperationalRecords({
    organizationId: scope.organizationId,
    node: { nodeType, nodeId },
    limit: Number.isNaN(limit) ? 30 : Math.max(1, Math.min(limit, 100)),
  });

  return NextResponse.json({ related });
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.json({ error: "Organization context unavailable." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const fromNodeType = String(body?.fromNodeType ?? "").trim().toUpperCase();
  const fromNodeId = String(body?.fromNodeId ?? "").trim();
  const toNodeType = String(body?.toNodeType ?? "").trim().toUpperCase();
  const toNodeId = String(body?.toNodeId ?? "").trim();
  const relationshipType = String(body?.relationshipType ?? "").trim().toUpperCase();
  const metadata = body?.metadata ?? null;

  if (
    !isOperationalNodeType(fromNodeType) ||
    !isOperationalNodeType(toNodeType) ||
    !isOperationalRelationshipType(relationshipType) ||
    !fromNodeId ||
    !toNodeId
  ) {
    return NextResponse.json({ error: "Invalid relationship payload." }, { status: 400 });
  }

  await requirePermission({
    actorUserId: scope.auth.clerkUserId,
    organizationId: scope.organizationId,
    action: "entry.update",
  });

  try {
    const relationship = await linkOperationalRecords({
      organizationId: scope.organizationId,
      from: { nodeType: fromNodeType, nodeId: fromNodeId },
      to: { nodeType: toNodeType, nodeId: toNodeId },
      relationshipType,
      createdByPersonId: scope.auth.personId,
      metadata: typeof metadata === "object" && metadata ? metadata : null,
    });

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create relationship." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const scope = await getOrganizationScope();
  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.json({ error: "Organization context unavailable." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const fromNodeType = String(body?.fromNodeType ?? "").trim().toUpperCase();
  const fromNodeId = String(body?.fromNodeId ?? "").trim();
  const toNodeType = String(body?.toNodeType ?? "").trim().toUpperCase();
  const toNodeId = String(body?.toNodeId ?? "").trim();
  const relationshipType = String(body?.relationshipType ?? "").trim().toUpperCase();

  if (
    !isOperationalNodeType(fromNodeType) ||
    !isOperationalNodeType(toNodeType) ||
    !isOperationalRelationshipType(relationshipType) ||
    !fromNodeId ||
    !toNodeId
  ) {
    return NextResponse.json({ error: "Invalid relationship payload." }, { status: 400 });
  }

  await requirePermission({
    actorUserId: scope.auth.clerkUserId,
    organizationId: scope.organizationId,
    action: "entry.update",
  });

  try {
    const relationship = await unlinkOperationalRecords({
      organizationId: scope.organizationId,
      from: { nodeType: fromNodeType, nodeId: fromNodeId },
      to: { nodeType: toNodeType, nodeId: toNodeId },
      relationshipType,
      actorPersonId: scope.auth.personId,
    });

    return NextResponse.json({ relationship }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove relationship." }, { status: 400 });
  }
}

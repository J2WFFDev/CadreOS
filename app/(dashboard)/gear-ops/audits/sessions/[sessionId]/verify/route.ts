import { InventoryDiscrepancyType, InventoryVerificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { getOrganizationScope } from "@/lib/organization-context";
import {
  recordInventoryAuditVerification,
  resolveInventoryAuditWriteAccess,
} from "@/lib/inventory-audit";
import { resolveScan, writeScanEvent } from "@/lib/inventory-scan";
import { resolveActorPersonId } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryAuditWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.session.verify",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const scanValue = ((formData.get("scanValue") as string | null) ?? "").trim();
  let gearItemId = ((formData.get("gearItemId") as string | null) ?? "").trim() || null;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const verificationStatusRaw =
    ((formData.get("verificationStatus") as string | null) ?? "").trim() || InventoryVerificationStatus.VERIFIED_MATCH;
  const discrepancyTypeRaw = ((formData.get("discrepancyType") as string | null) ?? "").trim();

  const verifiedByPersonId = await resolveActorPersonId({
    organizationId: scope.organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  const verificationStatus = Object.values(InventoryVerificationStatus).includes(
    verificationStatusRaw as InventoryVerificationStatus,
  )
    ? (verificationStatusRaw as InventoryVerificationStatus)
    : InventoryVerificationStatus.VERIFIED_MATCH;
  const discrepancyType =
    discrepancyTypeRaw.length > 0 &&
    Object.values(InventoryDiscrepancyType).includes(discrepancyTypeRaw as InventoryDiscrepancyType)
      ? (discrepancyTypeRaw as InventoryDiscrepancyType)
      : null;

  let scanEventId: string | null = null;
  if (scanValue.length > 0) {
    const resolved = await resolveScan({
      organizationId: scope.organizationId,
      scanValue,
    });

    const scanEvent = await writeScanEvent({
      organizationId: scope.organizationId,
      actorPersonId: verifiedByPersonId ?? null,
      scanContext: "INVENTORY_VERIFICATION",
      identifier: resolved.identifier,
      result: resolved.result,
      matchType: resolved.matchType,
      gearItemId: resolved.match?.entityType === "GEAR_ITEM" ? resolved.match.id : null,
      locationId: resolved.match?.entityType === "INVENTORY_LOCATION" ? resolved.match.id : null,
      metadata: {
        workflow: "inventory-audit.session.verify",
        auditSessionId: sessionId,
      },
    });

    scanEventId = scanEvent.id;
    if (!gearItemId && resolved.match?.entityType === "GEAR_ITEM") {
      gearItemId = resolved.match.id;
    }
  }

  await recordInventoryAuditVerification({
    organizationId: scope.organizationId,
    auditSessionId: sessionId,
    verificationStatus,
    verifiedByPersonId: verifiedByPersonId ?? null,
    gearItemId,
    scanEventId,
    scannedCode: scanValue || null,
    notes,
    discrepancyType,
  });

  redirect(`/gear-ops/audits/sessions/${sessionId}`);
}

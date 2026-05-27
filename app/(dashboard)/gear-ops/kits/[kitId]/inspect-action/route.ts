import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { logKitInspection, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import type { GearKitInspectionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES: GearKitInspectionStatus[] = [
  "PASSED",
  "PASSED_WITH_NOTES",
  "INCOMPLETE",
  "FAILED",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kitId: string }> },
) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.inspect",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  if (!scope.auth.personId) {
    return new Response("Actor person required for kit inspection.", { status: 400 });
  }

  const formData = await request.formData();
  const statusRaw = (formData.get("status") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!statusRaw || !VALID_STATUSES.includes(statusRaw as GearKitInspectionStatus)) {
    redirect(`/gear-ops/kits/${kitId}/inspect`);
  }

  const status = statusRaw as GearKitInspectionStatus;

  // Collect missing item IDs (multiple checkbox values with same name)
  const missingItemIds = formData.getAll("missingItemId").map((v) => String(v)).filter(Boolean);

  // Collect per-item notes — keys like itemNote_<kitItemId>
  const itemConditions: Array<{ kitItemId: string; gearItemId: string; notes: string | null }> = [];
  const kitItems = await db.inventoryKitItem.findMany({
    where: { kitId, kit: { organizationId: scope.organizationId }, removedAt: null },
    select: { id: true, gearItemId: true },
  });

  for (const kitItem of kitItems) {
    const noteVal = (formData.get(`itemNote_${kitItem.id}`) as string | null)?.trim() || null;
    if (noteVal) {
      itemConditions.push({ kitItemId: kitItem.id, gearItemId: kitItem.gearItemId, notes: noteVal });
    }
  }

  await logKitInspection({
    organizationId: scope.organizationId,
    kitId,
    inspectedByPersonId: scope.auth.personId,
    status,
    notes,
    itemConditions: itemConditions.length > 0 ? itemConditions : undefined,
    missingItemIds: missingItemIds.length > 0 ? missingItemIds : undefined,
  });

  redirect(`/gear-ops/kits/${kitId}`);
}

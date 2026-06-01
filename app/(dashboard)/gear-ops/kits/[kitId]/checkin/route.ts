import { redirect } from "next/navigation";

import { checkInKit, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

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
    workflow: "inventory-ops.kits.checkin",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  if (!scope.auth.personId) {
    return new Response("Actor person required for kit check-in.", { status: 400 });
  }

  const formData = await request.formData();
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const expectedGearItemIds = Array.from(
    new Set(
      formData
        .getAll("expectedGearItemId")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
  const returnedGearItemIds = Array.from(
    new Set(
      formData
        .getAll("returnedGearItemId")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
  const damagedGearItemIds = Array.from(
    new Set(
      formData
        .getAll("damagedGearItemId")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
  const maintenanceGearItemIds = Array.from(
    new Set(
      formData
        .getAll("maintenanceGearItemId")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
  const missingGearItemIds =
    expectedGearItemIds.length > 0
      ? expectedGearItemIds.filter((itemId) => !returnedGearItemIds.includes(itemId))
      : [];
  const hasExpectedSelection = expectedGearItemIds.length > 0;

  await checkInKit({
    organizationId: scope.organizationId,
    kitId,
    actorPersonId: scope.auth.personId,
    notes,
    isPartial: hasExpectedSelection ? returnedGearItemIds.length !== expectedGearItemIds.length : undefined,
    partialChildGearItemIds: hasExpectedSelection ? returnedGearItemIds : undefined,
    missingGearItemIds,
    damagedGearItemIds,
    maintenanceGearItemIds,
  });

  redirect(`/gear-ops/kits/${kitId}`);
}

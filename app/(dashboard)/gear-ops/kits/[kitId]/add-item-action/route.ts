import { redirect } from "next/navigation";

import { addItemToKit, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import type { GearKitComponentRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_ROLES: GearKitComponentRole[] = [
  "REQUIRED",
  "OPTIONAL",
  "CONSUMABLE",
  "REPLACEABLE",
  "QUANTITY_MANAGED",
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
    workflow: "inventory-ops.kits.items.add",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const gearItemId = (formData.get("gearItemId") as string | null)?.trim() ?? "";
  const componentRoleRaw = (formData.get("componentRole") as string | null)?.trim() || null;
  const isRequiredRaw = formData.get("isRequired");
  const quantity = parseInt((formData.get("quantity") as string | null) ?? "1", 10) || 1;
  const quantityExpected =
    parseInt((formData.get("quantityExpected") as string | null) ?? "1", 10) || 1;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!gearItemId) {
    redirect(`/gear-ops/kits/${kitId}/add-item`);
  }

  const componentRole =
    componentRoleRaw && VALID_ROLES.includes(componentRoleRaw as GearKitComponentRole)
      ? (componentRoleRaw as GearKitComponentRole)
      : "REQUIRED";

  await addItemToKit({
    organizationId: scope.organizationId,
    kitId,
    gearItemId,
    componentRole,
    isRequired: isRequiredRaw === "true",
    quantity,
    quantityExpected,
    notes,
  });

  redirect(`/gear-ops/kits/${kitId}`);
}

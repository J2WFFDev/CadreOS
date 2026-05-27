import { redirect } from "next/navigation";

import { resolveInventoryOpsWriteAccess, updateInventoryKit } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import type { GearKitType } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_KIT_TYPES: GearKitType[] = [
  "KIT",
  "BUNDLE",
  "CASE",
  "BAG",
  "SET",
  "LOADOUT",
  "EQUIPMENT_PACKAGE",
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
    workflow: "inventory-ops.kits.edit",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const kitTypeRaw = (formData.get("kitType") as string | null)?.trim() || null;
  const isActiveRaw = formData.get("isActive");
  const kitType =
    kitTypeRaw && VALID_KIT_TYPES.includes(kitTypeRaw as GearKitType)
      ? (kitTypeRaw as GearKitType)
      : undefined;

  if (!name) {
    redirect(`/gear-ops/kits/${kitId}/edit`);
  }

  await updateInventoryKit({
    organizationId: scope.organizationId,
    kitId,
    name,
    description,
    kitType,
    isActive: isActiveRaw === "true",
  });

  redirect(`/gear-ops/kits/${kitId}`);
}

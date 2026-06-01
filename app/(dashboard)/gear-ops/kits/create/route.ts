import { redirect } from "next/navigation";

import { createInventoryKit, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
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

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.create",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const ownerPersonId = (formData.get("ownerPersonId") as string | null)?.trim() || null;
  const kitTypeRaw = (formData.get("kitType") as string | null)?.trim() || null;
  const kitType =
    kitTypeRaw && VALID_KIT_TYPES.includes(kitTypeRaw as GearKitType)
      ? (kitTypeRaw as GearKitType)
      : "KIT";

  if (!name) {
    redirect("/gear-ops/kits/new");
  }

  const kit = await createInventoryKit({
    organizationId: organizationId,
    name,
    description,
    category,
    notes,
    ownerPersonId,
    kitType,
  });

  redirect(`/gear-ops/kits/${kit.id}`);
}

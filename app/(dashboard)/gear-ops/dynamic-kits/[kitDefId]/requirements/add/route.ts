import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import type { GearInventoryType } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_INVENTORY_TYPES: GearInventoryType[] = ["DURABLE", "CONSUMABLE"];

type Props = {
  params: Promise<{ kitDefId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { kitDefId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveGearOpsReadAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.dynamic-kits.requirements.add",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const def = await db.dynamicKitDefinition.findUnique({
    where: { id: kitDefId },
    select: { id: true, organizationId: true },
  });

  if (!def || def.organizationId !== organizationId) {
    return new Response("Dynamic kit not found.", { status: 404 });
  }

  const formData = await request.formData();
  const inventoryTypeRaw = (formData.get("inventoryType") as string | null)?.trim() ?? "";
  const inventoryType =
    VALID_INVENTORY_TYPES.includes(inventoryTypeRaw as GearInventoryType)
      ? (inventoryTypeRaw as GearInventoryType)
      : null;

  if (!inventoryType) {
    redirect(`/gear-ops/dynamic-kits/${kitDefId}/requirements/new`);
  }

  const gearCategoryId = (formData.get("gearCategoryId") as string | null)?.trim() || null;
  const categoryLabel = (formData.get("categoryLabel") as string | null)?.trim() || null;
  const quantityRequiredRaw = parseInt(
    (formData.get("quantityRequired") as string | null) ?? "1",
    10,
  );
  const quantityRequired = isNaN(quantityRequiredRaw) || quantityRequiredRaw < 1 ? 1 : quantityRequiredRaw;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  // Validate gearCategoryId belongs to this org if provided
  if (gearCategoryId) {
    const cat = await db.gearCategory.findUnique({
      where: { id: gearCategoryId },
      select: { organizationId: true },
    });
    if (!cat || cat.organizationId !== organizationId) {
      redirect(`/gear-ops/dynamic-kits/${kitDefId}/requirements/new`);
    }
  }

  await db.dynamicKitRequirement.create({
    data: {
      organizationId,
      kitDefinitionId: kitDefId,
      inventoryType,
      gearCategoryId,
      categoryLabel,
      quantityRequired,
      notes,
    },
  });

  redirect(`/gear-ops/dynamic-kits/${kitDefId}`);
}

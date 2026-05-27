import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ kitId: string; kitItemId: string }> },
) {
  const { kitId, kitItemId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.items.remove",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const item = await db.inventoryKitItem.findFirst({
    where: {
      id: kitItemId,
      kitId,
      kit: { organizationId: scope.organizationId },
      removedAt: null,
    },
    select: { id: true },
  });

  if (item) {
    await db.inventoryKitItem.update({
      where: { id: item.id },
      data: { removedAt: new Date() },
    });
  }

  redirect(`/gear-ops/kits/${kitId}`);
}

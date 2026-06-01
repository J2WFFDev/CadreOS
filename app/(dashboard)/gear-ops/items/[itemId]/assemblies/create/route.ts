import { redirect } from "next/navigation";

import {
  createGearAssemblyRelation,
  GEAR_ASSEMBLY_RELATIONSHIP_TYPES,
} from "@/lib/gear-assembly";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.assemblies.write",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const childGearItemId = (formData.get("childGearItemId") as string | null)?.trim() ?? "";
  const relationshipType = (formData.get("relationshipType") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!childGearItemId || !GEAR_ASSEMBLY_RELATIONSHIP_TYPES.includes(relationshipType as (typeof GEAR_ASSEMBLY_RELATIONSHIP_TYPES)[number])) {
    redirect(`/gear-ops/items/${itemId}/assemblies`);
  }

  try {
    await createGearAssemblyRelation({
      organizationId: scope.organizationId,
      parentGearItemId: itemId,
      childGearItemId,
      relationshipType,
      notes,
    });
  } catch {
    redirect(`/gear-ops/items/${itemId}/assemblies?error=cycle`);
  }

  redirect(`/gear-ops/items/${itemId}/assemblies`);
}

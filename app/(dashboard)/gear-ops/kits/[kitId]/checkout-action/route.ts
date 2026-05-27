import { redirect } from "next/navigation";

import { checkOutKit, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
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
    workflow: "inventory-ops.kits.checkout",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  if (!scope.auth.personId) {
    return new Response("Actor person required for kit checkout.", { status: 400 });
  }

  const formData = await request.formData();
  const custodyPersonId = (formData.get("custodyPersonId") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!custodyPersonId) {
    redirect(`/gear-ops/kits/${kitId}/checkout`);
  }

  await checkOutKit({
    organizationId: scope.organizationId,
    kitId,
    actorPersonId: scope.auth.personId,
    custodyPersonId,
    notes,
  });

  redirect(`/gear-ops/kits/${kitId}`);
}

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveGearOpsReadAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.create",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const active = formData.get("active") === "1";

  if (!name) {
    redirect("/gear-ops/pools/new");
  }

  const pool = await db.inventoryPool.create({
    data: { organizationId, name, description, active },
  });

  redirect(`/gear-ops/pools/${pool.id}`);
}

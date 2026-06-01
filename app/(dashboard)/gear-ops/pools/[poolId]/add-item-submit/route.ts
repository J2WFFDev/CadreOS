import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ poolId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { poolId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveGearOpsReadAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.add-item",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const pool = await db.inventoryPool.findUnique({
    where: { id: poolId },
    select: { id: true, organizationId: true },
  });

  if (!pool || pool.organizationId !== organizationId) {
    return new Response("Pool not found.", { status: 404 });
  }

  const formData = await request.formData();
  const gearItemId = (formData.get("gearItemId") as string | null)?.trim() ?? "";

  if (!gearItemId) {
    redirect(`/gear-ops/pools/${poolId}/add-item`);
  }

  const gearItem = await db.gearItem.findUnique({
    where: { id: gearItemId },
    select: { organizationId: true },
  });

  if (!gearItem || gearItem.organizationId !== organizationId) {
    redirect(`/gear-ops/pools/${poolId}/add-item`);
  }

  // Upsert — safe if already a member
  await db.inventoryPoolMembership.upsert({
    where: { poolId_gearItemId: { poolId, gearItemId } },
    update: {},
    create: { organizationId, poolId, gearItemId },
  });

  redirect(`/gear-ops/pools/${poolId}`);
}

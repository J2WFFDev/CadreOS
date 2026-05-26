import { InventoryAuditScope, InventoryAuditType } from "@prisma/client";
import { redirect } from "next/navigation";

import { createInventoryAudit, resolveInventoryAuditWriteAccess } from "@/lib/inventory-audit";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveActorPersonId } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveInventoryAuditWriteAccess({
    organizationId: organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.create",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const scopeReferenceId = (formData.get("scopeReferenceId") as string | null)?.trim() || null;
  const cadenceDaysRaw = (formData.get("cadenceDays") as string | null)?.trim() ?? "";
  const nextScheduledAtRaw = (formData.get("nextScheduledAt") as string | null)?.trim() ?? "";
  const auditTypeRaw = (formData.get("auditType") as string | null)?.trim() ?? InventoryAuditType.SCHEDULED;
  const scopeRaw = (formData.get("scope") as string | null)?.trim() ?? InventoryAuditScope.ORGANIZATION;

  if (!name) {
    redirect("/gear-ops/audits/new");
  }

  const createdByPersonId = await resolveActorPersonId({
    organizationId: organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  if (!createdByPersonId) {
    return new Response("No organization person is available for audit attribution.", { status: 400 });
  }

  const auditType = Object.values(InventoryAuditType).includes(auditTypeRaw as InventoryAuditType)
    ? (auditTypeRaw as InventoryAuditType)
    : InventoryAuditType.SCHEDULED;
  const scopeValue = Object.values(InventoryAuditScope).includes(scopeRaw as InventoryAuditScope)
    ? (scopeRaw as InventoryAuditScope)
    : InventoryAuditScope.ORGANIZATION;
  const cadenceDays = cadenceDaysRaw.length > 0 ? Number.parseInt(cadenceDaysRaw, 10) : null;
  const nextScheduledAt = nextScheduledAtRaw.length > 0 ? new Date(nextScheduledAtRaw) : null;

  const audit = await createInventoryAudit({
    organizationId: organizationId,
    createdByPersonId,
    name,
    description,
    auditType,
    scope: scopeValue,
    scopeReferenceId,
    cadenceDays: Number.isFinite(cadenceDays ?? Number.NaN) ? cadenceDays : null,
    nextScheduledAt: nextScheduledAt && !Number.isNaN(nextScheduledAt.getTime()) ? nextScheduledAt : null,
  });

  redirect(`/gear-ops/audits/${audit.id}`);
}

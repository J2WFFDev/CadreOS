import { NextResponse } from "next/server";

import { createGearWorkflowTask, GEAR_OPERATIONAL_EVENT_KINDS, GEAR_TASK_TEMPLATE_KEYS } from "@/lib/gear-ops-workflows";
import { resolveFollowUpTaskCreatorPersonId } from "@/lib/follow-up-tasks";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePhase1CMutationPermission } from "@/lib/workflows";

function buildRedirectUrl(requestUrl: string, returnTo: string, taskId?: string | null) {
  const fallback = taskId ? `/tasks/${taskId}?returnTo=${encodeURIComponent(returnTo)}` : returnTo;
  return new URL(resolveSafeReturnPath(fallback, returnTo), requestUrl);
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const subjectTypeRaw = String(formData.get("subjectType") ?? "").trim().toUpperCase();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const templateKeyRaw = String(formData.get("templateKey") ?? "").trim().toUpperCase();
  const eventKindRaw = String(formData.get("eventKind") ?? "").trim().toUpperCase();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/gear-ops");

  if (!scope.databaseReady || !scope.organizationId || !subjectId) {
    return NextResponse.redirect(buildRedirectUrl(request.url, returnTo), 303);
  }

  if (
    (subjectTypeRaw !== "GEAR_ITEM" && subjectTypeRaw !== "INVENTORY_KIT") ||
    !GEAR_TASK_TEMPLATE_KEYS.includes(templateKeyRaw as (typeof GEAR_TASK_TEMPLATE_KEYS)[number]) ||
    !GEAR_OPERATIONAL_EVENT_KINDS.includes(eventKindRaw as (typeof GEAR_OPERATIONAL_EVENT_KINDS)[number])
  ) {
    return NextResponse.redirect(buildRedirectUrl(request.url, returnTo), 303);
  }

  await requirePhase1CMutationPermission({
    organizationId: scope.organizationId,
    action: "task.create",
  });

  const createdByPersonId = await resolveFollowUpTaskCreatorPersonId(
    scope.organizationId,
    scope.auth.clerkUserId,
    scope.auth.personId,
  );

  if (!createdByPersonId) {
    return NextResponse.redirect(buildRedirectUrl(request.url, returnTo), 303);
  }

  const result = await createGearWorkflowTask({
    organizationId: scope.organizationId,
    createdByPersonId,
    templateKey: templateKeyRaw as (typeof GEAR_TASK_TEMPLATE_KEYS)[number],
    eventKind: eventKindRaw as (typeof GEAR_OPERATIONAL_EVENT_KINDS)[number],
    subjectType: subjectTypeRaw,
    subjectId,
  });

  return NextResponse.redirect(buildRedirectUrl(request.url, returnTo, result?.taskId ?? null), 303);
}

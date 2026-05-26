import { NextResponse } from "next/server";

import { markAllNotificationsRead } from "@/lib/notifications";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/notifications");

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  await markAllNotificationsRead(organizationId, scope.auth.personId);
  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

import { NextResponse } from "next/server";

import { setNotificationReadState } from "@/lib/notifications";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/notifications?view=all");

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  await setNotificationReadState({
    organizationId: organizationId,
    personId: scope.auth.personId,
    notificationId,
    read: false,
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

import { EntryPriority, NotificationDeliveryTiming } from "@prisma/client";
import { NextResponse } from "next/server";

import { updateNotificationPreferences } from "@/lib/notifications";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

function isEnabled(formData: FormData, field: string) {
  return String(formData.get(field) ?? "") === "1";
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), "/notifications");

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const minimumPriority = String(formData.get("minimumPriority") ?? "MEDIUM").toUpperCase();
  const deliveryTiming = String(formData.get("deliveryTiming") ?? "IMMEDIATE").toUpperCase();
  const digestWindowHours = Number.parseInt(String(formData.get("digestWindowHours") ?? "24"), 10);

  await updateNotificationPreferences({
    organizationId: scope.organizationId,
    personId: scope.auth.personId,
    values: {
      minimumPriority: Object.values(EntryPriority).includes(minimumPriority as EntryPriority)
        ? (minimumPriority as EntryPriority)
        : EntryPriority.MEDIUM,
      deliveryTiming: Object.values(NotificationDeliveryTiming).includes(deliveryTiming as NotificationDeliveryTiming)
        ? (deliveryTiming as NotificationDeliveryTiming)
        : NotificationDeliveryTiming.IMMEDIATE,
      digestWindowHours: Number.isFinite(digestWindowHours) ? Math.min(168, Math.max(1, digestWindowHours)) : 24,
      assignmentEnabled: isEnabled(formData, "assignmentEnabled"),
      followUpEnabled: isEnabled(formData, "followUpEnabled"),
      readinessEnabled: isEnabled(formData, "readinessEnabled"),
      workflowEnabled: isEnabled(formData, "workflowEnabled"),
      statusEnabled: isEnabled(formData, "statusEnabled"),
      linkedIssueEnabled: isEnabled(formData, "linkedIssueEnabled"),
      attendanceEnabled: isEnabled(formData, "attendanceEnabled"),
      dueEnabled: isEnabled(formData, "dueEnabled"),
    },
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

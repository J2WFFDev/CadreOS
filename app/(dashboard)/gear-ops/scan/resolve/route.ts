import { NextResponse } from "next/server";

import { getOrganizationScope } from "@/lib/organization-context";
import {
  resolveInventoryScanWriteAccess,
  resolveScan,
  resolveScanTargetPath,
  sanitizeScanContext,
  writeScanEvent,
} from "@/lib/inventory-scan";
import { getStringField } from "@/lib/workflows";

function buildScanPageRedirect(requestUrl: string, input: { scanValue: string; scanContext: string; error?: string; info?: string }) {
  const url = new URL("/gear-ops/scan", requestUrl);
  url.searchParams.set("scanValue", input.scanValue);
  url.searchParams.set("scanContext", input.scanContext);
  if (input.error) url.searchParams.set("error", input.error);
  if (input.info) url.searchParams.set("info", input.info);
  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const scanValue = getStringField(formData, "scanValue");
  const scanContext = sanitizeScanContext(getStringField(formData, "scanContext"));

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildScanPageRedirect(request.url, {
        scanValue,
        scanContext,
        error: scope.errorMessage ?? "Unable to resolve scan right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildScanPageRedirect(request.url, {
        scanValue,
        scanContext,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const access = await resolveInventoryScanWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.scan.resolve.write",
  });

  if (!access.allowed) {
    return NextResponse.redirect(
      buildScanPageRedirect(request.url, {
        scanValue,
        scanContext,
        error: access.denialMessage ?? "You are not authorized to use inventory scanning.",
      }),
      303,
    );
  }

  const resolved = await resolveScan({
    organizationId: scope.organizationId,
    scanValue,
  });

  if (!resolved.match) {
    await writeScanEvent({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      scanContext,
      identifier: resolved.identifier,
      result: resolved.result,
      matchType: resolved.matchType,
      metadata: { workflow: "gear-ops.scan.resolve" },
    });

    const message =
      resolved.result === "INVALID"
        ? "Invalid scan value. Use at least 2 characters."
        : "No inventory item or location matched that code.";

    return NextResponse.redirect(
      buildScanPageRedirect(request.url, {
        scanValue,
        scanContext,
        error: message,
      }),
      303,
    );
  }

  const workflowTarget = resolveScanTargetPath({
    scanContext,
    match: resolved.match,
    scanValue: resolved.identifier.normalizedValue,
  });

  await writeScanEvent({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    scanContext,
    identifier: resolved.identifier,
    result: resolved.result,
    matchType: resolved.matchType,
    gearItemId: resolved.match.entityType === "GEAR_ITEM" ? resolved.match.id : null,
    locationId: resolved.match.entityType === "INVENTORY_LOCATION" ? resolved.match.id : null,
    workflowTarget,
    metadata: { workflow: "gear-ops.scan.resolve" },
  });

  return NextResponse.redirect(new URL(workflowTarget, request.url), 303);
}

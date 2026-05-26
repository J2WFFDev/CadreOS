import { NextResponse } from "next/server";

import { commitGearImport, type GearImportMode } from "@/lib/gear-bulk-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isPermissionDeniedError, requirePhase1CMutationPermission } from "@/lib/workflows";

function isImportMode(value: string): value is GearImportMode {
  return value === "CREATE_ONLY" || value === "CREATE_OR_UPDATE";
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return NextResponse.json({ ok: false, error: scope.errorMessage ?? "Database is unavailable." }, { status: 503 });
  }

  if (!scope.organizationId) {
    return NextResponse.json({ ok: false, error: "No organization context is available yet." }, { status: 400 });
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "gear.bulk.import.commit",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: isPermissionDeniedError(error) ? error.message : "Not authorized to commit imports." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { csvText?: string; mode?: string } | null;

  if (!body?.csvText || typeof body.csvText !== "string") {
    return NextResponse.json({ ok: false, error: "CSV payload is required." }, { status: 400 });
  }

  const mode = isImportMode(body.mode ?? "") ? body.mode : "CREATE_ONLY";
  const result = await commitGearImport({
    organizationId: scope.organizationId,
    csvText: body.csvText,
    mode,
  });

  if (result.issues.length > 0) {
    return NextResponse.json({ ok: false, error: "Import validation failed.", issues: result.issues }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result });
}

import { NextResponse } from "next/server";

import { previewGearImport, type GearImportMode } from "@/lib/gear-bulk-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return NextResponse.json({ ok: false, error: scope.errorMessage ?? "Database is unavailable." }, { status: 503 });
  }

  if (!scope.organizationId) {
    return NextResponse.json({ ok: false, error: "No organization context is available yet." }, { status: 400 });
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.bulk.preview",
  });

  if (!access.allowed) {
    return NextResponse.json(
      { ok: false, error: access.denialMessage ?? "You are not authorized to preview imports." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { csvText?: string; mode?: string } | null;

  if (!body?.csvText || typeof body.csvText !== "string") {
    return NextResponse.json({ ok: false, error: "CSV payload is required." }, { status: 400 });
  }

  const mode: GearImportMode = body.mode === "CREATE_OR_UPDATE" ? "CREATE_OR_UPDATE" : "CREATE_ONLY";
  const preview = await previewGearImport({
    organizationId: scope.organizationId,
    csvText: body.csvText,
    mode,
  });

  return NextResponse.json({ ok: true, preview });
}

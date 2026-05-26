import { NextResponse } from "next/server";

import { buildGearExportCsv, type GearExportDataset } from "@/lib/gear-bulk-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

function isDataset(value: string): value is GearExportDataset {
  return ["inventory", "custody", "location", "readiness", "event_plan", "audit_summary"].includes(value);
}

export async function GET(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.json({ error: "Organization context is unavailable." }, { status: 400 });
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.bulk.export",
  });

  if (!access.allowed) {
    return NextResponse.json({ error: access.denialMessage ?? "Unauthorized." }, { status: 403 });
  }

  const url = new URL(request.url);
  const datasetRaw = url.searchParams.get("dataset") ?? "inventory";

  if (!isDataset(datasetRaw)) {
    return NextResponse.json({ error: "Unsupported export dataset." }, { status: 400 });
  }

  const { fileName, csv } = await buildGearExportCsv({
    organizationId: scope.organizationId,
    dataset: datasetRaw,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

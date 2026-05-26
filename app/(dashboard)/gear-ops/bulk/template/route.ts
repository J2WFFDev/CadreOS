import { NextResponse } from "next/server";

import { buildGearImportTemplateCsv } from "@/lib/gear-bulk-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export async function GET() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.json({ error: "Organization context is unavailable." }, { status: 400 });
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.bulk.template",
  });

  if (!access.allowed) {
    return NextResponse.json({ error: access.denialMessage ?? "Unauthorized." }, { status: 403 });
  }

  return new NextResponse(buildGearImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gearops-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}

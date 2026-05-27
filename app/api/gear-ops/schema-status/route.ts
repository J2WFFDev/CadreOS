import { NextResponse } from "next/server";

import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";

export async function GET() {
  const status = await getGearOpsSchemaStatus("core");

  return NextResponse.json({
    connected: status.connected,
    schemaReady: status.schemaReady,
    missingTables: status.missingTables,
    missingColumns: status.missingColumns,
    checkedAt: status.checkedAt,
  });
}

import { ErrorMessage } from "@/components/dashboard/error-message";
import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import {
  buildGearOpsSchemaUnavailableMessage,
  type GearOpsSchemaStatus,
} from "@/lib/gear-ops-schema-status";

type GearOpsSchemaWarningProps = {
  actionMessage: string;
  status: GearOpsSchemaStatus;
  organizationId: string;
  actorPersonId: string | null;
};

export async function GearOpsSchemaWarning({
  actionMessage,
  status,
  organizationId,
  actorPersonId,
}: GearOpsSchemaWarningProps) {
  const adminAccess = await resolveGearOpsAdminAccess({ organizationId, actorPersonId });
  const showDiagnostics = process.env.NODE_ENV !== "production" || adminAccess.allowed;

  return (
    <>
      <ErrorMessage message={buildGearOpsSchemaUnavailableMessage(status, actionMessage)} />
      {showDiagnostics ? (
        <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
          <p className="font-medium">GearOps schema diagnostics</p>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            Missing tables: {status.missingTables.length > 0 ? status.missingTables.join(", ") : "none"}
          </p>
          <p className="mt-1 text-zinc-700 dark:text-zinc-300">
            Missing columns: {status.missingColumns.length > 0 ? status.missingColumns.join(", ") : "none"}
          </p>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">Checked tables: {status.checkedTables.join(", ")}</p>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Checked at: {status.checkedAt}
            {status.databaseProvider ? ` · Provider: ${status.databaseProvider}` : ""}
          </p>
        </div>
      ) : null}
    </>
  );
}

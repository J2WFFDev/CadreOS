import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const archiveRoute = source("../../app/(dashboard)/entries/[entryId]/delete/route.ts");
const restoreRoute = source("../../app/(dashboard)/entries/[entryId]/restore/route.ts");
const detailPage = source("../../app/(dashboard)/entries/[entryId]/page.tsx");
const updateRoute = source("../../app/(dashboard)/entries/[entryId]/update/route.ts");
const lifecycleAccess = source("../../lib/entries/lifecycle-access.ts");

test("generic Entry archive and restore share the existing archive permission boundary", () => {
  assert.match(archiveRoute, /canArchiveEntry\(\{/);
  assert.match(restoreRoute, /canRestoreEntry\(\{/);
  for (const route of [archiveRoute, restoreRoute]) {
    assert.match(route, /createdByPersonId: true/);
    assert.match(route, /type: \{ not: EntryType\.JOURNAL \}/);
  }
});

test("shared lifecycle policy permits creator or existing elevated permission without broadening assignee access", () => {
  assert.match(lifecycleAccess, /canManageOwnEntryLifecycle\(input\)/);
  assert.match(lifecycleAccess, /resolveEntryLifecycleAccess\(\{ \.\.\.input, hasElevatedPermission \}\)/);
  assert.match(lifecycleAccess, /entry\.createdByPersonId === input\.actorPersonId/);
  assert.match(lifecycleAccess, /action: "entry\.delete"/);
  assert.doesNotMatch(lifecycleAccess, /assignedToPersonId/);
});

test("archive changes lifecycle state without deleting or rewriting Entry metadata", () => {
  assert.match(archiveRoute, /status: EntryStatus\.ARCHIVED/);
  assert.match(archiveRoute, /deletedAt: null/);
  assert.match(archiveRoute, /entryStatusHistory\.create/);
  assert.match(archiveRoute, /ENTRY_ACTIVITY_ACTIONS\.ENTRY_ARCHIVED/);
  assert.doesNotMatch(archiveRoute, /deletedAt: archivedAt/);
  assert.match(
    archiveRoute,
    /data: \{\s*deletedAt: null,\s*status: EntryStatus\.ARCHIVED,\s*updatedByPersonId: scope\.auth\.personId,\s*version: \{ increment: 1 \},\s*\}/,
  );
});

test("restore clears historical deletion and returns to the pre-archive workflow state", () => {
  assert.match(restoreRoute, /status: EntryStatus\.ARCHIVED/);
  assert.match(restoreRoute, /resolveEntryRestoreStatus\(archiveHistory\?\.fromStatus\)/);
  assert.match(restoreRoute, /deletedAt: null/);
  assert.match(restoreRoute, /entryStatusHistory\.create/);
  assert.match(restoreRoute, /ENTRY_ACTIVITY_ACTIONS\.ENTRY_RESTORED/);
  assert.match(
    restoreRoute,
    /data: \{\s*deletedAt: null,\s*status: restoredStatus,\s*updatedByPersonId: scope\.auth\.personId,\s*version: \{ increment: 1 \},\s*\}/,
  );
});

test("normal editing cannot bypass explicit lifecycle actions", () => {
  assert.match(detailPage, /Archive entry/);
  assert.match(detailPage, /Restore entry/);
  assert.doesNotMatch(detailPage, />Delete entry</);
  assert.match(detailPage, /canManageEntryLifecycle\(\{/);
  assert.match(detailPage, /entry: \{ createdByPersonId: entry\.createdByPersonId \}/);
  assert.match(detailPage, /resolveEntryLifecycleAction\(\{/);
  assert.match(detailPage, /Done means completed\. Archive removes this Entry from normal working views without deleting it\./);
  assert.match(detailPage, /status !== EntryStatus\.ARCHIVED/);
  assert.match(updateRoute, /entry\.status === EntryStatus\.ARCHIVED \|\| status === EntryStatus\.ARCHIVED/);
});

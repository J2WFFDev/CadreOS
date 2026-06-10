import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("Journal detail submits reopen through the POST action route", () => {
  const detailPage = source("../../app/(dashboard)/journals/[entryId]/page.tsx");
  const reopenRoute = source("../../app/(dashboard)/journals/[entryId]/reopen/route.ts");

  assert.match(detailPage, /action=\{`\/journals\/\$\{journal\.id\}\/reopen`\} method="post"/);
  assert.match(reopenRoute, /export async function POST\(/);
  assert.match(reopenRoute, /status: EntryStatus\.OPEN/);
  assert.match(reopenRoute, /journal\.status !== EntryStatus\.DONE/);
  assert.match(reopenRoute, /journalStatus: "DRAFT"/);
  assert.match(reopenRoute, /new URL\(`\/journals\/\$\{entryId\}`/);
  assert.doesNotMatch(reopenRoute, /new URL\("\/dashboard"/);
});

test("generic Entry detail links to the Journal view instead of GET-navigating to the POST-only reopen route", () => {
  const entryDetailPage = source("../../app/(dashboard)/entries/[entryId]/page.tsx");

  assert.doesNotMatch(entryDetailPage, /href=\{`\/journals\/\$\{entry\.id\}\/reopen`\}/);
  assert.match(entryDetailPage, /href=\{`\/journals\/\$\{entry\.id\}`\}/);
});

test("generic Entry status changes synchronize the Journal workflow payload", () => {
  const entryUpdateRoute = source("../../app/(dashboard)/entries/[entryId]/update/route.ts");

  assert.match(entryUpdateRoute, /journalPayload\.journalStatus = mapEntryStatusToJournalWorkflowStatus\(status\)/);
});

test("Journal UI distinguishes workflow status from generic Entry status", () => {
  const journalsPage = source("../../app/(dashboard)/journals/page.tsx");
  const journalDetailPage = source("../../app/(dashboard)/journals/[entryId]/page.tsx");

  assert.match(journalsPage, />Journal Workflow Status</);
  assert.match(journalsPage, />Entry Status</);
  assert.match(journalDetailPage, /Done maps to Final/);
  assert.match(journalDetailPage, /Final is a completed workflow state, not an archive state/);
  assert.match(journalDetailPage, /Guardian visibility\s+begins only when a Guardian-visible Journal is Final/);
});

test("Journal list, detail, and actions use the same Journal visibility predicate", () => {
  const paths = [
    "../../app/(dashboard)/journals/page.tsx",
    "../../app/(dashboard)/journals/[entryId]/page.tsx",
    "../../app/(dashboard)/journals/[entryId]/edit/page.tsx",
    "../../app/(dashboard)/journals/[entryId]/edit/update/route.ts",
    "../../app/(dashboard)/journals/[entryId]/submit/route.ts",
    "../../app/(dashboard)/journals/[entryId]/archive/route.ts",
    "../../app/(dashboard)/journals/[entryId]/restore/route.ts",
    "../../app/(dashboard)/journals/[entryId]/reopen/route.ts",
  ];

  for (const path of paths) {
    const fileSource = source(path);
    assert.match(fileSource, /buildJournalEntryVisibilityWhere/);
    assert.doesNotMatch(fileSource, /resolveEntryOpsTypeAwareVisibilityWhere/);
  }
});

test("Guardian Summary derives access from relationships instead of requiring a Guardian RoleAssignment", () => {
  const guardianSummaryPage = source("../../app/(dashboard)/guardian-summary/page.tsx");

  assert.match(guardianSummaryPage, /athleteGuardianRelationship\.findMany/);
  assert.doesNotMatch(guardianSummaryPage, /roleAssignment\.findFirst/);
  assert.doesNotMatch(guardianSummaryPage, /PARENT_GUARDIAN/);
});

test("Journal route guard permits existing EntryOps roles while navigation remains separate", () => {
  const accessControl = source("../../lib/auth/access-control.ts");
  const journalLayout = source("../../app/(dashboard)/journals/layout.tsx");

  assert.match(accessControl, /journal:[\s\S]*?allowedRoles: WORKOPS_ROLES/);
  assert.match(journalLayout, /requireModuleAccess\("journal"\)/);
});

test("generic EntryOps visibility derives Guardian scope from relationships without fake roles", () => {
  const visibilitySource = source("../../lib/entryops/visibility.ts");

  assert.match(visibilitySource, /athleteGuardianRelationship\.findMany/);
  assert.doesNotMatch(
    visibilitySource,
    /const isGuardian = assignments\.some[\s\S]*?\? await db\.athleteGuardianRelationship\.findMany/,
  );
});

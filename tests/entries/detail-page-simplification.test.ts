import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const detailPagePath = fileURLToPath(new URL("../../app/(dashboard)/entries/[entryId]/page.tsx", import.meta.url));
const relationshipPanelPath = fileURLToPath(new URL("../../components/dashboard/relationship-panel.tsx", import.meta.url));

function read(filePath: string) {
  return readFileSync(filePath, "utf8");
}

test("entry detail page removes duplicate and legacy linking sections", () => {
  const source = read(detailPagePath);

  // Intentional copy-level contract checks: these labels should not reappear in the normal detail UI.
  assert.equal(source.includes("Work inbox"), false);
  assert.equal(source.includes("Calendar-ready"), false);
  assert.equal(source.includes("Operational feed"), false);
  assert.equal(source.includes("Source links"), false);
  assert.equal(source.includes("Advanced follow-up tasks"), false);
  assert.equal(source.includes("Follow-up tasks (advanced workflow)"), false);
  assert.equal(source.includes("Link operational object"), false);
  assert.equal(source.includes("Linked objects"), false);
  assert.equal(source.includes("Linked work items"), false);
  assert.equal(source.includes("Related operational items"), false);
});

test("entry detail page keeps details, main form actions, metadata, relationships, and activity sections", () => {
  const detailSource = read(detailPagePath);
  const relationshipSource = read(relationshipPanelPath);

  assert.equal(detailSource.includes("Main Item"), false);
  assert.equal(detailSource.includes(">Details</h3>"), true);
  assert.equal(detailSource.includes("Metadata"), true);
  assert.equal(detailSource.includes("Complete task"), true);
  assert.equal(detailSource.includes("Soft delete"), true);
  assert.equal(detailSource.includes("Activity / history"), true);
  assert.equal(detailSource.includes('action="/relationships/link"'), false);
  assert.equal(relationshipSource.includes('action="/relationships/link"'), true);
  assert.equal(relationshipSource.includes('action="/relationships/unlink"'), true);
  assert.equal(relationshipSource.includes(">Related Items</h3>"), true);
  assert.equal(relationshipSource.includes("No related items yet."), true);
});

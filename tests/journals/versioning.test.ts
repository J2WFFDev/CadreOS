import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryStatus, EntryVisibility, JournalVersionChangeType } from "@prisma/client";

import { buildJournalVersionSnapshotCreateInput, labelForJournalVersionChangeType } from "../../lib/journals/versioning";

test("buildJournalVersionSnapshotCreateInput maps snapshot fields without journal body leakage side-effects", () => {
  const created = buildJournalVersionSnapshotCreateInput({
    organizationId: "org-1",
    entryId: "entry-1",
    versionNumber: 3,
    changeType: JournalVersionChangeType.SUBMITTED,
    title: "Post-practice reflection",
    content: "Private confidence notes",
    visibility: EntryVisibility.TEAM_STAFF,
    status: EntryStatus.DONE,
    fromStatus: EntryStatus.OPEN,
    toStatus: EntryStatus.DONE,
    capturedByPersonId: "person-1",
    changeReason: "Journal finalized/submitted.",
  });

  assert.equal(created.organizationId, "org-1");
  assert.equal(created.entryId, "entry-1");
  assert.equal(created.versionNumber, 3);
  assert.equal(created.changeType, JournalVersionChangeType.SUBMITTED);
  assert.equal(created.titleSnapshot, "Post-practice reflection");
  assert.equal(created.contentSnapshot, "Private confidence notes");
  assert.equal(created.visibilityAtVersion, EntryVisibility.TEAM_STAFF);
  assert.equal(created.statusAtVersion, EntryStatus.DONE);
  assert.equal(created.fromStatus, EntryStatus.OPEN);
  assert.equal(created.toStatus, EntryStatus.DONE);
  assert.equal(created.capturedByPersonId, "person-1");
  assert.equal(created.changeReason, "Journal finalized/submitted.");
});

test("labelForJournalVersionChangeType returns safe labels", () => {
  assert.equal(labelForJournalVersionChangeType(JournalVersionChangeType.DRAFT_CREATED), "Draft created");
  assert.equal(labelForJournalVersionChangeType(JournalVersionChangeType.DRAFT_UPDATED), "Draft updated");
  assert.equal(labelForJournalVersionChangeType(JournalVersionChangeType.SUBMITTED), "Submitted");
  assert.equal(labelForJournalVersionChangeType(JournalVersionChangeType.ARCHIVED), "Archived");
});

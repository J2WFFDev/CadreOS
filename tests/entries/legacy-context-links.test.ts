import { strict as assert } from "node:assert";
import test from "node:test";

import { buildLegacyContextLinks } from "../../app/(dashboard)/entries/[entryId]/page";

test("buildLegacyContextLinks returns source and follow-up links when present", () => {
  const links = buildLegacyContextLinks({
    sourceTaskId: "task-1",
    sourceNoteId: "note-1",
    followUpEntries: [
      { id: "entry-1", title: "Follow-up A" },
      { id: "entry-2", title: "Follow-up B" },
    ],
  });

  assert.equal(links.length, 4);
  assert.deepEqual(
    links.map((item) => item.href),
    ["/tasks/task-1", "/notes/note-1", "/entries/entry-1", "/entries/entry-2"],
  );
});

test("buildLegacyContextLinks returns empty list when no legacy references exist", () => {
  const links = buildLegacyContextLinks({
    sourceTaskId: null,
    sourceNoteId: null,
    followUpEntries: [],
  });

  assert.deepEqual(links, []);
});

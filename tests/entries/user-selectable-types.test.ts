import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryType } from "@prisma/client";

import { USER_SELECTABLE_ENTRY_TYPES } from "../../lib/entries/user-selectable-types";

test("user-selectable entry types keep Habit out of legacy Entry.type creation", () => {
  assert.deepEqual(USER_SELECTABLE_ENTRY_TYPES, [
    EntryType.TASK,
    EntryType.NOTE,
    EntryType.EVENT,
    EntryType.DECISION,
    EntryType.JOURNAL,
  ]);
  assert.equal((USER_SELECTABLE_ENTRY_TYPES as EntryType[]).includes(EntryType.HABIT), false);
});

import { strict as assert } from "node:assert";
import test from "node:test";

import { habitAccessErrorMessage } from "../../lib/habits/access-feedback";

test("habit not-found and visibility-denied failures use the same safe message", () => {
  assert.equal(
    habitAccessErrorMessage("HABIT_NOT_FOUND"),
    habitAccessErrorMessage("HABIT_VISIBILITY_DENIED"),
  );
  assert.match(habitAccessErrorMessage("HABIT_NOT_FOUND") ?? "", /could not be found or you do not have access/i);
});

test("habit check-in denied failure is action-specific", () => {
  assert.match(habitAccessErrorMessage("HABIT_CHECK_IN_DENIED") ?? "", /permission to record a check-in/i);
});

test("habit lifecycle action failures are action-specific", () => {
  assert.match(habitAccessErrorMessage("HABIT_ARCHIVE_DENIED") ?? "", /permission to archive/i);
  assert.match(habitAccessErrorMessage("HABIT_RESTORE_DENIED") ?? "", /permission to restore/i);
  assert.match(habitAccessErrorMessage("HABIT_COMPLETE_DENIED") ?? "", /permission to complete/i);
  assert.match(habitAccessErrorMessage("HABIT_PAUSE_DENIED") ?? "", /permission to pause or resume/i);
});

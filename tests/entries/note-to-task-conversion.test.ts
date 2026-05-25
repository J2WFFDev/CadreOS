import { strict as assert } from "node:assert";
import test from "node:test";

import { deriveNoteToTaskTitle } from "../../lib/entries/service";

test("note-to-task conversion prioritizes selected text", () => {
  const title = deriveNoteToTaskTitle({
    selectedText: "Call parent about attendance concern",
    title: "Observation note",
    content: "Longer note content",
  });

  assert.equal(title, "Call parent about attendance concern");
});

test("note-to-task conversion falls back to note title then content", () => {
  const fallbackTitle = deriveNoteToTaskTitle({
    selectedText: "",
    title: "  Task from note title  ",
    content: "content",
  });
  assert.equal(fallbackTitle, "Task from note title");

  const contentFallback = deriveNoteToTaskTitle({
    selectedText: "",
    title: "",
    content: "Create follow-up based on note body",
  });
  assert.equal(contentFallback, "Create follow-up based on note body");
});

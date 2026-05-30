import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import {
  ENTRY_LIST_MIGRATION_NAME,
  formatEntryListSetupIncompleteMessage,
  getEntryListSchemaIssue,
} from "@/lib/entries/schema-guard";

function createKnownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Prisma error ${code}`,
    {
      code,
      clientVersion: "test",
      meta,
    },
  );
}

test("getEntryListSchemaIssue detects missing EntryList table", () => {
  const issue = getEntryListSchemaIssue(createKnownRequestError("P2021", { table: "public.EntryList" }));

  assert.deepEqual(issue?.missing, ["EntryList"]);
  assert.equal(issue?.detail, "Missing database table: public.EntryList");
});

test("getEntryListSchemaIssue detects missing Entry.listId column", () => {
  const issue = getEntryListSchemaIssue(createKnownRequestError("P2022", { column: "Entry.listId" }));

  assert.deepEqual(issue?.missing, ["Entry.listId"]);
  assert.equal(issue?.detail, "Missing database column: Entry.listId");
});

test("getEntryListSchemaIssue detects missing EntryListScope enum from message text", () => {
  const issue = getEntryListSchemaIssue(new Error('type "EntryListScope" does not exist'));

  assert.deepEqual(issue?.missing, ["EntryListScope"]);
  assert.equal(issue?.detail, "Missing database enum: EntryListScope");
});

test("getEntryListSchemaIssue ignores unrelated schema failures", () => {
  const issue = getEntryListSchemaIssue(createKnownRequestError("P2021", { table: "public.Team" }));

  assert.equal(issue, null);
});

test("formatEntryListSetupIncompleteMessage names the required migration", () => {
  assert.equal(
    formatEntryListSetupIncompleteMessage(),
    `Entry list setup is incomplete in this environment. Run migration ${ENTRY_LIST_MIGRATION_NAME} to enable entry lists.`,
  );
});

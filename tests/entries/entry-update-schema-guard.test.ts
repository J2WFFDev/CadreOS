// Arc 24D.5.1 — Entry update route schema-guard unit tests.
// Validates that the schema-guard helpers behave correctly for the scenarios
// exercised by the update route's payload fetch/write operations.

import { strict as assert } from "node:assert";
import test from "node:test";

import { Prisma } from "@prisma/client";

import {
  ENTRY_TYPE_PAYLOAD_MIGRATION_NAME,
  ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE,
  formatEntryTypePayloadSetupIncompleteMessage,
  getEntryTypePayloadSchemaIssue,
  logEntryTypePayloadSchemaIssue,
} from "../../lib/entries/schema-guard";

function makeP2021(table: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("test", {
    code: "P2021",
    clientVersion: "test",
    meta: { table },
  });
}

// D5-SCHEMA-001: fetch-payload guard detects missing table and returns issue
test("logEntryTypePayloadSchemaIssue returns issue for P2021 on EntryTypePayload table", () => {
  const error = makeP2021("public.EntryTypePayload");
  const issue = logEntryTypePayloadSchemaIssue("entries.update.fetch-payload", error, {
    entryId: "entry-1",
    organizationId: "org-1",
  });

  assert.ok(issue, "Expected issue to be non-null");
  assert.deepEqual(issue.missing, ["EntryTypePayload"]);
});

// D5-SCHEMA-002: fetch-payload guard passes through unrelated errors
test("logEntryTypePayloadSchemaIssue returns null for P2021 on unrelated table", () => {
  const error = makeP2021("public.SomeOtherTable");
  const issue = logEntryTypePayloadSchemaIssue("entries.update.fetch-payload", error, {
    entryId: "entry-1",
    organizationId: "org-1",
  });

  assert.equal(issue, null);
});

// D5-SCHEMA-003: upsert-payload guard detects missing table and returns issue
test("logEntryTypePayloadSchemaIssue returns issue for P2021 on upsert path", () => {
  const error = makeP2021("public.EntryTypePayload");
  const issue = logEntryTypePayloadSchemaIssue("entries.update.upsert-payload", error, {
    entryId: "entry-2",
    organizationId: "org-1",
  });

  assert.ok(issue, "Expected issue to be non-null");
  assert.deepEqual(issue.missing, ["EntryTypePayload"]);
});

// D5-SCHEMA-004: archive-payload guard detects missing table and returns issue (non-fatal path)
test("logEntryTypePayloadSchemaIssue returns issue for P2021 on archive path", () => {
  const error = makeP2021("public.EntryTypePayload");
  const issue = logEntryTypePayloadSchemaIssue("entries.update.archive-payload", error, {
    entryId: "entry-3",
    organizationId: "org-1",
  });

  assert.ok(issue, "Expected issue to be non-null");
  assert.deepEqual(issue.missing, ["EntryTypePayload"]);
});

// D5-SCHEMA-005: getEntryTypePayloadSchemaIssue also detects relation-not-found from message text
test("getEntryTypePayloadSchemaIssue detects entrytypepayload relation message (case-insensitive)", () => {
  const error = new Error('ERROR: relation "EntryTypePayload" does not exist');
  const issue = getEntryTypePayloadSchemaIssue(error);

  assert.ok(issue, "Expected issue to be non-null");
  assert.deepEqual(issue.missing, ["EntryTypePayload"]);
});

// D5-SCHEMA-006: user-facing unavailability message and migration name are consistent
test("ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE is a non-empty user-facing string", () => {
  assert.ok(
    typeof ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE === "string" && ENTRY_TYPE_PAYLOAD_UNAVAILABLE_MESSAGE.length > 0,
    "Expected a non-empty user-facing message",
  );
});

test("formatEntryTypePayloadSetupIncompleteMessage includes migration name", () => {
  const msg = formatEntryTypePayloadSetupIncompleteMessage();

  assert.ok(msg.includes(ENTRY_TYPE_PAYLOAD_MIGRATION_NAME), "Expected message to include migration name");
});

// D5-REG-001: non-EntryTypePayload P2021 errors are not swallowed by the guard
test("logEntryTypePayloadSchemaIssue returns null for P2021 on Entry table (unrelated)", () => {
  const error = makeP2021("public.Entry");
  const issue = logEntryTypePayloadSchemaIssue("entries.update.fetch-payload", error, {
    entryId: "entry-1",
    organizationId: "org-1",
  });

  assert.equal(issue, null);
});

// D5-REG-002: plain non-Prisma errors are not swallowed
test("logEntryTypePayloadSchemaIssue returns null for plain Error", () => {
  const error = new Error("unexpected failure");
  const issue = logEntryTypePayloadSchemaIssue("entries.update.fetch-payload", error, {
    entryId: "entry-1",
    organizationId: "org-1",
  });

  assert.equal(issue, null);
});

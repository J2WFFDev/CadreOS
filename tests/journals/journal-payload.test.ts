import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryType, EntryVisibility } from "@prisma/client";

import {
  createEmptyJournalEntryPayload,
  isJournalPayloadType,
  mapJournalPayloadVisibilityToEntryVisibility,
  normalizeJournalDateOnly,
  normalizeJournalPayloadVisibility,
  parseJournalEntryPayload,
  serializeJournalEntryPayload,
} from "../../lib/entries/journal-payload";

// ─── parseJournalEntryPayload ─────────────────────────────────────────────────

test("parseJournalEntryPayload returns default payload for null input", () => {
  const result = parseJournalEntryPayload(null);
  assert.equal(result.journalStatus, "DRAFT");
  assert.equal(result.journalVisibility, "PRIVATE");
  assert.equal(result.journalDate, null);
  assert.equal(result.journalAuthor, "");
});

test("parseJournalEntryPayload returns default payload for empty JSON object string", () => {
  const result = parseJournalEntryPayload("{}");
  assert.equal(result.journalStatus, "DRAFT");
  assert.equal(result.journalVisibility, "PRIVATE");
  assert.equal(result.journalDate, null);
  assert.equal(result.journalAuthor, "");
});

test("parseJournalEntryPayload returns default payload for invalid JSON", () => {
  const result = parseJournalEntryPayload("not-json");
  assert.equal(result.journalStatus, "DRAFT");
  assert.equal(result.journalVisibility, "PRIVATE");
});

test("parseJournalEntryPayload preserves valid journalStatus", () => {
  const result = parseJournalEntryPayload(JSON.stringify({ journalStatus: "FINAL" }));
  assert.equal(result.journalStatus, "FINAL");
});

test("parseJournalEntryPayload falls back to DRAFT for invalid journalStatus", () => {
  const result = parseJournalEntryPayload(JSON.stringify({ journalStatus: "SUBMITTED" }));
  assert.equal(result.journalStatus, "DRAFT");
});

test("parseJournalEntryPayload preserves valid journalVisibility", () => {
  const result = parseJournalEntryPayload(JSON.stringify({ journalVisibility: "GUARDIAN" }));
  assert.equal(result.journalVisibility, "GUARDIAN");
});

test("parseJournalEntryPayload falls back to PRIVATE for invalid journalVisibility", () => {
  const result = parseJournalEntryPayload(JSON.stringify({ journalVisibility: "PUBLIC" }));
  assert.equal(result.journalVisibility, "PRIVATE");
});

test("parseJournalEntryPayload round-trips all fields", () => {
  const input = JSON.stringify({
    journalStatus: "ARCHIVED",
    journalVisibility: "TEAM_STAFF",
    journalDate: "2025-06-01",
    journalAuthor: "Alex Morgan",
  });
  const result = parseJournalEntryPayload(input);
  assert.equal(result.journalStatus, "ARCHIVED");
  assert.equal(result.journalVisibility, "TEAM_STAFF");
  assert.equal(result.journalDate, "2025-06-01");
  assert.equal(result.journalAuthor, "Alex Morgan");
});

// ─── serializeJournalEntryPayload ─────────────────────────────────────────────

test("serializeJournalEntryPayload round-trips through parseJournalEntryPayload", () => {
  const payload = createEmptyJournalEntryPayload();
  payload.journalStatus = "FINAL";
  payload.journalVisibility = "PROGRAM_STAFF";
  payload.journalDate = "2025-01-15";
  payload.journalAuthor = "Test Author";

  const serialized = serializeJournalEntryPayload(payload);
  const restored = parseJournalEntryPayload(serialized);

  assert.equal(restored.journalStatus, "FINAL");
  assert.equal(restored.journalVisibility, "PROGRAM_STAFF");
  assert.equal(restored.journalDate, "2025-01-15");
  assert.equal(restored.journalAuthor, "Test Author");
});

// ─── normalizeJournalPayloadVisibility ────────────────────────────────────────

test("normalizeJournalPayloadVisibility accepts all valid values", () => {
  assert.equal(normalizeJournalPayloadVisibility("PRIVATE"), "PRIVATE");
  assert.equal(normalizeJournalPayloadVisibility("GUARDIAN"), "GUARDIAN");
  assert.equal(normalizeJournalPayloadVisibility("TEAM_STAFF"), "TEAM_STAFF");
  assert.equal(normalizeJournalPayloadVisibility("PROGRAM_STAFF"), "PROGRAM_STAFF");
});

test("normalizeJournalPayloadVisibility falls back to PRIVATE for unknown values", () => {
  assert.equal(normalizeJournalPayloadVisibility("PUBLIC"), "PRIVATE");
  assert.equal(normalizeJournalPayloadVisibility(""), "PRIVATE");
  assert.equal(normalizeJournalPayloadVisibility(undefined), "PRIVATE");
  assert.equal(normalizeJournalPayloadVisibility(null), "PRIVATE");
});

// ─── normalizeJournalDateOnly ─────────────────────────────────────────────────

test("normalizeJournalDateOnly returns null for blank input", () => {
  assert.equal(normalizeJournalDateOnly(""), null);
  assert.equal(normalizeJournalDateOnly("   "), null);
  assert.equal(normalizeJournalDateOnly(null), null);
  assert.equal(normalizeJournalDateOnly(undefined), null);
});

test("normalizeJournalDateOnly returns YYYY-MM-DD string for valid date", () => {
  assert.equal(normalizeJournalDateOnly("2025-06-01"), "2025-06-01");
});

test("normalizeJournalDateOnly rejects non-date strings", () => {
  assert.equal(normalizeJournalDateOnly("June 1, 2025"), null);
  assert.equal(normalizeJournalDateOnly("2025/06/01"), null);
});

// ─── mapJournalPayloadVisibilityToEntryVisibility ─────────────────────────────

test("mapJournalPayloadVisibilityToEntryVisibility maps PRIVATE → STAFF_ONLY", () => {
  assert.equal(mapJournalPayloadVisibilityToEntryVisibility("PRIVATE"), EntryVisibility.STAFF_ONLY);
});

test("mapJournalPayloadVisibilityToEntryVisibility maps GUARDIAN → ORGANIZATION_SCOPED", () => {
  assert.equal(mapJournalPayloadVisibilityToEntryVisibility("GUARDIAN"), EntryVisibility.ORGANIZATION_SCOPED);
});

test("mapJournalPayloadVisibilityToEntryVisibility maps TEAM_STAFF → TEAM_STAFF", () => {
  assert.equal(mapJournalPayloadVisibilityToEntryVisibility("TEAM_STAFF"), EntryVisibility.TEAM_STAFF);
});

test("mapJournalPayloadVisibilityToEntryVisibility maps PROGRAM_STAFF → TEAM_STAFF (deferred: no PROGRAM_STAFF in EntryVisibility)", () => {
  // PROGRAM_STAFF is not yet in EntryVisibility enum; falls back to TEAM_STAFF until a later arc adds it.
  assert.equal(mapJournalPayloadVisibilityToEntryVisibility("PROGRAM_STAFF"), EntryVisibility.TEAM_STAFF);
});

// ─── isJournalPayloadType ─────────────────────────────────────────────────────

test("isJournalPayloadType returns true for JOURNAL entry type", () => {
  assert.equal(isJournalPayloadType(EntryType.JOURNAL), true);
});

test("isJournalPayloadType returns false for non-journal types", () => {
  assert.equal(isJournalPayloadType(EntryType.TASK), false);
  assert.equal(isJournalPayloadType(EntryType.NOTE), false);
  assert.equal(isJournalPayloadType(EntryType.DECISION), false);
  assert.equal(isJournalPayloadType(EntryType.EVENT), false);
  assert.equal(isJournalPayloadType(EntryType.HABIT), false);
});

// ─── createEmptyJournalEntryPayload ───────────────────────────────────────────

test("createEmptyJournalEntryPayload returns canonical default shape", () => {
  const payload = createEmptyJournalEntryPayload();
  assert.equal(payload.journalStatus, "DRAFT");
  assert.equal(payload.journalVisibility, "PRIVATE");
  assert.equal(payload.journalDate, null);
  assert.equal(payload.journalAuthor, "");
});


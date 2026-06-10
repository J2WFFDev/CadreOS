/**
 * Arc 22G — Entry Closeout
 *
 * Regression tests for the Entry authorization helper contract.
 * Tests the pure meetsAccessLevel helper without DB calls.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { meetsAccessLevel } from "../../lib/operational-entry/authorization";
import type { EntryAccessLevel } from "../../lib/operational-entry/authorization";

// ── meetsAccessLevel ────────────────────────────────────────────────────────

test("meetsAccessLevel: MANAGE meets all levels", () => {
  const levels: EntryAccessLevel[] = ["NONE", "READ", "WRITE", "MANAGE"];
  for (const required of levels) {
    assert.equal(
      meetsAccessLevel("MANAGE", required),
      true,
      `MANAGE should meet required level ${required}`,
    );
  }
});

test("meetsAccessLevel: WRITE meets NONE, READ, WRITE but not MANAGE", () => {
  assert.equal(meetsAccessLevel("WRITE", "NONE"), true);
  assert.equal(meetsAccessLevel("WRITE", "READ"), true);
  assert.equal(meetsAccessLevel("WRITE", "WRITE"), true);
  assert.equal(meetsAccessLevel("WRITE", "MANAGE"), false);
});

test("meetsAccessLevel: READ meets NONE and READ but not WRITE or MANAGE", () => {
  assert.equal(meetsAccessLevel("READ", "NONE"), true);
  assert.equal(meetsAccessLevel("READ", "READ"), true);
  assert.equal(meetsAccessLevel("READ", "WRITE"), false);
  assert.equal(meetsAccessLevel("READ", "MANAGE"), false);
});

test("meetsAccessLevel: NONE only meets NONE", () => {
  assert.equal(meetsAccessLevel("NONE", "NONE"), true);
  assert.equal(meetsAccessLevel("NONE", "READ"), false);
  assert.equal(meetsAccessLevel("NONE", "WRITE"), false);
  assert.equal(meetsAccessLevel("NONE", "MANAGE"), false);
});

test("meetsAccessLevel: level ordering is strictly monotone (NONE < READ < WRITE < MANAGE)", () => {
  const levels: EntryAccessLevel[] = ["NONE", "READ", "WRITE", "MANAGE"];

  // Each level should NOT meet any higher level.
  for (let i = 0; i < levels.length; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      assert.equal(
        meetsAccessLevel(levels[i], levels[j]),
        false,
        `${levels[i]} should not meet ${levels[j]}`,
      );
    }
  }

  // Each level should meet itself and all lower levels.
  for (let i = 0; i < levels.length; i++) {
    for (let j = 0; j <= i; j++) {
      assert.equal(
        meetsAccessLevel(levels[i], levels[j]),
        true,
        `${levels[i]} should meet ${levels[j]}`,
      );
    }
  }
});

// ── Access level model contract ─────────────────────────────────────────────
//
// The following tests document the expected access level for each role type
// as defined by resolveEntryAccess.  These are contract tests — they assert
// the intended behaviour without making DB calls.

test("access level model: MANAGE remains the elevated delete and restore path", () => {
  // Guardians and unauthenticated actors must not be able to delete.
  assert.equal(meetsAccessLevel("NONE", "MANAGE"), false);
  assert.equal(meetsAccessLevel("READ", "MANAGE"), false);
  assert.equal(meetsAccessLevel("WRITE", "MANAGE"), false);

  // MANAGE actors retain elevated lifecycle access. Creator self-service is
  // evaluated separately by the Entry lifecycle policy.
  assert.equal(meetsAccessLevel("MANAGE", "MANAGE"), true);
});

test("access level model: WRITE is required for create and update operations", () => {
  assert.equal(meetsAccessLevel("NONE", "WRITE"), false);
  assert.equal(meetsAccessLevel("READ", "WRITE"), false);
  assert.equal(meetsAccessLevel("WRITE", "WRITE"), true);
  assert.equal(meetsAccessLevel("MANAGE", "WRITE"), true);
});

test("access level model: READ is required for entry list and detail views", () => {
  assert.equal(meetsAccessLevel("NONE", "READ"), false);
  assert.equal(meetsAccessLevel("READ", "READ"), true);
  assert.equal(meetsAccessLevel("WRITE", "READ"), true);
  assert.equal(meetsAccessLevel("MANAGE", "READ"), true);
});

test("access level model: guardian-only actors receive NONE and are blocked from all Entry views", () => {
  // Guardian access level is NONE per resolveEntryAccess documentation.
  // NONE does not meet READ, so all views are blocked.
  const guardianAccessLevel: EntryAccessLevel = "NONE";

  assert.equal(meetsAccessLevel(guardianAccessLevel, "READ"), false, "Guardian must not access entry list");
  assert.equal(meetsAccessLevel(guardianAccessLevel, "WRITE"), false, "Guardian must not create entries");
  assert.equal(meetsAccessLevel(guardianAccessLevel, "MANAGE"), false, "Guardian must not manage entries");
});

test("access level model: unauthenticated actors receive NONE and are blocked from all Entry views", () => {
  const unauthenticatedAccessLevel: EntryAccessLevel = "NONE";

  assert.equal(meetsAccessLevel(unauthenticatedAccessLevel, "READ"), false);
  assert.equal(meetsAccessLevel(unauthenticatedAccessLevel, "WRITE"), false);
  assert.equal(meetsAccessLevel(unauthenticatedAccessLevel, "MANAGE"), false);
});

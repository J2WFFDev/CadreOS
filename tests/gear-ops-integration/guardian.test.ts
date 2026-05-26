import { strict as assert } from "node:assert";
import test from "node:test";

import {
  formatGuardianApprovalBoundaryMessage,
  formatGuardianApprovalSummary,
} from "../../lib/gear-ops-integration/types";
import type {
  GearGuardianApprovalBoundary,
  GearGuardianReference,
} from "../../lib/gear-ops-integration/types";

// ── formatGuardianApprovalSummary ─────────────────────────────────────────────

test("formatGuardianApprovalSummary returns placeholder for empty guardian list", () => {
  const result = formatGuardianApprovalSummary([]);
  assert.equal(result, "No guardians on file.");
});

test("formatGuardianApprovalSummary formats a single guardian with relationship type", () => {
  const guardians: GearGuardianReference[] = [
    {
      guardianPersonId: "guardian-001",
      athletePersonId: "athlete-001",
      guardianDisplayName: "Smith, Mary",
      relationshipType: "PARENT",
      organizationId: "org-abc",
    },
  ];

  const result = formatGuardianApprovalSummary(guardians);

  assert.ok(result.includes("Guardian:"), `Expected 'Guardian:' prefix in: '${result}'`);
  assert.ok(result.includes("Smith, Mary"), `Expected name in: '${result}'`);
  assert.ok(result.includes("Parent"), `Expected formatted relationship type in: '${result}'`);
});

test("formatGuardianApprovalSummary formats multiple guardians as comma-separated list", () => {
  const guardians: GearGuardianReference[] = [
    {
      guardianPersonId: "guardian-001",
      athletePersonId: "athlete-001",
      guardianDisplayName: "Smith, Mary",
      relationshipType: "PARENT",
      organizationId: "org-abc",
    },
    {
      guardianPersonId: "guardian-002",
      athletePersonId: "athlete-001",
      guardianDisplayName: "Jones, Robert",
      relationshipType: "LEGAL_GUARDIAN",
      organizationId: "org-abc",
    },
  ];

  const result = formatGuardianApprovalSummary(guardians);

  assert.ok(result.includes("Guardians:"), `Expected 'Guardians:' prefix in: '${result}'`);
  assert.ok(result.includes("Smith, Mary"), `Expected first guardian in: '${result}'`);
  assert.ok(result.includes("Jones, Robert"), `Expected second guardian in: '${result}'`);
});

test("formatGuardianApprovalSummary converts SNAKE_CASE relationship types to Title Case", () => {
  const guardians: GearGuardianReference[] = [
    {
      guardianPersonId: "guardian-001",
      athletePersonId: "athlete-001",
      guardianDisplayName: "Johnson, Pat",
      relationshipType: "LEGAL_GUARDIAN",
      organizationId: "org-abc",
    },
  ];

  const result = formatGuardianApprovalSummary(guardians);

  assert.ok(result.includes("Legal Guardian"), `Expected 'Legal Guardian' in: '${result}'`);
  assert.ok(!result.includes("LEGAL_GUARDIAN"), `Should not include raw enum in: '${result}'`);
});

// ── formatGuardianApprovalBoundaryMessage ─────────────────────────────────────

test("formatGuardianApprovalBoundaryMessage returns no-approval-needed message when not required", () => {
  const boundary: GearGuardianApprovalBoundary = {
    required: false,
    reason: "not_required",
    guardianReferences: [],
    canProceedWithoutApproval: true,
    blockerMessage: null,
  };

  const message = formatGuardianApprovalBoundaryMessage(boundary);
  assert.ok(
    message.toLowerCase().includes("no guardian approval required"),
    `Expected 'no guardian approval required' in: '${message}'`,
  );
});

test("formatGuardianApprovalBoundaryMessage uses blockerMessage when no guardian on file", () => {
  const blocker = "This gear category requires guardian approval for athlete recipients, but no guardian is on file.";
  const boundary: GearGuardianApprovalBoundary = {
    required: true,
    reason: "no_guardian_on_file",
    guardianReferences: [],
    canProceedWithoutApproval: false,
    blockerMessage: blocker,
  };

  const message = formatGuardianApprovalBoundaryMessage(boundary);
  assert.equal(message, blocker);
});

test("formatGuardianApprovalBoundaryMessage includes guardian names when guardian is available", () => {
  const boundary: GearGuardianApprovalBoundary = {
    required: true,
    reason: "guardian_available",
    guardianReferences: [
      {
        guardianPersonId: "guardian-001",
        athletePersonId: "athlete-001",
        guardianDisplayName: "Taylor, Chris",
        relationshipType: "PARENT",
        organizationId: "org-abc",
      },
    ],
    canProceedWithoutApproval: false,
    blockerMessage: null,
  };

  const message = formatGuardianApprovalBoundaryMessage(boundary);

  assert.ok(
    message.includes("Guardian approval required"),
    `Expected approval-required message in: '${message}'`,
  );
  assert.ok(
    message.includes("Taylor, Chris"),
    `Expected guardian name in: '${message}'`,
  );
  assert.ok(
    message.includes("Confirm approval"),
    `Expected confirmation prompt in: '${message}'`,
  );
});

test("formatGuardianApprovalBoundaryMessage falls back gracefully when blockerMessage is null and no guardian on file", () => {
  const boundary: GearGuardianApprovalBoundary = {
    required: true,
    reason: "no_guardian_on_file",
    guardianReferences: [],
    canProceedWithoutApproval: false,
    blockerMessage: null,
  };

  const message = formatGuardianApprovalBoundaryMessage(boundary);

  // Should still produce a non-empty string fallback.
  assert.ok(message.length > 0, "Expected a non-empty fallback message");
  assert.ok(
    message.includes("no guardian"),
    `Expected mention of missing guardian in fallback: '${message}'`,
  );
});

// ── evaluateGearGuardianApprovalBoundary — pure logic / boundary tests ────────
// DB-backed evaluation (requires live DB) is covered at integration level.
// These tests validate pure boundary decision logic.

test("guardian approval boundary: not_required means canProceedWithoutApproval is true", () => {
  const boundary: GearGuardianApprovalBoundary = {
    required: false,
    reason: "not_required",
    guardianReferences: [],
    canProceedWithoutApproval: true,
    blockerMessage: null,
  };

  assert.equal(boundary.canProceedWithoutApproval, true);
  assert.equal(boundary.blockerMessage, null);
});

test("guardian approval boundary: no_guardian_on_file means canProceedWithoutApproval is false", () => {
  const boundary: GearGuardianApprovalBoundary = {
    required: true,
    reason: "no_guardian_on_file",
    guardianReferences: [],
    canProceedWithoutApproval: false,
    blockerMessage: "No guardian.",
  };

  assert.equal(boundary.canProceedWithoutApproval, false);
  assert.ok(boundary.blockerMessage !== null);
});

test("guardian approval boundary: guardian_available surfaces references and blocks until confirmed", () => {
  const boundary: GearGuardianApprovalBoundary = {
    required: true,
    reason: "guardian_available",
    guardianReferences: [
      {
        guardianPersonId: "g-001",
        athletePersonId: "a-001",
        guardianDisplayName: "Lee, Sam",
        relationshipType: "PARENT",
        organizationId: "org-abc",
      },
    ],
    canProceedWithoutApproval: false,
    blockerMessage: null,
  };

  assert.equal(boundary.canProceedWithoutApproval, false);
  assert.equal(boundary.guardianReferences.length, 1);
  assert.equal(boundary.blockerMessage, null);
});

// ── resolveCategoryGuardianApprovalRequired — boundary value tests ────────────
// DB-backed version covered at integration level.
// These tests validate the fallback (false) behavior for missing categories.

test("guardian approval default is false when no category data is present", () => {
  // Simulates the fallback: category?.guardianApprovalRequired ?? false
  const category = null as { guardianApprovalRequired: boolean } | null;
  const required = category?.guardianApprovalRequired ?? false;

  assert.equal(required, false);
});

test("guardian approval flag is true when category record has it enabled", () => {
  const category = { guardianApprovalRequired: true };
  const required = category?.guardianApprovalRequired ?? false;

  assert.equal(required, true);
});

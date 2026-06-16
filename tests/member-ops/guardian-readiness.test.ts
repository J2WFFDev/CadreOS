/**
 * tests/member-ops/guardian-readiness.test.ts
 *
 * Arc 21C — Guardian / Household Readiness
 *
 * Unit tests for pure (non-DB) guardian readiness and access control logic.
 * All tests use pre-loaded relationship data and require no database connection.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  canGuardianSeeAthleteFromLinks,
  deriveAthleteGuardianReadinessState,
  formatAthleteGuardianReadinessLabel,
  hasAthleteGuardianCoverage,
  isGuardianReadinessActionRequired,
  isMissingActiveGuardianCoverage,
} from "../../lib/guardian-athlete-access";
import {
  deriveGuardianOperationalContext,
  formatGuardianFollowUpDependency,
  formatGuardianOperationalIndicator,
} from "../../lib/guardian-operational-context";
import {
  isAthleteRoleType,
  isGuardianRoleType,
  MEMBEROPS_NAMING_RULES,
} from "../../lib/member-ops";

// ── Naming rules ──────────────────────────────────────────────────────────────

test("memberops naming rules include guardian definition", () => {
  assert.match(MEMBEROPS_NAMING_RULES.guardian, /AthleteGuardianRelationship/);
  assert.match(MEMBEROPS_NAMING_RULES.guardian, /Not a separate user type/);
});

test("memberops naming rules include athlete definition", () => {
  assert.match(MEMBEROPS_NAMING_RULES.athlete, /context-specific member function/i);
  assert.match(MEMBEROPS_NAMING_RULES.athlete, /Not a separate identity model/);
});

test("memberops naming rules include household definition that defers to pairwise relationship", () => {
  assert.match(MEMBEROPS_NAMING_RULES.household, /AthleteGuardianRelationship/);
  assert.match(MEMBEROPS_NAMING_RULES.household, /No separate household entity/);
});

// ── Role predicates ───────────────────────────────────────────────────────────

test("isGuardianRoleType returns true only for PARENT_GUARDIAN", () => {
  assert.equal(isGuardianRoleType("PARENT_GUARDIAN"), true);
  assert.equal(isGuardianRoleType("ATHLETE"), false);
  assert.equal(isGuardianRoleType("COACH"), false);
  assert.equal(isGuardianRoleType("ORGANIZATION_ADMIN"), false);
});

test("isAthleteRoleType returns true only for ATHLETE", () => {
  assert.equal(isAthleteRoleType("ATHLETE"), true);
  assert.equal(isAthleteRoleType("PARENT_GUARDIAN"), false);
  assert.equal(isAthleteRoleType("COACH"), false);
  assert.equal(isAthleteRoleType("ORGANIZATION_ADMIN"), false);
});

// ── canGuardianSeeAthleteFromLinks ────────────────────────────────────────────

test("canGuardianSeeAthleteFromLinks returns true when link exists", () => {
  const links = [
    { guardianPersonId: "g-001", athletePersonId: "a-001" },
    { guardianPersonId: "g-001", athletePersonId: "a-002" },
  ];

  assert.equal(canGuardianSeeAthleteFromLinks("g-001", "a-001", links), true);
  assert.equal(canGuardianSeeAthleteFromLinks("g-001", "a-002", links), true);
});

test("canGuardianSeeAthleteFromLinks returns false when guardian has no links", () => {
  const links = [{ guardianPersonId: "g-001", athletePersonId: "a-001" }];

  assert.equal(canGuardianSeeAthleteFromLinks("g-002", "a-001", links), false);
});

test("canGuardianSeeAthleteFromLinks returns false when athlete is not linked to guardian", () => {
  const links = [{ guardianPersonId: "g-001", athletePersonId: "a-001" }];

  assert.equal(canGuardianSeeAthleteFromLinks("g-001", "a-999", links), false);
});

test("canGuardianSeeAthleteFromLinks returns false for empty link list", () => {
  assert.equal(canGuardianSeeAthleteFromLinks("g-001", "a-001", []), false);
});

test("canGuardianSeeAthleteFromLinks does not allow cross-guardian access", () => {
  const links = [
    { guardianPersonId: "g-001", athletePersonId: "a-001" },
    { guardianPersonId: "g-002", athletePersonId: "a-002" },
  ];

  // g-001 can see a-001 but not a-002
  assert.equal(canGuardianSeeAthleteFromLinks("g-001", "a-001", links), true);
  assert.equal(canGuardianSeeAthleteFromLinks("g-001", "a-002", links), false);

  // g-002 can see a-002 but not a-001
  assert.equal(canGuardianSeeAthleteFromLinks("g-002", "a-002", links), true);
  assert.equal(canGuardianSeeAthleteFromLinks("g-002", "a-001", links), false);
});

// ── hasAthleteGuardianCoverage ────────────────────────────────────────────────

test("hasAthleteGuardianCoverage returns true when athlete has at least one guardian link", () => {
  assert.equal(
    hasAthleteGuardianCoverage([{ guardianPersonId: "g-001" }]),
    true,
  );
});

test("hasAthleteGuardianCoverage returns false when athlete has no guardian links", () => {
  assert.equal(hasAthleteGuardianCoverage([]), false);
});

// ── isMissingActiveGuardianCoverage ──────────────────────────────────────────

test("isMissingActiveGuardianCoverage returns true for empty links", () => {
  assert.equal(isMissingActiveGuardianCoverage([]), true);
});

test("isMissingActiveGuardianCoverage returns true when all guardians lack user accounts", () => {
  const links = [
    { guardian: { _count: { userAccounts: 0 }, roles: [] } },
    { guardian: { _count: { userAccounts: 0 }, roles: [] } },
  ];

  assert.equal(isMissingActiveGuardianCoverage(links), true);
});

test("isMissingActiveGuardianCoverage returns true when all linked accounts have no guardian role", () => {
  const links = [
    { guardian: { _count: { userAccounts: 1 }, roles: [] } },
  ];

  assert.equal(isMissingActiveGuardianCoverage(links), true);
});

test("isMissingActiveGuardianCoverage returns false when at least one guardian is fully active", () => {
  const links = [
    { guardian: { _count: { userAccounts: 0 }, roles: [] } },
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-1" }] } },
  ];

  assert.equal(isMissingActiveGuardianCoverage(links), false);
});

// ── deriveAthleteGuardianReadinessState ───────────────────────────────────────

test("deriveAthleteGuardianReadinessState returns no_guardian_on_file for empty links", () => {
  assert.equal(deriveAthleteGuardianReadinessState([]), "no_guardian_on_file");
});

test("deriveAthleteGuardianReadinessState returns guardian_account_link_missing when account absent", () => {
  const links = [
    { guardian: { _count: { userAccounts: 0 }, roles: [] } },
  ];

  assert.equal(
    deriveAthleteGuardianReadinessState(links),
    "guardian_account_link_missing",
  );
});

test("deriveAthleteGuardianReadinessState returns guardian_account_inactive_signal when account exists but no roles", () => {
  const links = [
    { guardian: { _count: { userAccounts: 1 }, roles: [] } },
  ];

  assert.equal(
    deriveAthleteGuardianReadinessState(links),
    "guardian_account_inactive_signal",
  );
});

test("deriveAthleteGuardianReadinessState returns guardian_ready when account and role exist", () => {
  const links = [
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-1" }] } },
  ];

  assert.equal(deriveAthleteGuardianReadinessState(links), "guardian_ready");
});

test("deriveAthleteGuardianReadinessState returns account_link_missing if any guardian lacks account even with other ready guardians", () => {
  // Partial coverage does not make the athlete fully ready if any gap exists.
  const links = [
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-1" }] } },
    { guardian: { _count: { userAccounts: 0 }, roles: [] } },
  ];

  assert.equal(
    deriveAthleteGuardianReadinessState(links),
    "guardian_account_link_missing",
  );
});

// ── formatAthleteGuardianReadinessLabel ───────────────────────────────────────

test("formatAthleteGuardianReadinessLabel produces non-empty label for each state", () => {
  const states = [
    "no_guardian_on_file",
    "guardian_account_link_missing",
    "guardian_account_inactive_signal",
    "guardian_ready",
  ] as const;

  for (const state of states) {
    const label = formatAthleteGuardianReadinessLabel(state);
    assert.ok(label.length > 0, `Expected non-empty label for state: ${state}`);
  }
});

test("formatAthleteGuardianReadinessLabel for guardian_ready indicates positive state", () => {
  const label = formatAthleteGuardianReadinessLabel("guardian_ready");
  assert.match(label, /Guardian/i);
  assert.match(label, /ready/i);
});

// ── isGuardianReadinessActionRequired ─────────────────────────────────────────

test("isGuardianReadinessActionRequired returns false only for guardian_ready", () => {
  assert.equal(isGuardianReadinessActionRequired("guardian_ready"), false);
  assert.equal(isGuardianReadinessActionRequired("no_guardian_on_file"), true);
  assert.equal(
    isGuardianReadinessActionRequired("guardian_account_link_missing"),
    true,
  );
  assert.equal(
    isGuardianReadinessActionRequired("guardian_account_inactive_signal"),
    true,
  );
});

// ── deriveGuardianOperationalContext (from guardian-operational-context) ──────

test("deriveGuardianOperationalContext flags hasNoGuardianOnFile for empty relationships", () => {
  const ctx = deriveGuardianOperationalContext([]);

  assert.equal(ctx.hasNoGuardianOnFile, true);
  assert.equal(ctx.hasGuardianRelationship, false);
  assert.equal(ctx.linkedGuardianCount, 0);
});

test("deriveGuardianOperationalContext counts Guardians correctly", () => {
  const relationships = [
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-1" }] } },
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-2" }] } },
  ];

  const ctx = deriveGuardianOperationalContext(relationships);

  assert.equal(ctx.linkedGuardianCount, 2);
  assert.equal(ctx.hasGuardianRelationship, true);
  assert.equal(ctx.hasNoGuardianOnFile, false);
});

test("deriveGuardianOperationalContext detects missing account link", () => {
  const relationships = [
    { guardian: { _count: { userAccounts: 0 }, roles: [] } },
  ];

  const ctx = deriveGuardianOperationalContext(relationships);

  assert.equal(ctx.missingGuardianAccountLinkCount, 1);
  assert.equal(ctx.hasIncompleteRelationshipSupport, true);
});

test("deriveGuardianOperationalContext detects inactive account signal", () => {
  const relationships = [
    { guardian: { _count: { userAccounts: 1 }, roles: [] } },
  ];

  const ctx = deriveGuardianOperationalContext(relationships);

  assert.equal(ctx.inactiveGuardianAccountSignalCount, 1);
  assert.equal(ctx.hasInactiveGuardianAccountSignal, true);
  assert.equal(ctx.hasIncompleteRelationshipSupport, true);
});

// ── formatGuardianOperationalIndicator ───────────────────────────────────────

test("formatGuardianOperationalIndicator returns no guardian label for empty context", () => {
  const ctx = deriveGuardianOperationalContext([]);
  const label = formatGuardianOperationalIndicator(ctx);

  assert.match(label, /No guardian on file/i);
});

test("formatGuardianOperationalIndicator returns Related athlete for fully ready context", () => {
  const relationships = [
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-1" }] } },
  ];
  const ctx = deriveGuardianOperationalContext(relationships);
  const label = formatGuardianOperationalIndicator(ctx);

  assert.match(label, /Related athlete/i);
});

// ── formatGuardianFollowUpDependency ─────────────────────────────────────────

test("formatGuardianFollowUpDependency returns blocked message for no guardian context", () => {
  const ctx = deriveGuardianOperationalContext([]);
  const message = formatGuardianFollowUpDependency(ctx);

  assert.match(message, /blocked/i);
});

test("formatGuardianFollowUpDependency mentions guardian involvement for ready context", () => {
  const relationships = [
    { guardian: { _count: { userAccounts: 1 }, roles: [{ id: "role-1" }] } },
  ];
  const ctx = deriveGuardianOperationalContext(relationships);
  const message = formatGuardianFollowUpDependency(ctx);

  assert.match(message, /guardian/i);
});

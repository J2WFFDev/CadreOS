import { strict as assert } from "node:assert";
import test from "node:test";

import { MemberLifecycleStatus } from "@prisma/client";

import { deriveMemberRosterReadiness } from "../../lib/member-ops-roster-readiness";

test("deriveMemberRosterReadiness marks active athlete with complete setup as ready", () => {
  const readiness = deriveMemberRosterReadiness({
    lifecycleStatus: MemberLifecycleStatus.ACTIVE,
    roleTypes: ["ATHLETE"],
    rosterRoles: ["ATHLETE"],
    membershipCount: 1,
    athleteGuardianLinkCount: 1,
    hasProgramAssignment: true,
    hasSeasonAssignment: true,
    hasProfileEmail: true,
  });

  assert.equal(readiness.needsAttention, false);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.rolloverReady, true);
  assert.equal(readiness.rolloverNeedsReview, false);
  assert.deepEqual(readiness.labels, []);
});

test("deriveMemberRosterReadiness marks missing guardian and assignments as attention required", () => {
  const readiness = deriveMemberRosterReadiness({
    lifecycleStatus: MemberLifecycleStatus.ACTIVE,
    roleTypes: ["ATHLETE"],
    rosterRoles: ["ATHLETE"],
    membershipCount: 0,
    athleteGuardianLinkCount: 0,
    hasProgramAssignment: false,
    hasSeasonAssignment: false,
    hasProfileEmail: true,
  });

  assert.equal(readiness.needsAttention, true);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.onboardingIncomplete, true);
  assert.equal(readiness.rolloverNeedsReview, true);
  assert.equal(readiness.missingGuardian, true);
  assert.equal(readiness.missingTeamAssignment, true);
  assert.equal(readiness.missingProgramAssignment, true);
  assert.equal(readiness.missingSeasonAssignment, true);
});

test("deriveMemberRosterReadiness flags non-default lifecycle as attention required", () => {
  const readiness = deriveMemberRosterReadiness({
    lifecycleStatus: MemberLifecycleStatus.ARCHIVED,
    roleTypes: ["COACH"],
    rosterRoles: [],
    membershipCount: 0,
    athleteGuardianLinkCount: 0,
    hasProgramAssignment: true,
    hasSeasonAssignment: false,
    hasProfileEmail: true,
  });

  assert.equal(readiness.needsAttention, true);
  assert.equal(readiness.labels.includes("Inactive/archived lifecycle"), true);
  assert.equal(readiness.offboardingActionRecommended, false);
});

test("deriveMemberRosterReadiness marks incomplete profile when email or roles are missing", () => {
  const readiness = deriveMemberRosterReadiness({
    lifecycleStatus: MemberLifecycleStatus.PROSPECT,
    roleTypes: [],
    rosterRoles: [],
    membershipCount: 0,
    athleteGuardianLinkCount: 0,
    hasProgramAssignment: false,
    hasSeasonAssignment: false,
    hasProfileEmail: false,
  });

  assert.equal(readiness.incompleteProfile, true);
  assert.equal(readiness.labels.includes("Incomplete profile"), true);
  assert.equal(readiness.labels.includes("Onboarding incomplete"), true);
});

test("deriveMemberRosterReadiness marks non-operational member with roster history for offboarding review", () => {
  const readiness = deriveMemberRosterReadiness({
    lifecycleStatus: MemberLifecycleStatus.INACTIVE,
    roleTypes: ["ATHLETE"],
    rosterRoles: ["ATHLETE"],
    membershipCount: 1,
    athleteGuardianLinkCount: 1,
    hasProgramAssignment: true,
    hasSeasonAssignment: true,
    hasProfileEmail: true,
  });

  assert.equal(readiness.offboardingActionRecommended, true);
  assert.equal(readiness.labels.includes("Offboarding review needed"), true);
  assert.equal(readiness.rolloverReady, false);
});

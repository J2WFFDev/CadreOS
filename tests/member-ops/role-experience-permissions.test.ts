import { strict as assert } from "node:assert";
import test from "node:test";

import { GuardianRelationshipRole, MemberLifecycleStatus, RoleType } from "@prisma/client";

import { canAccessModule, canPerformAction } from "../../lib/auth/access-control";
import type { AppRole, CurrentUser } from "../../lib/auth/current-user-types";
import { canGuardianSeeAthleteFromLinks } from "../../lib/guardian-athlete-access";
import { DEFAULT_STAFFING_ROLE_DEFINITIONS } from "../../lib/member-ops-staffing";
import {
  actionRequiresBackendScope,
  actionRequiresProgramBackendScope,
  canRoleTypePerformBackendAction,
} from "../../lib/permissions";

function buildUser(role: AppRole): CurrentUser {
  return {
    id: `arc26e-${role.toLowerCase()}`,
    name: role,
    roles: [role],
    activeRole: role,
    isDevPersona: true,
  };
}

test("Arc 26E role matrix: MemberOps module visibility matches supported auth roles", () => {
  const expectedVisibility: Record<AppRole, boolean> = {
    ADMIN: true,
    PROGRAM_MANAGER: true,
    COACH: true,
    ASSISTANT_COACH: false,
    GUARDIAN: false,
    ATHLETE: false,
    LIMITED_VIEWER: false,
  };

  for (const [role, expected] of Object.entries(expectedVisibility) as Array<[AppRole, boolean]>) {
    assert.equal(canAccessModule(buildUser(role), "memberOps"), expected, `Unexpected memberOps visibility for ${role}`);
  }
});

test("Arc 26E permission validation: athlete and guardian cannot access admin/member mutation actions", () => {
  const blockedActions = [
    "person.create",
    "person.update",
    "guardianRelationship.create",
    "qualificationDefinition.create",
    "roleAssignment.create",
    "booking.approve",
  ];

  for (const role of ["ATHLETE", "GUARDIAN"] as const) {
    const user = buildUser(role);
    for (const action of blockedActions) {
      assert.equal(canPerformAction(user, action), false, `${role} should not be able to ${action}`);
    }
  }
});

test("Arc 26E permission validation: coach is scoped for operational actions but blocked from admin creates", () => {
  const coach = buildUser("COACH");

  ["person.activate", "personQualification.create", "personCertification.update", "rosterMembership.create"].forEach((action) => {
    assert.equal(canPerformAction(coach, action), true, `Coach should be able to ${action}`);
  });

  ["program.create", "qualificationDefinition.create", "booking.approve"].forEach((action) => {
    assert.equal(canPerformAction(coach, action), false, `Coach should not be able to ${action}`);
  });
});

test("ARC-MEMBER-02: app-role helper and backend matrix align for member qualification assignments", () => {
  const assignmentActions = [
    "personQualification.create",
    "personQualification.update",
    "personCertification.create",
    "personCertification.update",
  ];
  const alignedRoles: Array<[AppRole, RoleType]> = [
    ["ADMIN", RoleType.ORGANIZATION_ADMIN],
    ["PROGRAM_MANAGER", RoleType.PROGRAM_DIRECTOR],
    ["COACH", RoleType.COACH],
    ["GUARDIAN", RoleType.PARENT_GUARDIAN],
    ["ATHLETE", RoleType.ATHLETE],
  ];

  for (const [appRole, backendRole] of alignedRoles) {
    const user = buildUser(appRole);
    for (const action of assignmentActions) {
      assert.equal(
        canPerformAction(user, action),
        canRoleTypePerformBackendAction(backendRole, action),
        `${appRole} helper and ${backendRole} backend policy should agree for ${action}`,
      );
    }
  }

  const limitedViewer = buildUser("LIMITED_VIEWER");
  for (const action of assignmentActions) {
    assert.equal(canPerformAction(limitedViewer, action), false, `LIMITED_VIEWER should not be able to ${action}`);
  }
});

test("ARC-MEMBER-02: qualification assignment mutations are scoped backend actions", () => {
  const assignmentActions = [
    "personQualification.create",
    "personQualification.update",
    "personCertification.create",
    "personCertification.update",
  ];

  for (const action of assignmentActions) {
    assert.equal(actionRequiresBackendScope(action), true, `${action} should require resolved program/team scope`);
  }

  assert.equal(
    canRoleTypePerformBackendAction(RoleType.COACH, "qualificationDefinition.create"),
    false,
    "Coach should not create qualification definitions",
  );
  assert.equal(
    canRoleTypePerformBackendAction(RoleType.PARENT_GUARDIAN, "personQualification.create"),
    false,
    "Guardian should not mutate person qualifications",
  );
  assert.equal(
    canRoleTypePerformBackendAction(RoleType.ATHLETE, "personCertification.update"),
    false,
    "Athlete should not mutate person certifications",
  );
});

test("ARC-MEMBER-09: program participation mutation policy aligns app helper and backend matrix", () => {
  const participationActions = [
    "programParticipation.create",
    "programParticipation.update",
    "programParticipation.status.update",
  ];
  const alignedRoles: Array<[AppRole, RoleType]> = [
    ["ADMIN", RoleType.ORGANIZATION_ADMIN],
    ["PROGRAM_MANAGER", RoleType.PROGRAM_DIRECTOR],
    ["COACH", RoleType.COACH],
    ["GUARDIAN", RoleType.PARENT_GUARDIAN],
    ["ATHLETE", RoleType.ATHLETE],
  ];

  for (const action of participationActions) {
    assert.equal(actionRequiresBackendScope(action), true, `${action} should require scoped backend authorization`);
    assert.equal(actionRequiresProgramBackendScope(action), true, `${action} should require explicit program scope`);
  }

  for (const [appRole, backendRole] of alignedRoles) {
    const user = buildUser(appRole);
    for (const action of participationActions) {
      assert.equal(
        canPerformAction(user, action),
        canRoleTypePerformBackendAction(backendRole, action),
        `${appRole} helper and ${backendRole} backend policy should agree for ${action}`,
      );
    }
  }

  const limitedViewer = buildUser("LIMITED_VIEWER");
  for (const action of participationActions) {
    assert.equal(canPerformAction(limitedViewer, action), false, `LIMITED_VIEWER should not be able to ${action}`);
  }
});

test("Arc 26E permission validation: program and organization admins retain required memberops authority", () => {
  const programAdmin = buildUser("PROGRAM_MANAGER");
  const orgAdmin = buildUser("ADMIN");

  const requiredActions = [
    "person.create",
    "person.update",
    "guardianRelationship.create",
    "qualificationDefinition.create",
    "roleAssignment.create",
    "booking.approve",
  ];

  for (const action of requiredActions) {
    assert.equal(canPerformAction(programAdmin, action), true, `Program admin should be able to ${action}`);
    assert.equal(canPerformAction(orgAdmin, action), true, `Organization admin should be able to ${action}`);
  }
});

test("Arc 26E household validation: Guardians are limited to related athletes and support multi-guardian relationships", () => {
  const links = [
    { guardianPersonId: "guardian-1", athletePersonId: "athlete-1" },
    { guardianPersonId: "guardian-2", athletePersonId: "athlete-1" },
    { guardianPersonId: "guardian-2", athletePersonId: "athlete-2" },
  ];

  assert.equal(canGuardianSeeAthleteFromLinks("guardian-1", "athlete-1", links), true);
  assert.equal(canGuardianSeeAthleteFromLinks("guardian-2", "athlete-1", links), true);
  assert.equal(canGuardianSeeAthleteFromLinks("guardian-1", "athlete-2", links), false);
});

test("Arc 26E lifecycle validation: required member lifecycle states exist", () => {
  const lifecycleStates = new Set(Object.values(MemberLifecycleStatus));

  ["PROSPECT", "APPLICANT", "ACTIVE", "INACTIVE", "ALUMNI", "FORMER"].forEach((status) => {
    assert.equal(lifecycleStates.has(status as MemberLifecycleStatus), true, `${status} must exist in lifecycle enum`);
  });
});

test("Arc 26E qualification and staffing validation: seeded staffing roles include volunteer, coach, board, and admin assignments", () => {
  const roleNames = new Set(DEFAULT_STAFFING_ROLE_DEFINITIONS.map((role) => role.name));

  ["Coach", "Volunteer", "Board Member", "Program Admin", "Organization Admin", "GearOps Staff"].forEach((roleName) => {
    assert.equal(roleNames.has(roleName), true, `${roleName} should be present in staffing seed definitions`);
  });
});

test("Arc 26E household validation: emergency contact relationship role remains available", () => {
  assert.equal(GuardianRelationshipRole.EMERGENCY_CONTACT, "EMERGENCY_CONTACT");
});

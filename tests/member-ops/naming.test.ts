import { strict as assert } from "node:assert";
import test from "node:test";

import { MemberLifecycleStatus, RoleType } from "@prisma/client";

import {
  isRosterRoleType,
  isStaffRoleType,
  isTeamScopedRoleType,
  isDefaultVisibleMemberLifecycleStatus,
  MEMBER_LIFECYCLE_DEFAULT_VISIBLE_STATUSES,
  MEMBER_LIFECYCLE_STATUS_LABELS,
  MEMBEROPS_NAMING_RULES,
  MEMBEROPS_ROSTER_ROLE_TYPES,
  MEMBEROPS_TEAM_ROLE_TYPES,
} from "../../lib/member-ops";
import { memberMoveWorkflowSchema, rosterMembershipWorkflowSchema } from "../../lib/workflows";

test("memberops naming rules distinguish user, person, member, and membership", () => {
  assert.match(MEMBEROPS_NAMING_RULES.user, /login\/auth/i);
  assert.match(MEMBEROPS_NAMING_RULES.person, /canonical human identity/i);
  assert.match(MEMBEROPS_NAMING_RULES.member, /participating in the organization/i);
  assert.match(MEMBEROPS_NAMING_RULES.membership, /team and season/i);
});

test("roster role guard only allows roster-safe role types", () => {
  assert.deepEqual(MEMBEROPS_ROSTER_ROLE_TYPES, [
    RoleType.ATHLETE,
    RoleType.COACH,
    RoleType.ASSISTANT_COACH,
    RoleType.PARENT_GUARDIAN,
  ]);
  assert.equal(isRosterRoleType(RoleType.ORGANIZATION_ADMIN), false);
  assert.equal(isRosterRoleType(RoleType.PROGRAM_DIRECTOR), false);
  assert.equal(isRosterRoleType(RoleType.ATHLETE), true);
});

test("team role guard excludes organization and program admin role types", () => {
  assert.deepEqual(MEMBEROPS_TEAM_ROLE_TYPES, [
    RoleType.ATHLETE,
    RoleType.COACH,
    RoleType.ASSISTANT_COACH,
    RoleType.PARENT_GUARDIAN,
  ]);
  assert.equal(isTeamScopedRoleType(RoleType.ORGANIZATION_ADMIN), false);
  assert.equal(isTeamScopedRoleType(RoleType.PROGRAM_DIRECTOR), false);
  assert.equal(isTeamScopedRoleType(RoleType.COACH), true);
});

test("staff role guard keeps guardian and athlete roles out of staff-only logic", () => {
  assert.equal(isStaffRoleType(RoleType.ORGANIZATION_ADMIN), true);
  assert.equal(isStaffRoleType(RoleType.PROGRAM_DIRECTOR), true);
  assert.equal(isStaffRoleType(RoleType.PARENT_GUARDIAN), false);
  assert.equal(isStaffRoleType(RoleType.ATHLETE), false);
});

test("roster membership workflow rejects non-roster role types", () => {
  const parsed = rosterMembershipWorkflowSchema.safeParse({
    personId: "person-1",
    seasonId: "season-1",
    rosterRole: RoleType.ORGANIZATION_ADMIN,
  });

  assert.equal(parsed.success, false);
});

test("member move workflow accepts valid roster role types", () => {
  const parsed = memberMoveWorkflowSchema.safeParse({
    sourceMembershipId: "membership-1",
    programId: "program-1",
    teamId: "team-1",
    seasonId: "season-1",
    rosterRole: RoleType.ATHLETE,
  });

  assert.equal(parsed.success, true);
});

test("lifecycle labels use pending/graduated language", () => {
  assert.equal(MEMBER_LIFECYCLE_STATUS_LABELS[MemberLifecycleStatus.PROSPECT], "Pending");
  assert.equal(MEMBER_LIFECYCLE_STATUS_LABELS[MemberLifecycleStatus.ALUMNI], "Graduated");
});

test("default roster visibility includes active and pending only", () => {
  assert.deepEqual(MEMBER_LIFECYCLE_DEFAULT_VISIBLE_STATUSES, [
    MemberLifecycleStatus.ACTIVE,
    MemberLifecycleStatus.PROSPECT,
  ]);
  assert.equal(isDefaultVisibleMemberLifecycleStatus(MemberLifecycleStatus.ACTIVE), true);
  assert.equal(isDefaultVisibleMemberLifecycleStatus(MemberLifecycleStatus.PROSPECT), true);
  assert.equal(isDefaultVisibleMemberLifecycleStatus(MemberLifecycleStatus.INACTIVE), false);
  assert.equal(isDefaultVisibleMemberLifecycleStatus(MemberLifecycleStatus.ARCHIVED), false);
  assert.equal(isDefaultVisibleMemberLifecycleStatus(MemberLifecycleStatus.ALUMNI), false);
});

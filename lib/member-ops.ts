import { MemberLifecycleStatus, RoleType } from "@prisma/client";

export const MEMBER_LIFECYCLE_STATUS_LABELS: Record<MemberLifecycleStatus, string> = {
  [MemberLifecycleStatus.PROSPECT]: "Prospect (pending activation)",
  [MemberLifecycleStatus.ACTIVE]: "Active",
  [MemberLifecycleStatus.INACTIVE]: "Inactive",
  [MemberLifecycleStatus.ARCHIVED]: "Archived",
  [MemberLifecycleStatus.ALUMNI]: "Alumni",
};

export const MEMBEROPS_STAFF_ROLE_TYPES = [
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
] as const;

export const MEMBEROPS_TEAM_ROLE_TYPES = [
  RoleType.ATHLETE,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
  RoleType.PARENT_GUARDIAN,
] as const;

export const MEMBEROPS_ROSTER_ROLE_TYPES = [
  RoleType.ATHLETE,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
  RoleType.PARENT_GUARDIAN,
] as const;

export type MemberOpsStaffRoleType = (typeof MEMBEROPS_STAFF_ROLE_TYPES)[number];
export type MemberOpsTeamRoleType = (typeof MEMBEROPS_TEAM_ROLE_TYPES)[number];
export type MemberOpsRosterRoleType = (typeof MEMBEROPS_ROSTER_ROLE_TYPES)[number];

const staffRoleTypeSet = new Set<RoleType>(MEMBEROPS_STAFF_ROLE_TYPES);
const teamRoleTypeSet = new Set<RoleType>(MEMBEROPS_TEAM_ROLE_TYPES);
const rosterRoleTypeSet = new Set<RoleType>(MEMBEROPS_ROSTER_ROLE_TYPES);

export function isStaffRoleType(roleType: RoleType | string): roleType is MemberOpsStaffRoleType {
  return staffRoleTypeSet.has(roleType as RoleType);
}

export function isTeamScopedRoleType(roleType: RoleType | string): roleType is MemberOpsTeamRoleType {
  return teamRoleTypeSet.has(roleType as RoleType);
}

export function isRosterRoleType(roleType: RoleType | string): roleType is MemberOpsRosterRoleType {
  return rosterRoleTypeSet.has(roleType as RoleType);
}

export const MEMBEROPS_NAMING_RULES = {
  user: "User = login/auth account represented by UserAccount.",
  person: "Person = canonical human identity/profile represented by Person.",
  member: "Member = person participating in the organization through lifecycle, role, or roster context.",
  membership: "Membership = person's relationship to a team and season represented by RosterMembership.",
  role: "Role = what a person can do or see in a scoped context, represented by RoleAssignment or rosterRole.",
  roster: "Roster = filtered operational view of memberships, not a separate person model.",
  athlete:
    "Athlete = context-specific member function for persons with guardian-linked or roster-role context. Not a separate identity model.",
  guardian:
    "Guardian = context-specific role/relationship function for persons linked to athletes via AthleteGuardianRelationship. Not a separate user type.",
  household:
    "Household = informal grouping concept. Use AthleteGuardianRelationship (pairwise) as the data model. No separate household entity exists in Release 1.",
} as const;

export function isGuardianRoleType(roleType: RoleType | string): boolean {
  return roleType === RoleType.PARENT_GUARDIAN;
}

export function isAthleteRoleType(roleType: RoleType | string): boolean {
  return roleType === RoleType.ATHLETE;
}

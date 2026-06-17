import type { AppRole, CurrentUser } from "@/lib/auth/current-user-types";

export type ModuleKey =
  | "dashboard"
  | "memberOps"
  | "entry"
  | "journal"
  | "gearOps"
  | "fieldOps"
  | "resourceOps"
  | "admin"
  | "audit";

export type ActionKey = string;

export type ModuleAccessDefinition = {
  key: ModuleKey;
  label: string;
  path: string;
  allowedRoles: readonly AppRole[];
};

const STAFF_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH"];
const COACH_PLUS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH"];
const MEMBEROPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH"];
const WORKOPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH", "GUARDIAN", "ATHLETE"];
const FIELDOPS_RESOURCEOPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH"];
const GEAROPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH", "GUARDIAN", "ATHLETE"];

export const MODULE_ACCESS_MAP: Record<ModuleKey, ModuleAccessDefinition> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    allowedRoles: ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH", "GUARDIAN", "ATHLETE", "LIMITED_VIEWER"],
  },
  memberOps: {
    key: "memberOps",
    label: "MemberOps",
    path: "/programs",
    allowedRoles: MEMBEROPS_ROLES,
  },
  entry: {
    key: "entry",
    label: "EntryOps",
    path: "/entries",
    allowedRoles: WORKOPS_ROLES,
  },
  journal: {
    key: "journal",
    label: "Journal",
    path: "/journals",
    allowedRoles: WORKOPS_ROLES,
  },
  gearOps: {
    key: "gearOps",
    label: "GearOps",
    path: "/gear-ops",
    allowedRoles: GEAROPS_ROLES,
  },
  fieldOps: {
    key: "fieldOps",
    label: "FieldOps",
    path: "/field-ops",
    allowedRoles: FIELDOPS_RESOURCEOPS_ROLES,
  },
  resourceOps: {
    key: "resourceOps",
    label: "ResourceOps",
    path: "/field-ops/resources",
    allowedRoles: FIELDOPS_RESOURCEOPS_ROLES,
  },
  admin: {
    key: "admin",
    label: "Admin / Settings",
    path: "/prompt-assignments",
    allowedRoles: ["ADMIN", "PROGRAM_MANAGER"],
  },
  audit: {
    key: "audit",
    label: "Audit / History",
    path: "/gear-ops/audits",
    allowedRoles: COACH_PLUS_ROLES,
  },
};

const ACTION_ALLOWED_ROLES: Record<string, readonly AppRole[]> = {
  "program.create": ["ADMIN", "PROGRAM_MANAGER"],
  "program.update": ["ADMIN", "PROGRAM_MANAGER"],
  "season.create": ["ADMIN", "PROGRAM_MANAGER"],
  "season.update": ["ADMIN", "PROGRAM_MANAGER"],
  "season.rollover": ["ADMIN", "PROGRAM_MANAGER"],
  "person.create": ["ADMIN", "PROGRAM_MANAGER"],
  "person.update": ["ADMIN", "PROGRAM_MANAGER"],
  "person.activate": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "person.deactivate": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "person.archive": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "person.move": ["ADMIN", "PROGRAM_MANAGER"],
  "qualificationDefinition.create": ["ADMIN", "PROGRAM_MANAGER"],
  "certificationDefinition.create": ["ADMIN", "PROGRAM_MANAGER"],
  "eligibilityDefinition.create": ["ADMIN", "PROGRAM_MANAGER"],
  "personQualification.create": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "personQualification.update": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "personCertification.create": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "personCertification.update": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "programParticipation.create": ["ADMIN", "PROGRAM_MANAGER"],
  "programParticipation.update": ["ADMIN", "PROGRAM_MANAGER"],
  "programParticipation.status.update": ["ADMIN", "PROGRAM_MANAGER"],
  "guardianRelationship.create": ["ADMIN", "PROGRAM_MANAGER"],
  "guardianRelationship.update": ["ADMIN", "PROGRAM_MANAGER"],
  "team.create": ["ADMIN", "PROGRAM_MANAGER"],
  "rosterMembership.create": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "rosterMembership.delete": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "roleAssignment.create": ["ADMIN", "PROGRAM_MANAGER"],
  "roleAssignment.delete": ["ADMIN", "PROGRAM_MANAGER"],
  "event.create": STAFF_ROLES,
  "event.update": STAFF_ROLES,
  "rsvp.upsert": STAFF_ROLES,
  "attendance.upsert": STAFF_ROLES,
  "note.create": STAFF_ROLES,
  "note.update": STAFF_ROLES,
  "task.create": STAFF_ROLES,
  "task.update": STAFF_ROLES,
  "booking.create": COACH_PLUS_ROLES,
  "booking.approve": ["ADMIN", "PROGRAM_MANAGER"],
  "booking.deny": ["ADMIN", "PROGRAM_MANAGER"],
  "gearCategory.create": ["ADMIN", "PROGRAM_MANAGER"],
  "gearCategory.update": ["ADMIN", "PROGRAM_MANAGER"],
  "gearCategoryField.create": ["ADMIN", "PROGRAM_MANAGER"],
  "gearCategoryField.delete": ["ADMIN", "PROGRAM_MANAGER"],
  "gearItem.create": COACH_PLUS_ROLES,
  "gearItem.update": COACH_PLUS_ROLES,
  "eventGearPlan.create": COACH_PLUS_ROLES,
  "eventGearPlan.update": COACH_PLUS_ROLES,
  "eventGearRequirement.create": COACH_PLUS_ROLES,
  "eventGearRequirementTemplate.create": ["ADMIN", "PROGRAM_MANAGER"],
  "eventGearRequirementTemplate.update": ["ADMIN", "PROGRAM_MANAGER"],
  "eventGearAssignment.create": COACH_PLUS_ROLES,
  "eventGearAssignment.update": COACH_PLUS_ROLES,
  "gearAssignment.create": COACH_PLUS_ROLES,
  "gearAssignment.update": COACH_PLUS_ROLES,
  "gearCheckout.create": COACH_PLUS_ROLES,
  "gearCheckout.update": COACH_PLUS_ROLES,
  "gearReservation.create": COACH_PLUS_ROLES,
  "gearReservation.update": COACH_PLUS_ROLES,
  "gearMaintenance.create": COACH_PLUS_ROLES,
  "gearMaintenance.update": COACH_PLUS_ROLES,
  "gearConsumableTransaction.create": COACH_PLUS_ROLES,
  "gearConsumableTransaction.update": COACH_PLUS_ROLES,
  "gearOpsSettings.update": ["ADMIN", "PROGRAM_MANAGER"],
  "entry.create": STAFF_ROLES,
  "entry.update": STAFF_ROLES,
  "entry.delete": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
  "workflow.create": STAFF_ROLES,
  "workflow.update": STAFF_ROLES,
  "workflow.delete": ["ADMIN", "PROGRAM_MANAGER", "COACH"],
};

function hasRole(user: CurrentUser | null, allowedRoles: readonly AppRole[]): boolean {
  if (!user?.roles.length) {
    return false;
  }

  return user.roles.some((role) => allowedRoles.includes(role));
}

export function canAccessModule(user: CurrentUser | null, moduleKey: ModuleKey): boolean {
  return hasRole(user, MODULE_ACCESS_MAP[moduleKey].allowedRoles);
}

export function canAccessNavItem(user: CurrentUser | null, allowedRoles: readonly AppRole[]): boolean {
  return hasRole(user, allowedRoles);
}

export function canPerformAction(user: CurrentUser | null, actionKey: ActionKey): boolean {
  const allowedRoles = ACTION_ALLOWED_ROLES[actionKey] ?? [];
  return hasRole(user, allowedRoles);
}

export function requireRole(user: CurrentUser | null, roles: readonly AppRole[]): boolean {
  return hasRole(user, roles);
}

import type { ModuleKey } from "@/lib/auth/access-control";
import type { AppRole } from "@/lib/auth/current-user-types";

export type NavItemStatus = "active" | "planned" | "disabled";

export type CanonicalNavItem = {
  key: string;
  label: string;
  href: string;
  moduleKey: ModuleKey;
  allowedRoles?: readonly AppRole[];
  status: NavItemStatus;
  disabled?: boolean;
  plannedReason?: string;
  disabledReason?: string;
};

export type CanonicalNavGroup = {
  key: string;
  label: string;
  allowedRoles: readonly AppRole[];
  items: readonly CanonicalNavItem[];
};

const ALL_ROLES: readonly AppRole[] = [
  "ADMIN",
  "PROGRAM_MANAGER",
  "COACH",
  "ASSISTANT_COACH",
  "GUARDIAN",
  "ATHLETE",
  "LIMITED_VIEWER",
];

const MEMBEROPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH"];
const WORKOPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH", "GUARDIAN", "ATHLETE"];
const STAFF_ENTRYOPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH"];
const FIELDOPS_RESOURCEOPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH"];
const GEAROPS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH", "GUARDIAN", "ATHLETE"];
const ADMIN_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER"];

function activeItem(input: Omit<CanonicalNavItem, "status" | "disabled">): CanonicalNavItem {
  return {
    ...input,
    status: "active",
    disabled: false,
  };
}

function plannedItem(input: Omit<CanonicalNavItem, "status" | "disabled"> & { plannedReason?: string }): CanonicalNavItem {
  return {
    ...input,
    status: "planned",
    disabled: true,
  };
}

/**
 * Canonical CadreOS sidebar taxonomy.
 *
 * This file is the source of truth for sidebar group labels, item labels,
 * order, grouping, and canonical paths. Persona and auth work may only filter
 * visibility from this structure; they must not rename, reorder, regroup, or
 * remove items unless a future task explicitly changes the taxonomy.
 */
export const CADREOS_NAV_GROUPS: readonly CanonicalNavGroup[] = [
  {
    key: "HOME",
    label: "Home",
    allowedRoles: ALL_ROLES,
    items: [
      activeItem({
        key: "PERSONAL_DASHBOARD",
        label: "Personal Dashboard",
        href: "/dashboard",
        moduleKey: "dashboard",
      }),
      activeItem({
        key: "NOTIFICATIONS",
        label: "Notifications",
        href: "/notifications",
        moduleKey: "dashboard",
      }),
    ],
  },
  {
    key: "MEMBEROPS",
    label: "MemberOps",
    allowedRoles: MEMBEROPS_ROLES,
    items: [
      activeItem({
        key: "PROGRAMS",
        label: "Programs",
        href: "/programs",
        moduleKey: "memberOps",
      }),
      activeItem({
        key: "PEOPLE",
        label: "Members",
        href: "/people",
        moduleKey: "memberOps",
      }),
      activeItem({
        key: "TEAMS",
        label: "Teams",
        href: "/teams",
        moduleKey: "memberOps",
      }),
      plannedItem({
        key: "MEMBERSHIP_LIFECYCLE",
        label: "Membership Lifecycle",
        href: "/member-ops/lifecycle",
        moduleKey: "memberOps",
        plannedReason: "Dedicated membership lifecycle route is not implemented yet.",
      }),
      plannedItem({
        key: "MEMBER_REPORTS",
        label: "Member Reports",
        href: "/member-ops/reports",
        moduleKey: "memberOps",
        plannedReason: "Dedicated member reports route is not implemented yet.",
      }),
    ],
  },
  {
    key: "ENTRYOPS",
    label: "EntryOps",
    allowedRoles: WORKOPS_ROLES,
    items: [
      activeItem({
        key: "ENTRY_INBOX",
        label: "Inbox",
        href: "/entries/inbox",
        moduleKey: "entry",
        allowedRoles: STAFF_ENTRYOPS_ROLES,
      }),
      activeItem({
        key: "ENTRY_MY_WORK",
        label: "My Work",
        href: "/assigned",
        moduleKey: "entry",
      }),
      activeItem({
        key: "ENTRY_TODAY",
        label: "Today",
        href: "/today",
        moduleKey: "entry",
      }),
      activeItem({
        key: "ENTRY_UPCOMING",
        label: "Upcoming",
        href: "/upcoming",
        moduleKey: "entry",
      }),
      activeItem({
        key: "ENTRY_REVIEW",
        label: "Review",
        href: "/entries/review",
        moduleKey: "entry",
        allowedRoles: STAFF_ENTRYOPS_ROLES,
      }),
      activeItem({
        key: "ENTRY_LISTS",
        label: "Lists",
        href: "/lists",
        moduleKey: "entry",
        allowedRoles: STAFF_ENTRYOPS_ROLES,
      }),
      activeItem({
        key: "ENTRY_ACTIVITY",
        label: "Activity Feed",
        href: "/feed",
        moduleKey: "entry",
      }),
      activeItem({
        key: "ENTRY_ALL",
        label: "All",
        href: "/entries",
        moduleKey: "entry",
        allowedRoles: STAFF_ENTRYOPS_ROLES,
      }),
      activeItem({
        key: "ENTRY_HABITS",
        label: "Habits",
        href: "/habits",
        moduleKey: "entry",
      }),
      activeItem({
        key: "ENTRY_JOURNALS",
        label: "Journals",
        href: "/journals",
        moduleKey: "journal",
        allowedRoles: WORKOPS_ROLES,
      }),
      activeItem({
        key: "ENTRY_PROMPTS",
        label: "Prompt Library",
        href: "/prompts",
        moduleKey: "journal",
        allowedRoles: STAFF_ENTRYOPS_ROLES,
      }),
      activeItem({
        key: "ENTRY_PROMPT_ASSIGNMENTS",
        label: "Prompt Assignments",
        href: "/prompt-assignments",
        moduleKey: "journal",
        allowedRoles: WORKOPS_ROLES,
      }),
    ],
  },
  {
    key: "FIELDOPS_RESOURCEOPS",
    label: "FieldOps / ResourceOps",
    allowedRoles: FIELDOPS_RESOURCEOPS_ROLES,
    items: [
      activeItem({
        key: "FIELDOPS_DASHBOARD",
        label: "FieldOps",
        href: "/field-ops",
        moduleKey: "fieldOps",
      }),
      activeItem({
        key: "FIELDOPS_FACILITIES",
        label: "Facilities",
        href: "/field-ops/facilities",
        moduleKey: "fieldOps",
      }),
      activeItem({
        key: "FIELDOPS_BOOKINGS",
        label: "Bookings",
        href: "/field-ops/bookings",
        moduleKey: "fieldOps",
      }),
      activeItem({
        key: "RESOURCEOPS_RESOURCES",
        label: "Resources",
        href: "/field-ops/resources",
        moduleKey: "resourceOps",
      }),
      plannedItem({
        key: "RESOURCEOPS_REQUESTS",
        label: "Resource Requests",
        href: "/field-ops/resource-requests",
        moduleKey: "resourceOps",
        plannedReason: "Resource requests route is not implemented yet.",
      }),
      plannedItem({
        key: "RESOURCEOPS_REPORTS",
        label: "Resource Reports",
        href: "/field-ops/reports",
        moduleKey: "resourceOps",
        plannedReason: "Resource reports route is not implemented yet.",
      }),
    ],
  },
  {
    key: "GEAROPS",
    label: "GearOps",
    allowedRoles: GEAROPS_ROLES,
    items: [
      activeItem({
        key: "GEAR_DASHBOARD",
        label: "Gear Dashboard",
        href: "/gear-ops",
        moduleKey: "gearOps",
      }),
      activeItem({
        key: "GEAR_ITEMS",
        label: "Items",
        href: "/gear-ops/items",
        moduleKey: "gearOps",
      }),
      plannedItem({
        key: "GEAR_CHECKOUTS_ASSIGNMENTS",
        label: "Checkouts / Assignments",
        href: "/gear-ops/checkouts",
        moduleKey: "gearOps",
        plannedReason: "Combined checkouts and assignments route is not implemented yet.",
      }),
      plannedItem({
        key: "GEAR_MAINTENANCE",
        label: "Maintenance",
        href: "/gear-ops/maintenance",
        moduleKey: "gearOps",
        plannedReason: "Maintenance list route is not implemented yet.",
      }),
      activeItem({
        key: "GEAR_CATEGORIES",
        label: "Categories",
        href: "/gear-ops/categories",
        moduleKey: "gearOps",
      }),
      activeItem({
        key: "GEAR_AUDITS",
        label: "Audits",
        href: "/gear-ops/audits",
        moduleKey: "gearOps",
      }),
    ],
  },
  {
    key: "ADMIN",
    label: "Admin",
    allowedRoles: ADMIN_ROLES,
    items: [
      plannedItem({
        key: "GLOBAL_DASHBOARD",
        label: "Global Dashboard",
        href: "/admin/dashboard",
        moduleKey: "admin",
        plannedReason: "Global dashboard route is not implemented yet.",
      }),
      activeItem({
        key: "ROLES_PERMISSIONS",
        label: "Roles & Permissions",
        href: "/admin/roles",
        moduleKey: "admin",
      }),
      activeItem({
        key: "ADMIN_SETTINGS",
        label: "Settings",
        href: "/admin/settings",
        moduleKey: "admin",
      }),
      plannedItem({
        key: "GLOBAL_REPORTS",
        label: "Global Reports",
        href: "/admin/reports",
        moduleKey: "admin",
        plannedReason: "Global reports route is not implemented yet.",
      }),
      activeItem({
        key: "AUDIT_HISTORY",
        label: "Audit / History",
        href: "/admin/audit",
        moduleKey: "admin",
      }),
    ],
  },
] as const;

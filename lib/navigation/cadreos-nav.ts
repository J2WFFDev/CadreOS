/**
 * Canonical CadreOS navigation taxonomy.
 *
 * This is the single source of truth for navigation identity: labels, order,
 * grouping, and paths. Access-control metadata (allowedRoles) is co-located
 * here so it is easy to audit, but it must never change UX labels or reorder items.
 *
 * Rules:
 * - Labels and order in this file define what users see. Do not rename items in
 *   the access-control layer.
 * - To add role restrictions, only modify `allowedRoles` — never the label or path.
 * - Set `disabled: true` for planned routes that do not yet exist so that nav items
 *   remain visible without causing broken links.
 */

import type { AppRole } from "@/lib/auth/current-user-types";
import type { ModuleKey } from "@/lib/auth/access-control";

export type CanonicalNavLink = {
  href: string;
  label: string;
  /**
   * When true the route is planned but not yet implemented.
   * The nav item renders in a muted/non-clickable state.
   */
  disabled?: boolean;
};

export type CanonicalNavGroup = {
  /** Stable machine key used for identity comparisons */
  key: string;
  /** Module key for role-based module visibility */
  moduleKey: ModuleKey;
  /** User-facing group label. This is the UX label — do not change it via access control. */
  label: string;
  /** Landing route for the module header */
  href: string;
  /** Ordered list of child navigation links */
  links: readonly CanonicalNavLink[];
  /** Roles allowed to see this module group */
  allowedRoles: readonly AppRole[];
};

const STAFF_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH", "ASSISTANT_COACH"];
const COACH_PLUS_ROLES: readonly AppRole[] = ["ADMIN", "PROGRAM_MANAGER", "COACH"];
const ALL_ROLES: readonly AppRole[] = [
  "ADMIN",
  "PROGRAM_MANAGER",
  "COACH",
  "ASSISTANT_COACH",
  "GUARDIAN",
  "ATHLETE",
  "LIMITED_VIEWER",
];

/**
 * Ordered canonical navigation groups for CadreOS.
 *
 * Do not reorder or rename items here as a side-effect of persona/auth work.
 * Access-control changes belong only in `allowedRoles`.
 */
export const CADREOS_NAV_GROUPS: readonly CanonicalNavGroup[] = [
  {
    key: "home",
    moduleKey: "dashboard",
    label: "Home",
    href: "/dashboard",
    allowedRoles: ALL_ROLES,
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/feed", label: "Feed" },
      { href: "/today", label: "Today" },
      { href: "/assigned", label: "Assigned to Me" },
      { href: "/notifications", label: "Notifications" },
    ],
  },
  {
    key: "member-ops",
    moduleKey: "memberOps",
    label: "MemberOps",
    href: "/programs",
    allowedRoles: STAFF_ROLES,
    links: [
      { href: "/programs", label: "Programs" },
      { href: "/people", label: "People" },
      { href: "/teams", label: "Teams" },
      { href: "/member-ops/reports", label: "Membership Lifecycle", disabled: true },
    ],
  },
  {
    key: "entry",
    moduleKey: "entry",
    label: "Entry",
    href: "/entries",
    allowedRoles: STAFF_ROLES,
    links: [
      { href: "/entries", label: "Entries" },
      { href: "/entries/inbox", label: "Inbox" },
      { href: "/entries/reports", label: "Entry Reports", disabled: true },
    ],
  },
  {
    key: "journal",
    moduleKey: "journal",
    label: "Journal",
    href: "/journals",
    allowedRoles: STAFF_ROLES,
    links: [
      { href: "/journals", label: "Journals" },
      { href: "/habits", label: "Habits" },
      { href: "/tasks", label: "Tasks" },
      { href: "/decisions", label: "Decisions" },
    ],
  },
  {
    key: "field-resource-ops",
    moduleKey: "fieldOps",
    label: "FieldOps / ResourceOps",
    href: "/field-ops",
    allowedRoles: COACH_PLUS_ROLES,
    links: [
      { href: "/field-ops", label: "FieldOps" },
      { href: "/field-ops/facilities", label: "Facilities" },
      { href: "/field-ops/bookings", label: "Bookings" },
      { href: "/field-ops/resources", label: "ResourceOps" },
      { href: "/field-ops/reports", label: "Reports", disabled: true },
    ],
  },
  {
    key: "gear-ops",
    moduleKey: "gearOps",
    label: "GearOps",
    href: "/gear-ops",
    allowedRoles: COACH_PLUS_ROLES,
    links: [
      { href: "/gear-ops", label: "GearOps" },
      { href: "/gear-ops/categories", label: "Categories" },
      { href: "/gear-ops/items", label: "Items" },
      { href: "/gear-ops/audits", label: "Audits" },
      { href: "/gear-ops/reports", label: "Reports" },
    ],
  },
  {
    key: "admin",
    moduleKey: "admin",
    label: "Admin / Settings",
    href: "/prompt-assignments",
    allowedRoles: ["ADMIN", "PROGRAM_MANAGER"],
    links: [
      { href: "/prompt-assignments", label: "Prompt Assignments" },
      { href: "/admin/roles", label: "Roles & Permissions" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/prompts", label: "Prompt Templates" },
      { href: "/reports", label: "Global Reports" },
      { href: "/admin/audit", label: "Audit / History" },
    ],
  },
] as const;

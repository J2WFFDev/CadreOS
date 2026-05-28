import type { AppRole, CurrentUser } from "@/lib/auth/current-user-types";
import { CADREOS_NAV_GROUPS, type CanonicalNavGroup } from "@/lib/navigation/cadreos-nav";
import { getNavSidebarGroupsForUser } from "@/lib/nav-sidebar";

export const APPROVED_CADREOS_GROUP_ORDER = [
  "HOME",
  "MEMBEROPS",
  "ENTRYOPS",
  "FIELDOPS_RESOURCEOPS",
  "GEAROPS",
  "ADMIN",
] as const;

export const APPROVED_CADREOS_GROUP_ITEMS: Record<(typeof APPROVED_CADREOS_GROUP_ORDER)[number], readonly string[]> = {
  HOME: ["PERSONAL_DASHBOARD", "FYP", "NOTIFICATIONS"],
  MEMBEROPS: ["PROGRAMS", "PEOPLE", "TEAMS", "MEMBERSHIP_LIFECYCLE", "MEMBER_REPORTS"],
  ENTRYOPS: ["ENTRY_ALL", "ENTRY_INBOX", "ENTRY_TODAY", "ENTRY_LISTS", "ENTRY_HABITS"],
  FIELDOPS_RESOURCEOPS: [
    "FIELDOPS_DASHBOARD",
    "FIELDOPS_FACILITIES",
    "FIELDOPS_BOOKINGS",
    "RESOURCEOPS_RESOURCES",
    "RESOURCEOPS_REQUESTS",
    "RESOURCEOPS_REPORTS",
  ],
  GEAROPS: ["GEAR_DASHBOARD", "GEAR_ITEMS", "GEAR_CHECKOUTS_ASSIGNMENTS", "GEAR_MAINTENANCE", "GEAR_CATEGORIES", "GEAR_AUDITS"],
  ADMIN: ["GLOBAL_DASHBOARD", "ROLES_PERMISSIONS", "ADMIN_SETTINGS", "PROMPTS_TEMPLATES", "GLOBAL_REPORTS", "AUDIT_HISTORY"],
};

export const APPROVED_GROUP_VISIBILITY: Record<AppRole, readonly string[]> = {
  ADMIN: ["HOME", "MEMBEROPS", "ENTRYOPS", "FIELDOPS_RESOURCEOPS", "GEAROPS", "ADMIN"],
  PROGRAM_MANAGER: ["HOME", "MEMBEROPS", "ENTRYOPS", "FIELDOPS_RESOURCEOPS", "GEAROPS", "ADMIN"],
  COACH: ["HOME", "MEMBEROPS", "ENTRYOPS", "FIELDOPS_RESOURCEOPS", "GEAROPS"],
  ASSISTANT_COACH: ["HOME", "ENTRYOPS", "FIELDOPS_RESOURCEOPS", "GEAROPS"],
  GUARDIAN: ["HOME", "ENTRYOPS", "GEAROPS"],
  ATHLETE: ["HOME", "ENTRYOPS", "GEAROPS"],
  LIMITED_VIEWER: ["HOME"],
};

const FORBIDDEN_GENERIC_HREFS = new Set<string>(["/reports"]);

function buildRoleUser(role: AppRole): CurrentUser {
  return {
    id: `validation-${role.toLowerCase()}`,
    name: `Validation ${role}`,
    roles: [role],
    activeRole: role,
    isDevPersona: true,
  };
}

function formatList(values: readonly string[]): string {
  return values.join(", ");
}

export function validateCadreosNavTaxonomy(groups: readonly CanonicalNavGroup[] = CADREOS_NAV_GROUPS): string[] {
  const issues: string[] = [];
  const groupKeys = groups.map((group) => group.key);

  if (JSON.stringify(groupKeys) !== JSON.stringify(APPROVED_CADREOS_GROUP_ORDER)) {
    issues.push(`Group order mismatch: expected [${formatList(APPROVED_CADREOS_GROUP_ORDER)}], received [${formatList(groupKeys)}].`);
  }

  for (const groupKey of APPROVED_CADREOS_GROUP_ORDER) {
    const group = groups.find((candidate) => candidate.key === groupKey);
    if (!group) {
      issues.push(`Missing required group ${groupKey}.`);
      continue;
    }

    const actualItemKeys = group.items.map((item) => item.key);
    const expectedItemKeys = APPROVED_CADREOS_GROUP_ITEMS[groupKey];
    if (JSON.stringify(actualItemKeys) !== JSON.stringify(expectedItemKeys)) {
      issues.push(`Item order mismatch for ${groupKey}: expected [${formatList(expectedItemKeys)}], received [${formatList(actualItemKeys)}].`);
    }
  }

  const allItems = groups.flatMap((group) => group.items.map((item) => ({ groupKey: group.key, item })));
  const itemKeys = new Set<string>();
  const activeHrefs = new Map<string, string[]>();

  for (const { groupKey, item } of allItems) {
    if (itemKeys.has(item.key)) {
      issues.push(`Duplicate nav item key detected: ${item.key}.`);
    }
    itemKeys.add(item.key);

    if (!item.moduleKey) {
      issues.push(`Nav item ${item.key} is missing a moduleKey.`);
    }

    if (item.status === "planned" && item.disabled !== true) {
      issues.push(`Planned nav item ${item.key} must also be disabled.`);
    }

    if (item.status === "disabled" && item.disabled !== true) {
      issues.push(`Disabled nav item ${item.key} must set disabled=true.`);
    }

    if (item.status === "active" && item.disabled) {
      issues.push(`Active nav item ${item.key} must not be disabled.`);
    }

    if (FORBIDDEN_GENERIC_HREFS.has(item.href)) {
      issues.push(`Nav item ${item.key} in ${groupKey} must not use the generic ${item.href} route.`);
    }

    if (item.status === "active") {
      const hrefUsers = activeHrefs.get(item.href) ?? [];
      hrefUsers.push(item.key);
      activeHrefs.set(item.href, hrefUsers);
    }
  }

  for (const [href, keys] of activeHrefs.entries()) {
    if (keys.length > 1) {
      issues.push(`Active href ${href} is duplicated across nav items: [${formatList(keys)}].`);
    }
  }

  for (const [role, expectedGroupKeys] of Object.entries(APPROVED_GROUP_VISIBILITY) as Array<[AppRole, readonly string[]]>) {
    const actualGroupKeys = getNavSidebarGroupsForUser(buildRoleUser(role)).map((group) => group.key);
    if (JSON.stringify(actualGroupKeys) !== JSON.stringify(expectedGroupKeys)) {
      issues.push(`Role visibility mismatch for ${role}: expected [${formatList(expectedGroupKeys)}], received [${formatList(actualGroupKeys)}].`);
    }
  }

  return issues;
}

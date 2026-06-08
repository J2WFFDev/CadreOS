import type { AppRole } from "@/lib/auth/current-user-types";

export function buildEffectiveAppRoles(input: {
  directRoles: AppRole[];
  hasGuardianDependentScope: boolean;
}): AppRole[] {
  const roles = Array.from(new Set(input.directRoles));

  if (input.hasGuardianDependentScope && !roles.includes("GUARDIAN")) {
    roles.push("GUARDIAN");
  }

  return roles.length > 0 ? roles : ["LIMITED_VIEWER"];
}

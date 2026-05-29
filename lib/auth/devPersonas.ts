import type { CurrentUser } from "@/lib/auth/current-user-types";

export const DEV_PERSONA_COOKIE_NAME = "cadreos_dev_persona";

export type DevPersona = CurrentUser & {
  label: string;
};

export const DEV_PERSONAS: readonly DevPersona[] = [
  {
    id: "dev-admin-001",
    label: "Admin",
    name: "Avery Admin",
    email: "avery.admin@dev.cadreos.local",
    roles: ["ADMIN"],
    activeRole: "ADMIN",
    organizationId: "dev-org-cadreos",
    teamIds: ["dev-team-varsity", "dev-team-jv"],
    athleteIds: [],
    guardianAthleteIds: [],
    isDevPersona: true,
  },
  {
    id: "dev-program-manager-001",
    label: "Program Manager",
    name: "Parker Program",
    email: "parker.program@dev.cadreos.local",
    roles: ["PROGRAM_MANAGER"],
    activeRole: "PROGRAM_MANAGER",
    organizationId: "dev-org-cadreos",
    teamIds: ["dev-team-varsity"],
    athleteIds: [],
    guardianAthleteIds: [],
    isDevPersona: true,
  },
  {
    id: "dev-coach-001",
    label: "Coach",
    name: "Casey Coach",
    email: "casey.coach@dev.cadreos.local",
    roles: ["COACH"],
    activeRole: "COACH",
    organizationId: "dev-org-cadreos",
    teamIds: ["dev-team-varsity"],
    athleteIds: [],
    guardianAthleteIds: [],
    isDevPersona: true,
  },
  {
    id: "dev-assistant-coach-001",
    label: "Assistant Coach",
    name: "Alex Assistant",
    email: "alex.assistant@dev.cadreos.local",
    roles: ["ASSISTANT_COACH"],
    activeRole: "ASSISTANT_COACH",
    organizationId: "dev-org-cadreos",
    teamIds: ["dev-team-jv"],
    athleteIds: [],
    guardianAthleteIds: [],
    isDevPersona: true,
  },
  {
    id: "dev-guardian-001",
    label: "Guardian",
    name: "Gina Guardian",
    email: "gina.guardian@dev.cadreos.local",
    roles: ["GUARDIAN"],
    activeRole: "GUARDIAN",
    organizationId: "dev-org-cadreos",
    teamIds: [],
    athleteIds: [],
    guardianAthleteIds: ["dev-athlete-001", "dev-athlete-002"],
    isDevPersona: true,
  },
  {
    id: "dev-athlete-001",
    label: "Athlete",
    name: "Aria Athlete",
    email: "aria.athlete@dev.cadreos.local",
    roles: ["ATHLETE"],
    activeRole: "ATHLETE",
    organizationId: "dev-org-cadreos",
    teamIds: ["dev-team-varsity"],
    athleteIds: ["dev-athlete-001"],
    guardianAthleteIds: [],
    isDevPersona: true,
  },
  {
    id: "dev-limited-viewer-001",
    label: "Limited Viewer",
    name: "Lena Limited",
    email: "lena.viewer@dev.cadreos.local",
    roles: ["LIMITED_VIEWER"],
    activeRole: "LIMITED_VIEWER",
    organizationId: "dev-org-cadreos",
    teamIds: [],
    athleteIds: [],
    guardianAthleteIds: [],
    isDevPersona: true,
  },
] as const;

export type DevPersonaFeatureStatus = {
  /** True when NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true */
  nextPublicEnabled: boolean;
  /** True when ENABLE_DEV_PERSONAS_IN_PRODUCTION=true */
  productionOverrideEnabled: boolean;
  /** Value of NODE_ENV at runtime */
  nodeEnv: string;
  /** Whether the switcher is active for the current runtime */
  enabled: boolean;
  /**
   * Human-readable reason for the current state. One of:
   * - "enabled"
   * - "NEXT_PUBLIC_ENABLE_DEV_PERSONAS is not true"
   * - "production requires ENABLE_DEV_PERSONAS_IN_PRODUCTION=true"
   */
  reason: string;
};

export function getDevPersonaFeatureStatus(): DevPersonaFeatureStatus {
  const nextPublicEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_PERSONAS === "true";
  const productionOverrideEnabled = process.env.ENABLE_DEV_PERSONAS_IN_PRODUCTION === "true";
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (!nextPublicEnabled) {
    return {
      nextPublicEnabled,
      productionOverrideEnabled,
      nodeEnv,
      enabled: false,
      reason: "NEXT_PUBLIC_ENABLE_DEV_PERSONAS is not true",
    };
  }

  if (nodeEnv === "production" && !productionOverrideEnabled) {
    return {
      nextPublicEnabled,
      productionOverrideEnabled,
      nodeEnv,
      enabled: false,
      reason: "production requires ENABLE_DEV_PERSONAS_IN_PRODUCTION=true",
    };
  }

  return {
    nextPublicEnabled,
    productionOverrideEnabled,
    nodeEnv,
    enabled: true,
    reason: "enabled",
  };
}

export function isDevPersonasEnabled(): boolean {
  return getDevPersonaFeatureStatus().enabled;
}

export function getDevPersonaById(id: string | null | undefined): DevPersona | null {
  if (!id) {
    return null;
  }

  return DEV_PERSONAS.find((persona) => persona.id === id) ?? null;
}

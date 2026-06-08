export const APP_ROLES = [
  "ADMIN",
  "PROGRAM_MANAGER",
  "COACH",
  "ASSISTANT_COACH",
  "GUARDIAN",
  "ATHLETE",
  "LIMITED_VIEWER",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type CurrentUser = {
  id: string;
  name: string;
  email?: string;
  roles: AppRole[];
  activeRole?: AppRole;
  organizationId?: string;
  teamIds?: string[];
  athleteIds?: string[];
  guardianAthleteIds?: string[];
  dependentAthleteIds?: string[];
  derivedProgramIds?: string[];
  derivedTeamIds?: string[];
  isDevPersona?: boolean;
};

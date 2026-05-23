import { Prisma, RoleType, ScopeType } from "@prisma/client";
import { z } from "zod";

import { requireAuthContext } from "@/lib/auth";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 32;

const emailValidator = z.string().email();

export const personWorkflowSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(MAX_NAME_LENGTH, `First name must be ${MAX_NAME_LENGTH} characters or less.`),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required.")
      .max(MAX_NAME_LENGTH, `Last name must be ${MAX_NAME_LENGTH} characters or less.`),
    email: z.string().trim().max(MAX_EMAIL_LENGTH, `Email must be ${MAX_EMAIL_LENGTH} characters or less.`),
    phone: z.string().trim().max(MAX_PHONE_LENGTH, `Phone must be ${MAX_PHONE_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    if (value.email.length > 0 && !emailValidator.safeParse(value.email).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Enter a valid email address.",
      });
    }
  })
  .transform((value) => ({
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email.length === 0 ? null : value.email,
    phone: value.phone.length === 0 ? null : value.phone,
  }));

export const teamWorkflowSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(MAX_NAME_LENGTH, `Team name must be ${MAX_NAME_LENGTH} characters or less.`),
  programId: z.string().trim().min(1, "Program selection is required."),
});

export const programWorkflowSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Program name is required.")
    .max(MAX_NAME_LENGTH, `Program name must be ${MAX_NAME_LENGTH} characters or less.`),
});

export const rosterMembershipWorkflowSchema = z.object({
  personId: z.string().trim().min(1, "Person selection is required."),
  rosterRole: z.nativeEnum(RoleType, {
    message: "Roster role must use an existing role value.",
  }),
});

export const roleAssignmentWorkflowSchema = z
  .object({
    roleType: z.nativeEnum(RoleType, {
      message: "Role type must use an existing role value.",
    }),
    scopeType: z.nativeEnum(ScopeType, {
      message: "Scope type must use an existing scope value.",
    }),
    programId: z.string().trim(),
    teamId: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.scopeType === ScopeType.ORGANIZATION) {
      if (value.programId.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programId"],
          message: "Program is not allowed for organization scope.",
        });
      }

      if (value.teamId.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teamId"],
          message: "Team is not allowed for organization scope.",
        });
      }
    }

    if (value.scopeType === ScopeType.PROGRAM) {
      if (value.programId.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programId"],
          message: "Program selection is required for program scope.",
        });
      }

      if (value.teamId.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teamId"],
          message: "Team is not allowed for program scope.",
        });
      }
    }

    if (value.scopeType === ScopeType.TEAM && value.teamId.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamId"],
        message: "Team selection is required for team scope.",
      });
    }
  })
  .transform((value) => ({
    roleType: value.roleType,
    scopeType: value.scopeType,
    programId: value.programId.length === 0 ? null : value.programId,
    teamId: value.teamId.length === 0 ? null : value.teamId,
  }));

export type PersonWorkflowInput = z.output<typeof personWorkflowSchema>;
export type TeamWorkflowInput = z.output<typeof teamWorkflowSchema>;
export type ProgramWorkflowInput = z.output<typeof programWorkflowSchema>;
export type RosterMembershipWorkflowInput = z.output<typeof rosterMembershipWorkflowSchema>;
export type RoleAssignmentWorkflowInput = z.output<typeof roleAssignmentWorkflowSchema>;

export function getStringField(formData: FormData, field: string): string {
  const rawValue = formData.get(field);

  return typeof rawValue === "string" ? rawValue : "";
}

export function isSchemaUnavailableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function requirePhase1CMutationPermission(input: {
  organizationId: string;
  action:
    | "program.create"
    | "program.update"
    | "person.create"
    | "person.update"
    | "team.create"
    | "rosterMembership.create"
    | "roleAssignment.create"
    | "roleAssignment.delete";
}): Promise<void> {
  const authContext = await requireAuthContext();

  void authContext;
  void input;

  // Auth and policy enforcement intentionally deferred; keep centralized for future phase.
}

type SeasonLike = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
};

export function selectSeededOrCurrentSeason(seasons: Array<SeasonLike>): SeasonLike | null {
  if (seasons.length === 0) {
    return null;
  }

  const now = new Date();

  const currentSeason = seasons.find((season) => {
    if (!season.startDate) {
      return false;
    }

    if (season.startDate > now) {
      return false;
    }

    if (season.endDate && season.endDate < now) {
      return false;
    }

    return true;
  });

  if (currentSeason) {
    return currentSeason;
  }

  const demoSeason = seasons.find((season) => season.name.toLowerCase().includes("demo"));

  if (demoSeason) {
    return demoSeason;
  }

  return seasons[0] ?? null;
}

import { Prisma, RoleType } from "@prisma/client";
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

export const rosterMembershipWorkflowSchema = z.object({
  personId: z.string().trim().min(1, "Person selection is required."),
  rosterRole: z.nativeEnum(RoleType, {
    message: "Roster role must use an existing role value.",
  }),
});

export type PersonWorkflowInput = z.output<typeof personWorkflowSchema>;
export type TeamWorkflowInput = z.output<typeof teamWorkflowSchema>;
export type RosterMembershipWorkflowInput = z.output<typeof rosterMembershipWorkflowSchema>;

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
    | "person.create"
    | "person.update"
    | "team.create"
    | "rosterMembership.create";
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

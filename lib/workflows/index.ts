import {
  AttendanceStatus,
  EventStatus,
  EventType,
  Prisma,
  RoleType,
  RSVPStatus,
  ScopeType,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthContext } from "@/lib/auth";
import { PermissionDeniedError, requirePermission } from "@/lib/permissions";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 32;
const MAX_EVENT_TITLE_LENGTH = 160;
const MAX_EVENT_LOCATION_LENGTH = 200;
const MAX_RSVP_REASON_LENGTH = 500;
const MAX_ATTENDANCE_REASON_CODE_LENGTH = 120;
const MAX_NOTE_BODY_LENGTH = 4000;
const MAX_TASK_TITLE_LENGTH = 160;
const MAX_TASK_DESCRIPTION_LENGTH = 4000;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

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
  seasonId: z.string().trim().min(1, "Season selection is required."),
  rosterRole: z.nativeEnum(RoleType, {
    message: "Roster role must use an existing role value.",
  }),
});

export const seasonWorkflowSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Season name is required.")
      .max(MAX_NAME_LENGTH, `Season name must be ${MAX_NAME_LENGTH} characters or less.`),
    startDate: z.string().trim(),
    endDate: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.startDate.length > 0 && !DATE_INPUT_PATTERN.test(value.startDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date must use YYYY-MM-DD format.",
      });
    }

    if (value.endDate.length > 0 && !DATE_INPUT_PATTERN.test(value.endDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must use YYYY-MM-DD format.",
      });
    }

    if (
      value.startDate.length > 0 &&
      value.endDate.length > 0 &&
      DATE_INPUT_PATTERN.test(value.startDate) &&
      DATE_INPUT_PATTERN.test(value.endDate) &&
      value.endDate < value.startDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date cannot be before start date.",
      });
    }
  })
  .transform((value) => ({
    name: value.name,
    startDate: value.startDate.length === 0 ? null : dateInputToUtcDate(value.startDate),
    endDate: value.endDate.length === 0 ? null : dateInputToUtcDate(value.endDate),
  }));

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

export const eventWorkflowSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Event title is required.")
      .max(MAX_EVENT_TITLE_LENGTH, `Event title must be ${MAX_EVENT_TITLE_LENGTH} characters or less.`),
    eventType: z.nativeEnum(EventType, {
      message: "Event type must use an existing event type value.",
    }),
    status: z.nativeEnum(EventStatus, {
      message: "Status must use an existing event status value.",
    }),
    programId: z.string().trim().min(1, "Program selection is required."),
    teamId: z.string().trim(),
    startsAt: z.string().trim().min(1, "Start date/time is required."),
    endsAt: z.string().trim(),
    location: z
      .string()
      .trim()
      .max(MAX_EVENT_LOCATION_LENGTH, `Location must be ${MAX_EVENT_LOCATION_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    if (!DATETIME_LOCAL_INPUT_PATTERN.test(value.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startsAt"],
        message: "Start date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (value.endsAt.length > 0 && !DATETIME_LOCAL_INPUT_PATTERN.test(value.endsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (
      DATETIME_LOCAL_INPUT_PATTERN.test(value.startsAt) &&
      value.endsAt.length > 0 &&
      DATETIME_LOCAL_INPUT_PATTERN.test(value.endsAt) &&
      value.endsAt < value.startsAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date/time cannot be before start date/time.",
      });
    }
  })
  .transform((value) => ({
    title: value.title,
    eventType: value.eventType,
    status: value.status,
    programId: value.programId,
    teamId: value.teamId.length === 0 ? null : value.teamId,
    startsAt: dateTimeInputToUtcDate(value.startsAt),
    endsAt: value.endsAt.length === 0 ? null : dateTimeInputToUtcDate(value.endsAt),
    location: value.location.length === 0 ? null : value.location,
  }));

export const rsvpWorkflowSchema = z
  .object({
    personId: z.string().trim().min(1, "Person selection is required."),
    status: z.nativeEnum(RSVPStatus, {
      message: "RSVP status must use an existing RSVP status value.",
    }),
    reason: z
      .string()
      .trim()
      .max(MAX_RSVP_REASON_LENGTH, `Reason must be ${MAX_RSVP_REASON_LENGTH} characters or less.`),
  })
  .transform((value) => ({
    personId: value.personId,
    status: value.status,
    reason: value.reason.length === 0 ? null : value.reason,
  }));

export const attendanceWorkflowSchema = z
  .object({
    personId: z.string().trim().min(1, "Person selection is required."),
    status: z.nativeEnum(AttendanceStatus, {
      message: "Attendance status must use an existing attendance status value.",
    }),
    reasonCode: z
      .string()
      .trim()
      .max(
        MAX_ATTENDANCE_REASON_CODE_LENGTH,
        `Reason code must be ${MAX_ATTENDANCE_REASON_CODE_LENGTH} characters or less.`,
      ),
  })
  .transform((value) => ({
    personId: value.personId,
    status: value.status,
    reasonCode: value.reasonCode.length === 0 ? null : value.reasonCode,
  }));

export const noteWorkflowSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "Note body is required.")
      .max(MAX_NOTE_BODY_LENGTH, `Note body must be ${MAX_NOTE_BODY_LENGTH} characters or less.`),
    athletePersonId: z.string().trim(),
    teamId: z.string().trim(),
    eventId: z.string().trim(),
  })
  .transform((value) => ({
    body: value.body,
    athletePersonId: value.athletePersonId.length === 0 ? null : value.athletePersonId,
    teamId: value.teamId.length === 0 ? null : value.teamId,
    eventId: value.eventId.length === 0 ? null : value.eventId,
  }));

export const followUpTaskWorkflowSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title is required.")
      .max(MAX_TASK_TITLE_LENGTH, `Task title must be ${MAX_TASK_TITLE_LENGTH} characters or less.`),
    description: z
      .string()
      .trim()
      .max(
        MAX_TASK_DESCRIPTION_LENGTH,
        `Description must be ${MAX_TASK_DESCRIPTION_LENGTH} characters or less.`,
      ),
    status: z.nativeEnum(TaskStatus, {
      message: "Status must use an existing task status value.",
    }),
    assigneePersonId: z.string().trim().min(1, "Assignee selection is required."),
    dueAt: z.string().trim(),
    sourceNoteId: z.string().trim(),
    sourceEventId: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.dueAt.length > 0 && !DATETIME_LOCAL_INPUT_PATTERN.test(value.dueAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueAt"],
        message: "Due date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }
  })
  .transform((value) => ({
    title: value.title,
    description: value.description.length === 0 ? null : value.description,
    status: value.status,
    assigneePersonId: value.assigneePersonId,
    dueAt: value.dueAt.length === 0 ? null : dateTimeInputToUtcDate(value.dueAt),
    sourceNoteId: value.sourceNoteId.length === 0 ? null : value.sourceNoteId,
    sourceEventId: value.sourceEventId.length === 0 ? null : value.sourceEventId,
  }));

export type PersonWorkflowInput = z.output<typeof personWorkflowSchema>;
export type TeamWorkflowInput = z.output<typeof teamWorkflowSchema>;
export type ProgramWorkflowInput = z.output<typeof programWorkflowSchema>;
export type RosterMembershipWorkflowInput = z.output<typeof rosterMembershipWorkflowSchema>;
export type SeasonWorkflowInput = z.output<typeof seasonWorkflowSchema>;
export type RoleAssignmentWorkflowInput = z.output<typeof roleAssignmentWorkflowSchema>;
export type EventWorkflowInput = z.output<typeof eventWorkflowSchema>;
export type RsvpWorkflowInput = z.output<typeof rsvpWorkflowSchema>;
export type AttendanceWorkflowInput = z.output<typeof attendanceWorkflowSchema>;
export type NoteWorkflowInput = z.output<typeof noteWorkflowSchema>;
export type FollowUpTaskWorkflowInput = z.output<typeof followUpTaskWorkflowSchema>;

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

export function isPermissionDeniedError(error: unknown): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}

export function dateInputToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateInputValue(value: Date | null): string {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

export function dateTimeInputToUtcDate(value: string): Date {
  return new Date(`${value.length === 16 ? `${value}:00` : value}Z`);
}

export function formatDateTimeInputValue(value: Date | null): string {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 16);
}

export async function requirePhase1CMutationPermission(input: {
  organizationId: string;
  action:
    | "program.create"
    | "program.update"
    | "person.create"
    | "person.update"
    | "team.create"
    | "season.create"
    | "season.update"
    | "event.create"
    | "event.update"
    | "rsvp.upsert"
    | "attendance.upsert"
    | "note.create"
    | "note.update"
    | "task.create"
    | "task.update"
    | "rosterMembership.create"
    | "roleAssignment.create"
    | "roleAssignment.delete";
  programId?: string | null;
  teamId?: string | null;
  seasonId?: string | null;
  eventId?: string | null;
  noteId?: string | null;
  taskId?: string | null;
  roleAssignmentId?: string | null;
}): Promise<void> {
  const authContext = await requireAuthContext();

  await requirePermission({
    actorUserId: authContext.clerkUserId,
    organizationId: input.organizationId,
    action: input.action,
    programId: input.programId,
    teamId: input.teamId,
    seasonId: input.seasonId,
    eventId: input.eventId,
    noteId: input.noteId,
    taskId: input.taskId,
    roleAssignmentId: input.roleAssignmentId,
  });
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

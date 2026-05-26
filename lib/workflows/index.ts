import {
  ApprovalStatus,
  AttendanceStatus,
  BookingStatus,
  ConsumableTransactionType,
  EventGearRequirementType,
  EventStatus,
  EventType,
  GearAssignmentStatus,
  GearCategoryBehaviorType,
  GearCheckoutStatus,
  GearConditionStatus,
  GearCustodyMode,
  GearIdentifierType,
  GearInventoryType,
  GearItemLifecycleStatus,
  GearMaintenanceFrequency,
  GearMaintenanceType,
  GearReportGroup,
  MemberLifecycleStatus,
  PrecheckStatus,
  Prisma,
  RoleType,
  RSVPStatus,
  RelationshipType,
  ScopeType,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthContext } from "@/lib/auth";
import { validateInventoryCodeValue } from "@/lib/inventory-scan";
import { PermissionDeniedError, requirePermission } from "@/lib/permissions";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 32;
const MAX_EVENT_TITLE_LENGTH = 160;
const MAX_EVENT_LOCATION_LENGTH = 200;
const MAX_BOOKING_TITLE_LENGTH = 160;
const MAX_BOOKING_DESCRIPTION_LENGTH = 4000;
const MAX_RSVP_REASON_LENGTH = 500;
const MAX_ATTENDANCE_REASON_CODE_LENGTH = 120;
const MAX_NOTE_BODY_LENGTH = 4000;
const MAX_TASK_TITLE_LENGTH = 160;
const MAX_TASK_DESCRIPTION_LENGTH = 4000;
const MAX_GEAR_DESCRIPTION_LENGTH = 1000;
const MAX_GEAR_NOTES_LENGTH = 4000;
const MAX_SKU_LENGTH = 100;
const MAX_SERIAL_NUMBER_LENGTH = 100;
const MAX_BARCODE_VALUE_LENGTH = 160;
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

export const joinPersonWorkflowSchema = z
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
    lifecycleStatus: z.nativeEnum(MemberLifecycleStatus, {
      message: "Lifecycle status must use an existing status value.",
    }),
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
    lifecycleStatus: value.lifecycleStatus,
  }));

export const memberLifecycleActivateSchema = z.object({
  confirm: z.literal("1", { message: "Activation confirmation is required." }),
});

export const memberLifecycleInactiveSchema = z.object({
  confirm: z.literal("1", { message: "Deactivation confirmation is required." }),
});

export const memberLifecycleArchiveSchema = z.object({
  confirm: z.literal("1", { message: "Archive confirmation is required." }),
});

export const seasonRolloverWorkflowSchema = z.object({
  targetSeasonId: z.string().trim().min(1, "Target season selection is required."),
  includeInactive: z.string().trim(),
  confirm: z.literal("1", { message: "Rollover confirmation is required." }),
});

export const memberMoveWorkflowSchema = z
  .object({
    sourceMembershipId: z.string().trim(),
    programId: z.string().trim().min(1, "Program selection is required."),
    teamId: z.string().trim().min(1, "Team selection is required."),
    seasonId: z.string().trim().min(1, "Season selection is required."),
    rosterRole: z.nativeEnum(RoleType, {
      message: "Roster role must use an existing role value.",
    }),
  })
  .transform((value) => ({
    sourceMembershipId: value.sourceMembershipId.length === 0 ? null : value.sourceMembershipId,
    programId: value.programId,
    teamId: value.teamId,
    seasonId: value.seasonId,
    rosterRole: value.rosterRole,
  }));

export const guardianRelationshipWorkflowSchema = z
  .object({
    guardianPersonId: z.string().trim().min(1, "Guardian selection is required."),
    relationshipType: z.nativeEnum(RelationshipType, {
      message: "Relationship type must use an existing relationship value.",
    }),
  })
  .transform((value) => ({
    guardianPersonId: value.guardianPersonId,
    relationshipType: value.relationshipType,
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

export const bookingRequestWorkflowSchema = z
  .object({
    facilityId: z.string().trim(),
    resourceId: z.string().trim().min(1, "Resource selection is required."),
    title: z
      .string()
      .trim()
      .min(1, "Booking title is required.")
      .max(MAX_BOOKING_TITLE_LENGTH, `Booking title must be ${MAX_BOOKING_TITLE_LENGTH} characters or less.`),
    description: z
      .string()
      .trim()
      .max(
        MAX_BOOKING_DESCRIPTION_LENGTH,
        `Description must be ${MAX_BOOKING_DESCRIPTION_LENGTH} characters or less.`,
      ),
    startsAt: z.string().trim().min(1, "Start date/time is required."),
    endsAt: z.string().trim().min(1, "End date/time is required."),
    programId: z.string().trim(),
    teamId: z.string().trim(),
    eventId: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (!DATETIME_LOCAL_INPUT_PATTERN.test(value.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startsAt"],
        message: "Start date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (!DATETIME_LOCAL_INPUT_PATTERN.test(value.endsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (
      DATETIME_LOCAL_INPUT_PATTERN.test(value.startsAt) &&
      DATETIME_LOCAL_INPUT_PATTERN.test(value.endsAt) &&
      value.endsAt <= value.startsAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date/time must be after start date/time.",
      });
    }
  })
  .transform((value) => ({
    facilityId: value.facilityId.length === 0 ? null : value.facilityId,
    resourceId: value.resourceId,
    title: value.title,
    description: value.description.length === 0 ? null : value.description,
    startsAt: dateTimeInputToUtcDate(value.startsAt),
    endsAt: dateTimeInputToUtcDate(value.endsAt),
    programId: value.programId.length === 0 ? null : value.programId,
    teamId: value.teamId.length === 0 ? null : value.teamId,
    eventId: value.eventId.length === 0 ? null : value.eventId,
    status: BookingStatus.REQUESTED,
    precheckStatus: PrecheckStatus.NOT_RUN,
    approvalStatus: ApprovalStatus.PENDING,
  }));

const booleanFromStringSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const gearCategoryWorkflowSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Category name is required.")
      .max(MAX_NAME_LENGTH, `Category name must be ${MAX_NAME_LENGTH} characters or less.`),
    inventoryType: z.nativeEnum(GearInventoryType, {
      message: "Inventory type must be DURABLE or CONSUMABLE.",
    }),
    description: z
      .string()
      .trim()
      .max(MAX_GEAR_DESCRIPTION_LENGTH, `Description must be ${MAX_GEAR_DESCRIPTION_LENGTH} characters or less.`),
    behaviorType: z.nativeEnum(GearCategoryBehaviorType, {
      message: "Behavior type must use an existing GearOps category behavior value.",
    }),
    custodyMode: z.nativeEnum(GearCustodyMode, {
      message: "Custody mode must use an existing GearOps custody value.",
    }),
    primaryIdentifierType: z.nativeEnum(GearIdentifierType, {
      message: "Primary identifier type must use an existing identifier value.",
    }),
    reportGroup: z.nativeEnum(GearReportGroup, {
      message: "Report group must use an existing report group value.",
    }),
    reportLabel: z
      .string()
      .trim()
      .max(MAX_NAME_LENGTH, `Report label must be ${MAX_NAME_LENGTH} characters or less.`),
    requiresReturnInspection: booleanFromStringSchema,
    requiresMaintenanceTracking: booleanFromStringSchema,
    maintenanceFrequency: z.union([
      z.nativeEnum(GearMaintenanceFrequency, {
        message: "Maintenance frequency must use an existing maintenance frequency value.",
      }),
      z.literal(""),
    ]),
    maintenanceIntervalDays: z.string().trim(),
    supportsConsumableTracking: booleanFromStringSchema,
    consumableLowStockDefault: z.string().trim(),
    supportsEventDeployment: booleanFromStringSchema,
    isKitContainer: booleanFromStringSchema,
    guardianApprovalRequired: booleanFromStringSchema,
    templateSlug: z.string().trim().max(MAX_NAME_LENGTH, `Template slug must be ${MAX_NAME_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    if (value.maintenanceIntervalDays.length > 0) {
      const interval = Number(value.maintenanceIntervalDays);
      if (!Number.isInteger(interval) || interval < 1 || interval > 3650) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maintenanceIntervalDays"],
          message: "Maintenance interval days must be a whole number between 1 and 3650.",
        });
      }
    }

    if (value.consumableLowStockDefault.length > 0) {
      const lowStock = Number(value.consumableLowStockDefault);
      if (!Number.isInteger(lowStock) || lowStock < 0 || lowStock > 999999) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["consumableLowStockDefault"],
          message: "Low stock default must be a whole number between 0 and 999999.",
        });
      }
    }
  })
  .transform((value) => ({
    name: value.name,
    inventoryType: value.inventoryType,
    description: value.description.length === 0 ? null : value.description,
    behaviorType: value.behaviorType,
    custodyMode: value.custodyMode,
    primaryIdentifierType: value.primaryIdentifierType,
    reportGroup: value.reportGroup,
    reportLabel: value.reportLabel.length === 0 ? null : value.reportLabel,
    requiresReturnInspection: value.requiresReturnInspection,
    requiresMaintenanceTracking: value.requiresMaintenanceTracking,
    maintenanceFrequency: value.maintenanceFrequency === "" ? null : value.maintenanceFrequency,
    maintenanceIntervalDays:
      value.maintenanceIntervalDays.length === 0 ? null : Number(value.maintenanceIntervalDays),
    supportsConsumableTracking: value.supportsConsumableTracking,
    consumableLowStockDefault:
      value.consumableLowStockDefault.length === 0 ? null : Number(value.consumableLowStockDefault),
    supportsEventDeployment: value.supportsEventDeployment,
    isKitContainer: value.isKitContainer,
    guardianApprovalRequired: value.guardianApprovalRequired,
    templateSlug: value.templateSlug.length === 0 ? null : value.templateSlug,
  }));

export const gearCategoryFieldWorkflowSchema = z
  .object({
    fieldKey: z
      .string()
      .trim()
      .min(1, "Field key is required.")
      .max(50, "Field key must be 50 characters or less.")
      .regex(/^[A-Za-z0-9_-]+$/, "Field key can only use letters, numbers, underscores, and dashes."),
    fieldLabel: z
      .string()
      .trim()
      .min(1, "Field label is required.")
      .max(80, "Field label must be 80 characters or less."),
    fieldType: z.enum(["text", "number", "date", "boolean", "select"], {
      message: "Field type must be text, number, date, boolean, or select.",
    }),
    fieldOptions: z.string().trim(),
    required: booleanFromStringSchema,
    displayOrder: z.string().trim(),
  })
  .superRefine((value, context) => {
    const displayOrder = Number(value.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 99) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["displayOrder"],
        message: "Display order must be a whole number between 0 and 99.",
      });
    }

    if (value.fieldType === "select" && value.fieldOptions.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldOptions"],
        message: "Select fields require one or more comma-separated options.",
      });
    }
  })
  .transform((value) => ({
    fieldKey: value.fieldKey,
    fieldLabel: value.fieldLabel,
    fieldType: value.fieldType,
    fieldOptions: value.fieldOptions.length === 0 ? null : value.fieldOptions,
    required: value.required,
    displayOrder: Number(value.displayOrder),
  }));

export const eventGearRequirementTemplateWorkflowSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Template name is required.")
      .max(100, "Template name must be 100 characters or less."),
    label: z
      .string()
      .trim()
      .min(1, "Requirement label is required.")
      .max(160, "Requirement label must be 160 characters or less."),
    gearCategoryId: z.string().trim(),
    requirementType: z.nativeEnum(EventGearRequirementType, {
      message: "Requirement type must use an existing requirement type value.",
    }),
    quantityNeeded: z.string().trim(),
    notes: z.string().trim().max(1000, "Notes must be 1000 characters or less."),
    description: z.string().trim().max(1000, "Description must be 1000 characters or less."),
    isActive: booleanFromStringSchema,
  })
  .superRefine((value, context) => {
    const quantityNeeded = Number(value.quantityNeeded);
    if (!Number.isInteger(quantityNeeded) || quantityNeeded < 1 || quantityNeeded > 999) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityNeeded"],
        message: "Quantity needed must be a whole number between 1 and 999.",
      });
    }
  })
  .transform((value) => ({
    name: value.name,
    label: value.label,
    gearCategoryId: value.gearCategoryId.length === 0 ? null : value.gearCategoryId,
    requirementType: value.requirementType,
    quantityNeeded: Number(value.quantityNeeded),
    notes: value.notes.length === 0 ? null : value.notes,
    description: value.description.length === 0 ? null : value.description,
    isActive: value.isActive,
  }));

export const gearOpsOrganizationSettingsWorkflowSchema = z.object({
  defaultCustodyMode: z.nativeEnum(GearCustodyMode, {
    message: "Default custody mode must use an existing custody mode value.",
  }),
  enableGuardianApproval: booleanFromStringSchema,
  enableConsumableTracking: booleanFromStringSchema,
  enableEventDeployment: booleanFromStringSchema,
  enableReadinessTracking: booleanFromStringSchema,
  enableMaintenanceTracking: booleanFromStringSchema,
  defaultReportGroup: z.nativeEnum(GearReportGroup, {
    message: "Default report group must use an existing report group value.",
  }),
  adminNotes: z.string().trim().max(2000, "Admin notes must be 2000 characters or less."),
}).transform((value) => ({
  defaultCustodyMode: value.defaultCustodyMode,
  enableGuardianApproval: value.enableGuardianApproval,
  enableConsumableTracking: value.enableConsumableTracking,
  enableEventDeployment: value.enableEventDeployment,
  enableReadinessTracking: value.enableReadinessTracking,
  enableMaintenanceTracking: value.enableMaintenanceTracking,
  defaultReportGroup: value.defaultReportGroup,
  adminNotes: value.adminNotes.length === 0 ? null : value.adminNotes,
}));

export const gearItemWorkflowSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Item name is required.")
      .max(MAX_NAME_LENGTH, `Item name must be ${MAX_NAME_LENGTH} characters or less.`),
    gearCategoryId: z.string().trim().min(1, "Category selection is required."),
    inventoryType: z.nativeEnum(GearInventoryType, {
      message: "Inventory type must be DURABLE or CONSUMABLE.",
    }),
    programId: z.string().trim(),
    sku: z
      .string()
      .trim()
      .max(MAX_SKU_LENGTH, `SKU must be ${MAX_SKU_LENGTH} characters or less.`),
    serialNumber: z
      .string()
      .trim()
      .max(MAX_SERIAL_NUMBER_LENGTH, `Serial number must be ${MAX_SERIAL_NUMBER_LENGTH} characters or less.`),
    barcodeValue: z
      .string()
      .trim()
      .max(MAX_BARCODE_VALUE_LENGTH, `Barcode/QR value must be ${MAX_BARCODE_VALUE_LENGTH} characters or less.`),
    quantityOnHand: z.string().trim(),
    quantityMin: z.string().trim(),
    lifecycleStatus: z.nativeEnum(GearItemLifecycleStatus, {
      message: "Lifecycle status must use an existing status value.",
    }),
    conditionStatus: z.string().trim(),
    notes: z
      .string()
      .trim()
      .max(MAX_GEAR_NOTES_LENGTH, `Notes must be ${MAX_GEAR_NOTES_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    const qty = value.quantityOnHand.length === 0 ? 0 : Number(value.quantityOnHand);
    if (!Number.isInteger(qty) || qty < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityOnHand"],
        message: "Quantity on hand must be a whole number of 0 or more.",
      });
    }

    if (value.quantityMin.length > 0) {
      const qtyMin = Number(value.quantityMin);
      if (!Number.isInteger(qtyMin) || qtyMin < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantityMin"],
          message: "Minimum stock quantity must be a whole number of 0 or more.",
        });
      }
    }

    if (value.conditionStatus.length > 0) {
      const valid = Object.values(GearConditionStatus) as string[];
      if (!valid.includes(value.conditionStatus)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditionStatus"],
          message: "Condition status must use an existing condition value.",
        });
      }
    }

    if (value.barcodeValue.length > 0) {
      const barcodeValidation = validateInventoryCodeValue(value.barcodeValue);
      if (!barcodeValidation.valid) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["barcodeValue"],
          message: barcodeValidation.message ?? "Barcode/QR value is invalid.",
        });
      }
    }
  })
  .transform((value) => ({
    name: value.name,
    gearCategoryId: value.gearCategoryId,
    inventoryType: value.inventoryType,
    programId: value.programId.length === 0 ? null : value.programId,
    sku: value.sku.length === 0 ? null : value.sku,
    serialNumber: value.serialNumber.length === 0 ? null : value.serialNumber,
    barcodeValue: value.barcodeValue.length === 0 ? null : value.barcodeValue,
    quantityOnHand: value.quantityOnHand.length === 0 ? 0 : Number(value.quantityOnHand),
    quantityMin: value.quantityMin.length === 0 ? null : Number(value.quantityMin),
    lifecycleStatus: value.lifecycleStatus,
    conditionStatus:
      value.conditionStatus.length === 0
        ? null
        : (value.conditionStatus as GearConditionStatus),
    notes: value.notes.length === 0 ? null : value.notes,
  }));

export const gearAssignmentWorkflowSchema = z
  .object({
    status: z.nativeEnum(GearAssignmentStatus, {
      message: "Assignment status must use a valid status value.",
    }),
    assignedToPersonId: z.string().trim(),
    assignedToTeamId: z.string().trim(),
    assignedToEventId: z.string().trim(),
    expectedReturnAt: z.string().trim(),
    returnedAt: z.string().trim(),
    notes: z
      .string()
      .trim()
      .max(MAX_GEAR_NOTES_LENGTH, `Notes must be ${MAX_GEAR_NOTES_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    const contextCount = [value.assignedToPersonId, value.assignedToTeamId, value.assignedToEventId].filter(
      (entry) => entry.length > 0,
    ).length;

    if (contextCount === 0) {
      const message = "Select one assignment context (person, team, or event).";
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToPersonId"],
        message,
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToTeamId"],
        message,
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToEventId"],
        message,
      });
    } else if (contextCount > 1) {
      const message = "Select only one assignment context (person, team, or event).";
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToPersonId"],
        message,
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToTeamId"],
        message,
      });
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToEventId"],
        message,
      });
    }

    if (value.expectedReturnAt.length > 0 && !DATETIME_LOCAL_INPUT_PATTERN.test(value.expectedReturnAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedReturnAt"],
        message: "Expected return must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (value.returnedAt.length > 0 && !DATETIME_LOCAL_INPUT_PATTERN.test(value.returnedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returnedAt"],
        message: "Returned at must use YYYY-MM-DDTHH:mm format.",
      });
    }
  })
  .transform((value) => ({
    status: value.status,
    assignedToPersonId: value.assignedToPersonId.length === 0 ? null : value.assignedToPersonId,
    assignedToTeamId: value.assignedToTeamId.length === 0 ? null : value.assignedToTeamId,
    assignedToEventId: value.assignedToEventId.length === 0 ? null : value.assignedToEventId,
    expectedReturnAt: value.expectedReturnAt.length === 0 ? null : dateTimeInputToUtcDate(value.expectedReturnAt),
    returnedAt: value.returnedAt.length === 0 ? null : dateTimeInputToUtcDate(value.returnedAt),
    notes: value.notes.length === 0 ? null : value.notes,
  }));

export const gearCheckoutWorkflowSchema = z
  .object({
    status: z.nativeEnum(GearCheckoutStatus, {
      message: "Checkout status must use a valid status value.",
    }),
    checkedOutById: z.string().trim(),
    issuedById: z.string().trim(),
    eventId: z.string().trim(),
    checkedOutAt: z.string().trim(),
    expectedReturnAt: z.string().trim(),
    returnedAt: z.string().trim(),
    returnedById: z.string().trim(),
    receivedById: z.string().trim(),
    conditionOnReturn: z.string().trim(),
    purposeNotes: z
      .string()
      .trim()
      .max(MAX_GEAR_NOTES_LENGTH, `Purpose notes must be ${MAX_GEAR_NOTES_LENGTH} characters or less.`),
    returnNotes: z
      .string()
      .trim()
      .max(MAX_GEAR_NOTES_LENGTH, `Return notes must be ${MAX_GEAR_NOTES_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    if (value.checkedOutById.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkedOutById"],
        message: "Select who currently has custody of this item.",
      });
    }

    if (value.issuedById.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issuedById"],
        message: "Select the staff member who issued this checkout.",
      });
    }

    if (value.checkedOutAt.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkedOutAt"],
        message: "Checkout date/time is required.",
      });
    } else if (!DATETIME_LOCAL_INPUT_PATTERN.test(value.checkedOutAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkedOutAt"],
        message: "Checkout date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (value.expectedReturnAt.length > 0 && !DATETIME_LOCAL_INPUT_PATTERN.test(value.expectedReturnAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedReturnAt"],
        message: "Expected return must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (value.returnedAt.length > 0 && !DATETIME_LOCAL_INPUT_PATTERN.test(value.returnedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returnedAt"],
        message: "Returned at must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (value.conditionOnReturn.length > 0) {
      const valid = Object.values(GearConditionStatus) as string[];
      if (!valid.includes(value.conditionOnReturn)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditionOnReturn"],
          message: "Condition on return must use an existing condition value.",
        });
      }
    }

    const isReturnedStatus = value.status === GearCheckoutStatus.RETURNED;
    if (isReturnedStatus) {
      if (value.returnedAt.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnedAt"],
          message: "Returned at is required when status is RETURNED.",
        });
      }
      if (value.returnedById.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnedById"],
          message: "Select who returned the item when status is RETURNED.",
        });
      }
      if (value.receivedById.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["receivedById"],
          message: "Select who received the item when status is RETURNED.",
        });
      }
    } else {
      if (value.returnedAt.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnedAt"],
          message: "Returned at can only be set when status is RETURNED.",
        });
      }
      if (value.returnedById.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnedById"],
          message: "Returned by can only be set when status is RETURNED.",
        });
      }
      if (value.receivedById.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["receivedById"],
          message: "Received by can only be set when status is RETURNED.",
        });
      }
      if (value.conditionOnReturn.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditionOnReturn"],
          message: "Condition on return can only be set when status is RETURNED.",
        });
      }
      if (value.returnNotes.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnNotes"],
          message: "Return notes can only be set when status is RETURNED.",
        });
      }
    }

    if (DATETIME_LOCAL_INPUT_PATTERN.test(value.checkedOutAt) && DATETIME_LOCAL_INPUT_PATTERN.test(value.expectedReturnAt)) {
      const checkedOutAt = dateTimeInputToUtcDate(value.checkedOutAt);
      const expectedReturnAt = dateTimeInputToUtcDate(value.expectedReturnAt);

      if (expectedReturnAt < checkedOutAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expectedReturnAt"],
          message: "Expected return must be after checkout date/time.",
        });
      }
    }

    if (DATETIME_LOCAL_INPUT_PATTERN.test(value.checkedOutAt) && DATETIME_LOCAL_INPUT_PATTERN.test(value.returnedAt)) {
      const checkedOutAt = dateTimeInputToUtcDate(value.checkedOutAt);
      const returnedAt = dateTimeInputToUtcDate(value.returnedAt);

      if (returnedAt < checkedOutAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["returnedAt"],
          message: "Returned at must be after checkout date/time.",
        });
      }
    }
  })
  .transform((value) => ({
    status: value.status,
    checkedOutById: value.checkedOutById,
    issuedById: value.issuedById,
    eventId: value.eventId.length === 0 ? null : value.eventId,
    checkedOutAt: dateTimeInputToUtcDate(value.checkedOutAt),
    expectedReturnAt: value.expectedReturnAt.length === 0 ? null : dateTimeInputToUtcDate(value.expectedReturnAt),
    returnedAt: value.returnedAt.length === 0 ? null : dateTimeInputToUtcDate(value.returnedAt),
    returnedById: value.returnedById.length === 0 ? null : value.returnedById,
    receivedById: value.receivedById.length === 0 ? null : value.receivedById,
    conditionOnReturn:
      value.conditionOnReturn.length === 0 ? null : (value.conditionOnReturn as GearConditionStatus),
    purposeNotes: value.purposeNotes.length === 0 ? null : value.purposeNotes,
    returnNotes: value.returnNotes.length === 0 ? null : value.returnNotes,
  }));

export const gearMaintenanceWorkflowSchema = z
  .object({
    maintenanceType: z.nativeEnum(GearMaintenanceType, {
      message: "Maintenance type must use a valid value.",
    }),
    performedByPersonId: z.string().trim(),
    performedAt: z.string().trim(),
    conditionBefore: z.string().trim(),
    conditionAfter: z.string().trim(),
    notes: z
      .string()
      .trim()
      .min(1, "Notes are required.")
      .max(MAX_GEAR_NOTES_LENGTH, `Notes must be ${MAX_GEAR_NOTES_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    if (value.performedByPersonId.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["performedByPersonId"],
        message: "Select who performed this maintenance.",
      });
    }

    if (value.performedAt.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["performedAt"],
        message: "Service date/time is required.",
      });
    } else if (!DATETIME_LOCAL_INPUT_PATTERN.test(value.performedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["performedAt"],
        message: "Service date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }

    if (value.conditionBefore.length > 0) {
      const valid = Object.values(GearConditionStatus) as string[];
      if (!valid.includes(value.conditionBefore)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditionBefore"],
          message: "Condition before must use an existing condition value.",
        });
      }
    }

    if (value.conditionAfter.length > 0) {
      const valid = Object.values(GearConditionStatus) as string[];
      if (!valid.includes(value.conditionAfter)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditionAfter"],
          message: "Condition after must use an existing condition value.",
        });
      }
    }
  })
  .transform((value) => ({
    maintenanceType: value.maintenanceType,
    performedByPersonId: value.performedByPersonId,
    performedAt: dateTimeInputToUtcDate(value.performedAt),
    conditionBefore: value.conditionBefore.length === 0 ? null : (value.conditionBefore as GearConditionStatus),
    conditionAfter: value.conditionAfter.length === 0 ? null : (value.conditionAfter as GearConditionStatus),
    notes: value.notes,
  }));

export const gearConsumableTransactionWorkflowSchema = z
  .object({
    transactionType: z.nativeEnum(ConsumableTransactionType, {
      message: "Transaction type must use a valid value.",
    }),
    quantityDelta: z.string().trim(),
    recordedAt: z.string().trim(),
    eventId: z.string().trim(),
    notes: z
      .string()
      .trim()
      .max(MAX_GEAR_NOTES_LENGTH, `Notes must be ${MAX_GEAR_NOTES_LENGTH} characters or less.`),
  })
  .superRefine((value, context) => {
    if (value.quantityDelta.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityDelta"],
        message: "Quantity is required.",
      });
    } else {
      const quantityDelta = Number(value.quantityDelta);
      if (!Number.isInteger(quantityDelta)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantityDelta"],
          message: "Quantity must be a whole number.",
        });
      } else {
        if (quantityDelta === 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["quantityDelta"],
            message: "Quantity must be greater than or less than zero.",
          });
        }

        if (value.transactionType === ConsumableTransactionType.RECEIVED && quantityDelta < 1) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["quantityDelta"],
            message: "RECEIVED transactions must use a positive quantity.",
          });
        }

        if (
          (value.transactionType === ConsumableTransactionType.USED ||
            value.transactionType === ConsumableTransactionType.DISTRIBUTED ||
            value.transactionType === ConsumableTransactionType.DISPOSED) &&
          quantityDelta > -1
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["quantityDelta"],
            message: `${value.transactionType} transactions must use a negative quantity.`,
          });
        }
      }
    }

    if (value.recordedAt.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordedAt"],
        message: "Recorded date/time is required.",
      });
    } else if (!DATETIME_LOCAL_INPUT_PATTERN.test(value.recordedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordedAt"],
        message: "Recorded date/time must use YYYY-MM-DDTHH:mm format.",
      });
    }
  })
  .transform((value) => ({
    transactionType: value.transactionType,
    quantityDelta: Number(value.quantityDelta),
    recordedAt: dateTimeInputToUtcDate(value.recordedAt),
    eventId: value.eventId.length === 0 ? null : value.eventId,
    notes: value.notes.length === 0 ? null : value.notes,
  }));

export type PersonWorkflowInput = z.output<typeof personWorkflowSchema>;
export type TeamWorkflowInput = z.output<typeof teamWorkflowSchema>;
export type ProgramWorkflowInput = z.output<typeof programWorkflowSchema>;
export type RosterMembershipWorkflowInput = z.output<typeof rosterMembershipWorkflowSchema>;
export type SeasonWorkflowInput = z.output<typeof seasonWorkflowSchema>;
export type SeasonRolloverWorkflowInput = z.output<typeof seasonRolloverWorkflowSchema>;
export type GuardianRelationshipWorkflowInput = z.output<typeof guardianRelationshipWorkflowSchema>;
export type RoleAssignmentWorkflowInput = z.output<typeof roleAssignmentWorkflowSchema>;
export type EventWorkflowInput = z.output<typeof eventWorkflowSchema>;
export type RsvpWorkflowInput = z.output<typeof rsvpWorkflowSchema>;
export type AttendanceWorkflowInput = z.output<typeof attendanceWorkflowSchema>;
export type NoteWorkflowInput = z.output<typeof noteWorkflowSchema>;
export type FollowUpTaskWorkflowInput = z.output<typeof followUpTaskWorkflowSchema>;
export type BookingRequestWorkflowInput = z.output<typeof bookingRequestWorkflowSchema>;
export type GearCategoryWorkflowInput = z.output<typeof gearCategoryWorkflowSchema>;
export type GearCategoryFieldWorkflowInput = z.output<typeof gearCategoryFieldWorkflowSchema>;
export type EventGearRequirementTemplateWorkflowInput = z.output<typeof eventGearRequirementTemplateWorkflowSchema>;
export type GearOpsOrganizationSettingsWorkflowInput = z.output<typeof gearOpsOrganizationSettingsWorkflowSchema>;
export type GearItemWorkflowInput = z.output<typeof gearItemWorkflowSchema>;
export type GearAssignmentWorkflowInput = z.output<typeof gearAssignmentWorkflowSchema>;
export type GearCheckoutWorkflowInput = z.output<typeof gearCheckoutWorkflowSchema>;
export type GearMaintenanceWorkflowInput = z.output<typeof gearMaintenanceWorkflowSchema>;
export type GearConsumableTransactionWorkflowInput = z.output<typeof gearConsumableTransactionWorkflowSchema>;

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
    | "person.activate"
    | "person.deactivate"
    | "person.archive"
    | "person.move"
    | "guardianRelationship.create"
    | "guardianRelationship.update"
    | "team.create"
    | "season.create"
    | "season.update"
    | "season.rollover"
    | "event.create"
    | "event.update"
    | "rsvp.upsert"
    | "attendance.upsert"
    | "note.create"
    | "note.update"
    | "task.create"
    | "task.update"
    | "booking.create"
    | "booking.approve"
    | "booking.deny"
    | "rosterMembership.create"
    | "rosterMembership.delete"
    | "roleAssignment.create"
    | "roleAssignment.delete"
    | "gearCategory.create"
    | "gearCategory.update"
    | "gearCategoryField.create"
    | "gearCategoryField.delete"
    | "gearItem.create"
    | "gearItem.update"
    | "eventGearPlan.create"
    | "eventGearPlan.update"
    | "eventGearRequirement.create"
    | "eventGearRequirementTemplate.create"
    | "eventGearRequirementTemplate.update"
    | "eventGearAssignment.create"
    | "eventGearAssignment.update"
    | "gearAssignment.create"
    | "gearAssignment.update"
    | "gearCheckout.create"
    | "gearCheckout.update"
    | "gearMaintenance.create"
    | "gearMaintenance.update"
    | "gearConsumableTransaction.create"
    | "gearConsumableTransaction.update"
    | "gearOpsSettings.update";
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

function isSeasonLike(season: SeasonLike): season is SeasonLike {
  return Boolean(season?.id && season?.name);
}

export function selectSeededOrCurrentSeason(seasons: Array<SeasonLike>): SeasonLike | null {
  const safeSeasons = seasons.filter(isSeasonLike);

  if (safeSeasons.length === 0) {
    return null;
  }

  const now = new Date();

  const currentSeason = safeSeasons.find((season) => {
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

  const demoSeason = safeSeasons.find((season) => season.name.toLowerCase().includes("demo"));

  if (demoSeason) {
    return demoSeason;
  }

  return safeSeasons[0] ?? null;
}

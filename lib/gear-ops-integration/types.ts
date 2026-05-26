/**
 * Arc 20M — GearOps Cross-Module Integration Readiness
 *
 * Typed reference contracts for cross-module linking.
 *
 * GearOps uses these lightweight reference types to point to adjacent module
 * concepts (people, athletes, guardians, teams, events, tasks, notes) without
 * owning their source of truth.
 *
 * Design principles:
 * - All references are read-only views; GearOps does not mutate adjacent models.
 * - Each reference carries an organizationId for scope verification.
 * - Availability signals allow graceful degradation when adjacent modules are
 *   incomplete or data is missing.
 * - No competing person, team, event, task, or note model is introduced here.
 */

// ── Module availability status ───────────────────────────────────────────────

/**
 * Availability status for a cross-module reference.
 *
 * - "available"   — The adjacent module exists and the reference resolved.
 * - "unavailable" — The adjacent module exists but the reference is missing or
 *                   the record could not be found (data gap, not a code gap).
 * - "deferred"    — Full integration with this module is explicitly deferred to
 *                   a later arc.  GearOps shows a placeholder / fallback UI.
 */
export type GearModuleReferenceStatus = "available" | "unavailable" | "deferred";

// ── Person reference ─────────────────────────────────────────────────────────

/**
 * Lightweight person reference used by GearOps for assignment and custody.
 * Backed by the shared Person model — not a duplicate person concept.
 */
export type GearPersonReference = {
  personId: string;
  displayName: string;
  organizationId: string;
};

// ── Athlete reference ────────────────────────────────────────────────────────

/**
 * Athlete-aware person reference.
 *
 * An "athlete" in GearOps is a Person who has one or more
 * AthleteGuardianRelationship records in the same organization.
 * This reference carries guardian presence signals so GearOps can apply
 * guardian-approval rules at assignment time without duplicating the
 * guardian management model.
 */
export type GearAthleteReference = GearPersonReference & {
  isAthlete: true;
  hasGuardianOnFile: boolean;
  guardianPersonIds: string[];
};

// ── Guardian reference ───────────────────────────────────────────────────────

/**
 * Guardian reference for approval boundary checks.
 * Derived from the shared AthleteGuardianRelationship model.
 */
export type GearGuardianReference = {
  guardianPersonId: string;
  athletePersonId: string;
  guardianDisplayName: string;
  relationshipType: string;
  organizationId: string;
};

// ── Team reference ───────────────────────────────────────────────────────────

/**
 * Lightweight team reference used by GearOps for assignment and context
 * filtering.  Backed by the shared Team model.
 */
export type GearTeamReference = {
  teamId: string;
  teamName: string;
  organizationId: string;
  programId: string | null;
};

// ── Event reference ──────────────────────────────────────────────────────────

/**
 * Lightweight event reference used by GearOps for gear plans and deployments.
 * Backed by the shared Event model — no duplicate scheduling model.
 */
export type GearEventReference = {
  eventId: string;
  eventTitle: string;
  organizationId: string;
  startsAt: Date | null;
  teamId: string | null;
  programId: string | null;
};

// ── Task reference ───────────────────────────────────────────────────────────

/**
 * Reference to a FollowUpTask linked from a GearOps workflow.
 * GearOps may link to or create follow-up tasks (maintenance, return,
 * inspection, recovery) but does not own the task model.
 */
export type GearTaskReference = {
  taskId: string;
  title: string;
  status: string;
  assigneePersonId: string;
  organizationId: string;
  sourceGearItemId: string | null;
};

// ── Note reference ───────────────────────────────────────────────────────────

/**
 * Reference to an ObservationNote linked from GearOps context.
 * GearOps condition notes and maintenance notes remain authoritative inside
 * GearOps; this reference enables navigation to the shared note stream
 * without duplicating the audit record.
 */
export type GearNoteReference = {
  noteId: string;
  body: string;
  authorPersonId: string;
  organizationId: string;
  linkedPersonId: string | null;
  linkedTeamId: string | null;
  linkedEventId: string | null;
};

// ── Activity reference ───────────────────────────────────────────────────────

/**
 * Reference to an InventoryMovement or operational history item for
 * cross-module navigation.  Enables surfacing GearOps activity in the
 * shared operational feed without duplicating the movement record.
 */
export type GearActivityReference = {
  activityId: string;
  activityType: string;
  subjectId: string;
  subjectType: string;
  organizationId: string;
  occurredAt: Date;
  actorPersonId: string | null;
};

// ── Integration context ──────────────────────────────────────────────────────

/**
 * GearOpsIntegrationContext
 *
 * Assembled cross-module context for a GearOps item or workflow screen.
 * Carries resolved references and per-module availability signals so UI code
 * can decide what to render and when to show fallback messages.
 *
 * This context is read-only from GearOps; adjacent modules remain the source
 * of truth for their own data.
 */
export type GearOpsIntegrationContext = {
  organizationId: string;
  gearItemId: string;
  assignedPerson: GearPersonReference | null;
  assignedTeam: GearTeamReference | null;
  assignedEvent: GearEventReference | null;
  athleteReference: GearAthleteReference | null;
  guardianApprovalRequired: boolean;
  guardianReferences: GearGuardianReference[];
  linkedTasks: GearTaskReference[];
  linkedNotes: GearNoteReference[];
  integrationAvailability: GearOpsIntegrationAvailability;
};

/**
 * Per-module availability status for GearOps cross-module integration.
 *
 * Each field represents whether GearOps can currently resolve references to
 * that adjacent module.  "deferred" means the integration is known future
 * work but not yet implemented.
 */
export type GearOpsIntegrationAvailability = {
  personModule: GearModuleReferenceStatus;
  athleteModule: GearModuleReferenceStatus;
  guardianModule: GearModuleReferenceStatus;
  teamModule: GearModuleReferenceStatus;
  eventModule: GearModuleReferenceStatus;
  taskModule: GearModuleReferenceStatus;
  noteModule: GearModuleReferenceStatus;
  communicationModule: GearModuleReferenceStatus;
};

// ── Guardian approval boundary ───────────────────────────────────────────────

/**
 * Guardian approval decision for a gear assignment to an athlete.
 *
 * GearOps evaluates this boundary before confirming an assignment when
 * GearCategory.guardianApprovalRequired is true and the recipient is an
 * athlete (has guardian relationships).
 */
export type GearGuardianApprovalBoundary = {
  required: boolean;
  reason: GearGuardianApprovalReason;
  guardianReferences: GearGuardianReference[];
  canProceedWithoutApproval: boolean;
  blockerMessage: string | null;
};

export type GearGuardianApprovalReason =
  | "not_required"
  | "category_requires_approval"
  | "no_guardian_on_file"
  | "guardian_available";

// ── Cross-module link ────────────────────────────────────────────────────────

/**
 * A generic cross-module link record.
 * Represents a directional pointer from a GearOps entity to a shared module
 * entity.  Used for cross-module navigation helpers and link panels.
 */
export type GearCrossModuleLink = {
  fromType: "GEAR_ITEM" | "GEAR_ASSIGNMENT" | "GEAR_CHECKOUT" | "GEAR_MAINTENANCE" | "EVENT_GEAR_PLAN";
  fromId: string;
  toType: "PERSON" | "TEAM" | "EVENT" | "TASK" | "NOTE" | "ENTRY";
  toId: string;
  organizationId: string;
  linkLabel: string | null;
};

// ── Selector option ──────────────────────────────────────────────────────────

/**
 * Minimal display option for person/team/event selector dropdowns.
 * Used in assignment forms to avoid passing full reference objects to the UI.
 */
export type GearSelectorOption = {
  id: string;
  label: string;
};

// ── Helper: build display name ───────────────────────────────────────────────

/** Formats a person's display name from firstName + lastName parts. */
export function formatGearPersonDisplayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();

  if (!first && !last) return "(unnamed)";
  if (!last) return first;
  if (!first) return last;

  return `${last}, ${first}`;
}

// ── Helper: build integration availability from present flags ────────────────

/**
 * Builds a GearOpsIntegrationAvailability object from a set of boolean flags.
 *
 * Pass `true` for modules that are active in the current CadreOS deployment
 * and `false` for those that are not yet reachable.  "deferred" is used for
 * the communication module which is explicitly out of scope for Arc 20M.
 */
export function buildGearOpsIntegrationAvailability(flags: {
  personModuleActive: boolean;
  athleteModuleActive: boolean;
  guardianModuleActive: boolean;
  teamModuleActive: boolean;
  eventModuleActive: boolean;
  taskModuleActive: boolean;
  noteModuleActive: boolean;
}): GearOpsIntegrationAvailability {
  return {
    personModule: flags.personModuleActive ? "available" : "unavailable",
    athleteModule: flags.athleteModuleActive ? "available" : "unavailable",
    guardianModule: flags.guardianModuleActive ? "available" : "unavailable",
    teamModule: flags.teamModuleActive ? "available" : "unavailable",
    eventModule: flags.eventModuleActive ? "available" : "unavailable",
    taskModule: flags.taskModuleActive ? "available" : "unavailable",
    noteModule: flags.noteModuleActive ? "available" : "unavailable",
    communicationModule: "deferred",
  };
}

// ── Helper: build fallback availability (all deferred/unavailable) ───────────

/**
 * Returns a fully-degraded availability object for use when GearOps is
 * operating in standalone mode (no adjacent module data available).
 * Communication integration is always deferred.
 */
export function buildGearOpsStandaloneAvailability(): GearOpsIntegrationAvailability {
  return {
    personModule: "unavailable",
    athleteModule: "unavailable",
    guardianModule: "unavailable",
    teamModule: "unavailable",
    eventModule: "unavailable",
    taskModule: "unavailable",
    noteModule: "unavailable",
    communicationModule: "deferred",
  };
}

// ── Helper: format integration status message ────────────────────────────────

/**
 * Returns a human-readable fallback message for a given module reference status.
 * Used in UI panels where cross-module data is not available.
 */
export function formatGearModuleReferenceStatusMessage(
  moduleName: string,
  status: GearModuleReferenceStatus,
): string {
  if (status === "available") return `${moduleName} integration is active.`;
  if (status === "deferred") return `${moduleName} integration is planned for a future arc.`;

  return `${moduleName} data is not available in the current context.`;
}

// ── Helper: guardian display formatters ─────────────────────────────────────

/** Converts a SNAKE_CASE relationship type enum to a Title Case label. */
export function formatGuardianRelationshipTypeLabel(relationshipType: string): string {
  return relationshipType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Formats a human-readable guardian list summary for display in a GearOps
 * assignment confirmation or warning panel.
 */
export function formatGuardianApprovalSummary(guardianReferences: GearGuardianReference[]): string {
  if (guardianReferences.length === 0) {
    return "No guardians on file.";
  }

  if (guardianReferences.length === 1) {
    const ref = guardianReferences[0]!;

    return `Guardian: ${ref.guardianDisplayName} (${formatGuardianRelationshipTypeLabel(ref.relationshipType)})`;
  }

  const names = guardianReferences
    .map((ref) => `${ref.guardianDisplayName} (${formatGuardianRelationshipTypeLabel(ref.relationshipType)})`)
    .join(", ");

  return `Guardians: ${names}`;
}

/**
 * Formats a GearGuardianApprovalBoundary into a human-readable decision
 * message suitable for an assignment confirmation UI.
 */
export function formatGuardianApprovalBoundaryMessage(boundary: GearGuardianApprovalBoundary): string {
  if (!boundary.required) {
    return "No guardian approval required for this gear category.";
  }

  if (boundary.reason === "no_guardian_on_file") {
    return boundary.blockerMessage ?? "Guardian approval required but no guardian is on file.";
  }

  const guardianSummary = formatGuardianApprovalSummary(boundary.guardianReferences);

  return `Guardian approval required. ${guardianSummary} Confirm approval before completing assignment.`;
}

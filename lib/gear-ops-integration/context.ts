/**
 * Arc 20M — GearOps Cross-Module Integration Readiness
 *
 * GearOpsContextSelector — assembles GearOpsIntegrationContext for item detail
 * screens and workflows.
 *
 * This is the high-level entry point for integration-aware GearOps pages.
 * It composes the per-reference resolvers and produces a single context object
 * that pages can pass to their rendering logic without needing to know which
 * adjacent modules are active.
 *
 * All failures are caught and surfaced as "unavailable" availability signals
 * rather than thrown errors, so GearOps standalone operability is preserved
 * when adjacent module data is missing or the DB schema is incomplete.
 */

import type { GearOpsIntegrationContext, GearOpsIntegrationAvailability } from "./types";
import { buildGearOpsIntegrationAvailability, buildGearOpsStandaloneAvailability } from "./types";
import {
  resolveGearPersonReference,
  resolveGearAthleteReference,
  resolveGearGuardianReferences,
  resolveGearTeamReference,
  resolveGearEventReference,
  resolveGearTaskReferences,
  resolveGearNoteReferences,
} from "./resolver";
import { db } from "@/lib/db";

// ── Context input ─────────────────────────────────────────────────────────────

export type GearOpsContextSelectorInput = {
  organizationId: string;
  gearItemId: string;
  /** personId of the current person assignment holder (if any) */
  assignedPersonId?: string | null;
  /** teamId of the current team assignment (if any) */
  assignedTeamId?: string | null;
  /** eventId of the current event assignment (if any) */
  assignedEventId?: string | null;
};

// ── Context selector ──────────────────────────────────────────────────────────

/**
 * Assembles a GearOpsIntegrationContext for the given gear item.
 *
 * Resolves person, athlete, guardian, team, event, task, and note references
 * in parallel.  Each resolution step is isolated — a failure in one step does
 * not prevent others from completing.
 *
 * Returns a fully populated context with per-module availability signals.
 * Callers can check `context.integrationAvailability` to decide what to render.
 */
export async function selectGearOpsIntegrationContext(
  input: GearOpsContextSelectorInput,
): Promise<GearOpsIntegrationContext> {
  // Resolve all references in parallel; catch individual failures gracefully.
  const [personResult, teamResult, eventResult, taskResult, noteResult, categoryResult] =
    await Promise.allSettled([
      input.assignedPersonId
        ? resolveGearPersonReference({
            organizationId: input.organizationId,
            personId: input.assignedPersonId,
          })
        : Promise.resolve(null),

      input.assignedTeamId
        ? resolveGearTeamReference({
            organizationId: input.organizationId,
            teamId: input.assignedTeamId,
          })
        : Promise.resolve(null),

      input.assignedEventId
        ? resolveGearEventReference({
            organizationId: input.organizationId,
            eventId: input.assignedEventId,
          })
        : Promise.resolve(null),

      resolveGearTaskReferences({
        organizationId: input.organizationId,
        gearItemId: input.gearItemId,
      }),

      resolveGearNoteReferences({
        organizationId: input.organizationId,
        gearItemId: input.gearItemId,
      }),

      // Resolve gear item's category for guardian approval flag
      db.gearItem
        .findFirst({
          where: { id: input.gearItemId, organizationId: input.organizationId },
          select: { category: { select: { guardianApprovalRequired: true } } },
        })
        .catch(() => null),
    ]);

  const assignedPerson = personResult.status === "fulfilled" ? personResult.value : null;
  const assignedTeam = teamResult.status === "fulfilled" ? teamResult.value : null;
  const assignedEvent = eventResult.status === "fulfilled" ? eventResult.value : null;
  const linkedTasks = taskResult.status === "fulfilled" ? taskResult.value : [];
  const linkedNotes = noteResult.status === "fulfilled" ? noteResult.value : [];
  const categoryData = categoryResult.status === "fulfilled" ? categoryResult.value : null;

  const guardianApprovalRequired = categoryData?.category?.guardianApprovalRequired ?? false;

  // Resolve athlete and guardian references for the assigned person, if any.
  let athleteReference = null;
  let guardianReferences: Awaited<ReturnType<typeof resolveGearGuardianReferences>> = [];

  if (assignedPerson) {
    try {
      [athleteReference, guardianReferences] = await Promise.all([
        resolveGearAthleteReference({
          organizationId: input.organizationId,
          personId: assignedPerson.personId,
        }),
        guardianApprovalRequired
          ? resolveGearGuardianReferences({
              organizationId: input.organizationId,
              athletePersonId: assignedPerson.personId,
            })
          : Promise.resolve([]),
      ]);
    } catch {
      // Graceful degradation: if guardian resolution fails, continue without it.
      athleteReference = null;
      guardianReferences = [];
    }
  }

  const availability = buildAvailabilityFromResults({
    personResult,
    teamResult,
    eventResult,
    taskResult,
    noteResult,
    hasAthleteData: athleteReference !== null,
    hasGuardianData: guardianReferences.length > 0 || guardianApprovalRequired,
  });

  return {
    organizationId: input.organizationId,
    gearItemId: input.gearItemId,
    assignedPerson,
    assignedTeam,
    assignedEvent,
    athleteReference,
    guardianApprovalRequired,
    guardianReferences,
    linkedTasks,
    linkedNotes,
    integrationAvailability: availability,
  };
}

// ── Standalone context factory ────────────────────────────────────────────────

/**
 * Returns a fully-degraded GearOpsIntegrationContext for use in standalone
 * or error-recovery scenarios where adjacent module data cannot be loaded.
 *
 * GearOps continues to operate normally with this context; cross-module panels
 * will display fallback messages.
 */
export function buildGearOpsStandaloneContext(input: {
  organizationId: string;
  gearItemId: string;
}): GearOpsIntegrationContext {
  return {
    organizationId: input.organizationId,
    gearItemId: input.gearItemId,
    assignedPerson: null,
    assignedTeam: null,
    assignedEvent: null,
    athleteReference: null,
    guardianApprovalRequired: false,
    guardianReferences: [],
    linkedTasks: [],
    linkedNotes: [],
    integrationAvailability: buildGearOpsStandaloneAvailability(),
  };
}

// ── Availability builder ──────────────────────────────────────────────────────

function buildAvailabilityFromResults(flags: {
  personResult: PromiseSettledResult<unknown>;
  teamResult: PromiseSettledResult<unknown>;
  eventResult: PromiseSettledResult<unknown>;
  taskResult: PromiseSettledResult<unknown>;
  noteResult: PromiseSettledResult<unknown>;
  hasAthleteData: boolean;
  hasGuardianData: boolean;
}): GearOpsIntegrationAvailability {
  return buildGearOpsIntegrationAvailability({
    personModuleActive: flags.personResult.status === "fulfilled",
    athleteModuleActive: flags.hasAthleteData,
    guardianModuleActive: flags.hasGuardianData,
    teamModuleActive: flags.teamResult.status === "fulfilled",
    eventModuleActive: flags.eventResult.status === "fulfilled",
    taskModuleActive: flags.taskResult.status === "fulfilled",
    noteModuleActive: flags.noteResult.status === "fulfilled",
  });
}

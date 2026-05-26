/**
 * Arc 20M — GearOps Cross-Module Integration Readiness
 *
 * Reference resolver — DB-backed lookups for cross-module references.
 *
 * All queries are organization-scoped and fail gracefully: a missing record
 * returns null rather than throwing, so GearOps screens can degrade cleanly.
 *
 * These resolvers do NOT own or duplicate the source-of-truth models.
 * They are lightweight adapters that translate existing shared-model rows
 * into GearOps reference types.
 */

import { db } from "@/lib/db";
import type {
  GearAthleteReference,
  GearEventReference,
  GearGuardianReference,
  GearNoteReference,
  GearPersonReference,
  GearSelectorOption,
  GearTaskReference,
  GearTeamReference,
} from "./types";
import { formatGearPersonDisplayName } from "./types";

// ── Person reference resolution ──────────────────────────────────────────────

/**
 * Resolves a single GearPersonReference from the shared Person model.
 * Returns null if the person is not found in the given organization.
 */
export async function resolveGearPersonReference(input: {
  organizationId: string;
  personId: string;
}): Promise<GearPersonReference | null> {
  const person = await db.person.findFirst({
    where: { id: input.personId, organizationId: input.organizationId },
    select: { id: true, firstName: true, lastName: true, organizationId: true },
  });

  if (!person) return null;

  return {
    personId: person.id,
    displayName: formatGearPersonDisplayName(person.firstName, person.lastName),
    organizationId: person.organizationId,
  };
}

// ── Athlete reference resolution ─────────────────────────────────────────────

/**
 * Resolves a GearAthleteReference for a person.
 *
 * A person is treated as an "athlete" in GearOps when they have at least one
 * AthleteGuardianRelationship record in the same organization.  This does not
 * create a separate athlete model — it reads existing guardian relationships.
 *
 * Returns null if the person is not found or has no guardian relationships.
 */
export async function resolveGearAthleteReference(input: {
  organizationId: string;
  personId: string;
}): Promise<GearAthleteReference | null> {
  const person = await db.person.findFirst({
    where: { id: input.personId, organizationId: input.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organizationId: true,
      athleteLinks: {
        where: { organizationId: input.organizationId },
        select: { guardianPersonId: true },
      },
    },
  });

  if (!person) return null;

  // Only persons with guardian relationships are considered athletes in GearOps.
  if (person.athleteLinks.length === 0) return null;

  return {
    personId: person.id,
    displayName: formatGearPersonDisplayName(person.firstName, person.lastName),
    organizationId: person.organizationId,
    isAthlete: true,
    hasGuardianOnFile: person.athleteLinks.length > 0,
    guardianPersonIds: person.athleteLinks.map((link: { guardianPersonId: string }) => link.guardianPersonId),
  };
}

// ── Guardian reference resolution ────────────────────────────────────────────

/**
 * Resolves all GearGuardianReferences for an athlete person.
 *
 * Returns an empty array if the person has no guardian relationships in the
 * given organization.  GearOps uses this to evaluate approval boundaries for
 * categories with guardianApprovalRequired = true.
 */
export async function resolveGearGuardianReferences(input: {
  organizationId: string;
  athletePersonId: string;
}): Promise<GearGuardianReference[]> {
  const relationships = await db.athleteGuardianRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      athletePersonId: input.athletePersonId,
    },
    select: {
      guardianPersonId: true,
      athletePersonId: true,
      relationshipType: true,
      guardian: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return relationships.map((rel: {
    guardianPersonId: string;
    athletePersonId: string;
    relationshipType: string;
    guardian: { firstName: string | null; lastName: string | null };
  }) => ({
    guardianPersonId: rel.guardianPersonId,
    athletePersonId: rel.athletePersonId,
    guardianDisplayName: formatGearPersonDisplayName(rel.guardian.firstName, rel.guardian.lastName),
    relationshipType: rel.relationshipType,
    organizationId: input.organizationId,
  }));
}

// ── Team reference resolution ─────────────────────────────────────────────────

/**
 * Resolves a single GearTeamReference from the shared Team model.
 * Returns null if the team is not found in the given organization.
 */
export async function resolveGearTeamReference(input: {
  organizationId: string;
  teamId: string;
}): Promise<GearTeamReference | null> {
  const team = await db.team.findFirst({
    where: { id: input.teamId, organizationId: input.organizationId },
    select: { id: true, name: true, organizationId: true, programId: true },
  });

  if (!team) return null;

  return {
    teamId: team.id,
    teamName: team.name,
    organizationId: team.organizationId,
    programId: team.programId,
  };
}

// ── Event reference resolution ───────────────────────────────────────────────

/**
 * Resolves a single GearEventReference from the shared Event model.
 * Returns null if the event is not found in the given organization.
 */
export async function resolveGearEventReference(input: {
  organizationId: string;
  eventId: string;
}): Promise<GearEventReference | null> {
  const event = await db.event.findFirst({
    where: { id: input.eventId, organizationId: input.organizationId },
    select: {
      id: true,
      title: true,
      organizationId: true,
      startsAt: true,
      teamId: true,
      programId: true,
    },
  });

  if (!event) return null;

  return {
    eventId: event.id,
    eventTitle: event.title,
    organizationId: event.organizationId,
    startsAt: event.startsAt,
    teamId: event.teamId,
    programId: event.programId,
  };
}

// ── Task reference resolution ─────────────────────────────────────────────────

/**
 * Resolves GearTaskReferences for tasks linked to a gear item via
 * EntryObjectLink or tasks whose title references the item by ID.
 *
 * GearOps uses EntryObjectLink to surface follow-up tasks created after
 * maintenance flags, condition failures, or recovery issues.
 *
 * Returns an empty array if no linked tasks are found.
 */
export async function resolveGearTaskReferences(input: {
  organizationId: string;
  gearItemId: string;
}): Promise<GearTaskReference[]> {
  // Find FollowUpTasks linked via EntryObjectLink to this gear item.
  const linkedEntries = await db.entryObjectLink.findMany({
    where: {
      organizationId: input.organizationId,
      targetType: "GEAR_ITEM",
      targetId: input.gearItemId,
      entry: {
        type: "TASK",
        deletedAt: null,
        sourceTask: { isNot: null },
      },
    },
    select: {
      entry: {
        select: {
          sourceTask: {
            select: {
              id: true,
              title: true,
              status: true,
              assigneePersonId: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });

  const tasks: GearTaskReference[] = [];

  for (const link of linkedEntries) {
    const task = link.entry?.sourceTask;

    if (task) {
      tasks.push({
        taskId: task.id,
        title: task.title,
        status: task.status,
        assigneePersonId: task.assigneePersonId,
        organizationId: task.organizationId,
        sourceGearItemId: input.gearItemId,
      });
    }
  }

  return tasks;
}

// ── Note reference resolution ─────────────────────────────────────────────────

/**
 * Resolves GearNoteReferences for ObservationNotes linked to a gear item via
 * EntryObjectLink.
 *
 * Returns an empty array if no linked notes are found.
 */
export async function resolveGearNoteReferences(input: {
  organizationId: string;
  gearItemId: string;
}): Promise<GearNoteReference[]> {
  const linkedEntries = await db.entryObjectLink.findMany({
    where: {
      organizationId: input.organizationId,
      targetType: "GEAR_ITEM",
      targetId: input.gearItemId,
      entry: {
        type: "NOTE",
        deletedAt: null,
        sourceNote: { isNot: null },
      },
    },
    select: {
      entry: {
        select: {
          sourceNote: {
            select: {
              id: true,
              body: true,
              authorPersonId: true,
              organizationId: true,
              athletePersonId: true,
              teamId: true,
              eventId: true,
            },
          },
        },
      },
    },
  });

  const notes: GearNoteReference[] = [];

  for (const link of linkedEntries) {
    const note = link.entry?.sourceNote;

    if (note) {
      notes.push({
        noteId: note.id,
        body: note.body,
        authorPersonId: note.authorPersonId,
        organizationId: note.organizationId,
        linkedPersonId: note.athletePersonId,
        linkedTeamId: note.teamId,
        linkedEventId: note.eventId,
      });
    }
  }

  return notes;
}

// ── Person selector ──────────────────────────────────────────────────────────

/**
 * Returns a list of GearSelectorOptions for all active persons in an
 * organization, suitable for use in assignment form dropdowns.
 *
 * The list is sorted by last name then first name.
 */
export async function resolveGearPersonSelectorOptions(input: {
  organizationId: string;
}): Promise<GearSelectorOption[]> {
  const people = await db.person.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return people.map((person: { id: string; firstName: string | null; lastName: string | null }) => ({
    id: person.id,
    label: formatGearPersonDisplayName(person.firstName, person.lastName),
  }));
}

// ── Team selector ────────────────────────────────────────────────────────────

/**
 * Returns a list of GearSelectorOptions for all teams in an organization,
 * suitable for assignment form dropdowns.
 */
export async function resolveGearTeamSelectorOptions(input: {
  organizationId: string;
}): Promise<GearSelectorOption[]> {
  const teams = await db.team.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }],
  });

  return teams.map((team: { id: string; name: string }) => ({
    id: team.id,
    label: team.name,
  }));
}

// ── Event selector ───────────────────────────────────────────────────────────

/**
 * Returns a list of GearSelectorOptions for recent events in an organization,
 * suitable for event gear plan and assignment form dropdowns.
 *
 * Results are limited to 50 most recent events by start time.
 */
export async function resolveGearEventSelectorOptions(input: {
  organizationId: string;
  limit?: number;
}): Promise<GearSelectorOption[]> {
  const events = await db.event.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, title: true, startsAt: true },
    orderBy: [{ startsAt: "desc" }],
    take: input.limit ?? 50,
  });

  return events.map((event: { id: string; title: string; startsAt: Date | null }) => ({
    id: event.id,
    label: event.startsAt
      ? `${event.title} — ${event.startsAt.toISOString().slice(0, 10)}`
      : event.title,
  }));
}

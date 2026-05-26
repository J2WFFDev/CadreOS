import type { OperationalGraphNodeType, OperationalRelationshipType } from "@prisma/client";

import { db } from "@/lib/db";
import type {
  LinkOperationalRecordsInput,
  ListRelatedOperationalRecordsInput,
  OperationalGraphNodeRef,
  OperationalNodeView,
  RelatedOperationalRecord,
  UnlinkOperationalRecordsInput,
} from "./types";

async function assertPersonInOrganization(organizationId: string, personId: string) {
  const person = await db.person.findFirst({
    where: { id: personId, organizationId },
    select: { id: true },
  });
  return Boolean(person);
}

async function nodeExists(organizationId: string, node: OperationalGraphNodeRef): Promise<boolean> {
  switch (node.nodeType) {
    case "ENTRY":
      return Boolean(await db.entry.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "PERSON":
      return Boolean(await db.person.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "TEAM":
      return Boolean(await db.team.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "PROGRAM":
      return Boolean(await db.program.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "SEASON":
      return Boolean(await db.season.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "EVENT":
      return Boolean(await db.event.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "ATTENDANCE_RECORD":
      return Boolean(await db.attendanceRecord.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "FACILITY":
      return Boolean(await db.facility.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "FACILITY_RESOURCE":
      return Boolean(await db.facilityResource.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "RESOURCE_BOOKING":
      return Boolean(await db.resourceBooking.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "GEAR_ITEM":
      return Boolean(await db.gearItem.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "GEAR_ASSIGNMENT":
      return Boolean(await db.gearAssignment.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "GEAR_CHECKOUT":
      return Boolean(await db.gearCheckout.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "GEAR_MAINTENANCE_LOG":
      return Boolean(await db.gearMaintenanceLog.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "CONSUMABLE_TRANSACTION":
      return Boolean(await db.consumableTransaction.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "FOLLOW_UP_TASK":
      return Boolean(await db.followUpTask.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "OBSERVATION_NOTE":
      return Boolean(await db.observationNote.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "ROSTER_MEMBERSHIP":
      return Boolean(await db.rosterMembership.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }));
    case "ATHLETE_GUARDIAN_RELATIONSHIP":
      return Boolean(
        await db.athleteGuardianRelationship.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true } }),
      );
    default:
      return false;
  }
}

async function writeEntryGraphActivity(input: {
  organizationId: string;
  actorPersonId: string;
  action: string;
  relationshipId: string;
  relationshipType: OperationalRelationshipType;
  from: OperationalGraphNodeRef;
  to: OperationalGraphNodeRef;
}) {
  const entryIds = [input.from, input.to].filter((node) => node.nodeType === "ENTRY").map((node) => node.nodeId);
  if (entryIds.length === 0) return;

  await Promise.all(
    Array.from(new Set(entryIds)).map(async (entryId) => {
      const entry = await db.entry.findFirst({
        where: { id: entryId, organizationId: input.organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!entry) return;

      await db.entryActivity.create({
        data: {
          organizationId: input.organizationId,
          entryId: entry.id,
          actorPersonId: input.actorPersonId,
          action: input.action,
          metadataJson: JSON.stringify({
            relationshipId: input.relationshipId,
            relationshipType: input.relationshipType,
            from: input.from,
            to: input.to,
          }),
        },
      });
    }),
  );
}

function parseMetadataJson(value: string | null): string | null {
  if (!value) return null;
  return value;
}

export async function linkOperationalRecords(input: LinkOperationalRecordsInput) {
  if (input.from.nodeType === input.to.nodeType && input.from.nodeId === input.to.nodeId) {
    throw new Error("Cannot link a record to itself.");
  }

  const [actorInOrg, fromExists, toExists] = await Promise.all([
    assertPersonInOrganization(input.organizationId, input.createdByPersonId),
    nodeExists(input.organizationId, input.from),
    nodeExists(input.organizationId, input.to),
  ]);

  if (!actorInOrg) throw new Error("Actor is not in the active organization.");
  if (!fromExists) throw new Error("Source record was not found in the active organization.");
  if (!toExists) throw new Error("Target record was not found in the active organization.");

  const relationship = await db.operationalRelationship.upsert({
    where: {
      organizationId_fromNodeType_fromNodeId_toNodeType_toNodeId_relationshipType: {
        organizationId: input.organizationId,
        fromNodeType: input.from.nodeType,
        fromNodeId: input.from.nodeId,
        toNodeType: input.to.nodeType,
        toNodeId: input.to.nodeId,
        relationshipType: input.relationshipType,
      },
    },
    create: {
      organizationId: input.organizationId,
      fromNodeType: input.from.nodeType,
      fromNodeId: input.from.nodeId,
      toNodeType: input.to.nodeType,
      toNodeId: input.to.nodeId,
      relationshipType: input.relationshipType,
      createdByPersonId: input.createdByPersonId,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    update: {
      removedAt: null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    select: {
      id: true,
      fromNodeType: true,
      fromNodeId: true,
      toNodeType: true,
      toNodeId: true,
      relationshipType: true,
      createdAt: true,
      metadataJson: true,
    },
  });

  await writeEntryGraphActivity({
    organizationId: input.organizationId,
    actorPersonId: input.createdByPersonId,
    action: "entry.graph_link_added",
    relationshipId: relationship.id,
    relationshipType: relationship.relationshipType,
    from: { nodeType: relationship.fromNodeType, nodeId: relationship.fromNodeId },
    to: { nodeType: relationship.toNodeType, nodeId: relationship.toNodeId },
  });

  return {
    ...relationship,
    metadataJson: parseMetadataJson(relationship.metadataJson),
  };
}

export async function unlinkOperationalRecords(input: UnlinkOperationalRecordsInput) {
  const relationship = await db.operationalRelationship.findFirst({
    where: {
      organizationId: input.organizationId,
      fromNodeType: input.from.nodeType,
      fromNodeId: input.from.nodeId,
      toNodeType: input.to.nodeType,
      toNodeId: input.to.nodeId,
      relationshipType: input.relationshipType,
      removedAt: null,
    },
    select: { id: true, relationshipType: true, fromNodeType: true, fromNodeId: true, toNodeType: true, toNodeId: true },
  });

  if (!relationship) return null;

  const actorInOrg = await assertPersonInOrganization(input.organizationId, input.actorPersonId);
  if (!actorInOrg) throw new Error("Actor is not in the active organization.");

  await db.operationalRelationship.update({
    where: { id: relationship.id },
    data: { removedAt: new Date() },
  });

  await writeEntryGraphActivity({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    action: "entry.graph_link_removed",
    relationshipId: relationship.id,
    relationshipType: relationship.relationshipType,
    from: { nodeType: relationship.fromNodeType, nodeId: relationship.fromNodeId },
    to: { nodeType: relationship.toNodeType, nodeId: relationship.toNodeId },
  });

  return relationship;
}

async function resolveOperationalNodeView(organizationId: string, node: OperationalGraphNodeRef): Promise<OperationalNodeView> {
  switch (node.nodeType) {
    case "ENTRY": {
      const entry = await db.entry.findFirst({
        where: { id: node.nodeId, organizationId },
        select: { id: true, title: true, type: true },
      });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: entry ? `${entry.type}: ${entry.title}` : `Entry ${node.nodeId}`,
        subtitle: entry ? null : "Record unavailable",
        href: entry ? `/entries/${entry.id}` : null,
      };
    }
    case "PERSON": {
      const person = await db.person.findFirst({
        where: { id: node.nodeId, organizationId },
        select: { id: true, firstName: true, lastName: true, lifecycleStatus: true },
      });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: person ? `${person.firstName} ${person.lastName}` : `Person ${node.nodeId}`,
        subtitle: person?.lifecycleStatus ?? null,
        href: person ? `/people/${person.id}` : null,
      };
    }
    case "TEAM": {
      const team = await db.team.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, name: true } });
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: team?.name ?? `Team ${node.nodeId}`, subtitle: null, href: team ? `/teams/${team.id}` : null };
    }
    case "PROGRAM": {
      const program = await db.program.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, name: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: program?.name ?? `Program ${node.nodeId}`,
        subtitle: null,
        href: program ? `/programs/${program.id}` : null,
      };
    }
    case "SEASON": {
      const season = await db.season.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, name: true, programId: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: season?.name ?? `Season ${node.nodeId}`,
        subtitle: season ? `Program ${season.programId}` : null,
        href: season ? `/programs/${season.programId}/seasons/${season.id}/edit` : null,
      };
    }
    case "EVENT": {
      const event = await db.event.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, title: true, startsAt: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: event?.title ?? `Event ${node.nodeId}`,
        subtitle: event?.startsAt.toISOString().slice(0, 10) ?? null,
        href: event ? `/events/${event.id}` : null,
      };
    }
    case "ATTENDANCE_RECORD":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Attendance ${node.nodeId}`, subtitle: null, href: null };
    case "FACILITY": {
      const facility = await db.facility.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, name: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: facility?.name ?? `Facility ${node.nodeId}`,
        subtitle: null,
        href: facility ? `/field-ops/facilities/${facility.id}` : null,
      };
    }
    case "FACILITY_RESOURCE": {
      const resource = await db.facilityResource.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, name: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: resource?.name ?? `Resource ${node.nodeId}`,
        subtitle: "Facility resource",
        href: resource ? `/field-ops/resources/${resource.id}` : null,
      };
    }
    case "RESOURCE_BOOKING": {
      const booking = await db.resourceBooking.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, title: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: booking?.title ?? `Booking ${node.nodeId}`,
        subtitle: "Reservation",
        href: booking ? `/field-ops/bookings/${booking.id}` : null,
      };
    }
    case "GEAR_ITEM": {
      const gearItem = await db.gearItem.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, name: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: gearItem?.name ?? `Gear item ${node.nodeId}`,
        subtitle: null,
        href: gearItem ? `/gear-ops/items/${gearItem.id}` : null,
      };
    }
    case "GEAR_ASSIGNMENT":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Gear assignment ${node.nodeId}`, subtitle: null, href: null };
    case "GEAR_CHECKOUT":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Gear checkout ${node.nodeId}`, subtitle: null, href: null };
    case "GEAR_MAINTENANCE_LOG":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Maintenance log ${node.nodeId}`, subtitle: null, href: null };
    case "CONSUMABLE_TRANSACTION":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Inventory transaction ${node.nodeId}`, subtitle: null, href: null };
    case "FOLLOW_UP_TASK": {
      const task = await db.followUpTask.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, title: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: task?.title ?? `Task ${node.nodeId}`,
        subtitle: "Follow-up task",
        href: task ? `/tasks/${task.id}` : null,
      };
    }
    case "OBSERVATION_NOTE": {
      const note = await db.observationNote.findFirst({ where: { id: node.nodeId, organizationId }, select: { id: true, body: true } });
      return {
        nodeType: node.nodeType,
        nodeId: node.nodeId,
        title: note ? (note.body.length > 64 ? `${note.body.slice(0, 61)}...` : note.body) : `Note ${node.nodeId}`,
        subtitle: "Observation note",
        href: note ? `/notes/${note.id}` : null,
      };
    }
    case "ROSTER_MEMBERSHIP":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Roster membership ${node.nodeId}`, subtitle: null, href: null };
    case "ATHLETE_GUARDIAN_RELATIONSHIP":
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: `Guardian relationship ${node.nodeId}`, subtitle: null, href: null };
    default:
      return { nodeType: node.nodeType, nodeId: node.nodeId, title: node.nodeId, subtitle: null, href: null };
  }
}

export async function listRelatedOperationalRecords(input: ListRelatedOperationalRecordsInput): Promise<RelatedOperationalRecord[]> {
  const relationships = await db.operationalRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      removedAt: null,
      ...(input.relationshipTypes?.length ? { relationshipType: { in: input.relationshipTypes } } : {}),
      OR: [
        { fromNodeType: input.node.nodeType, fromNodeId: input.node.nodeId },
        { toNodeType: input.node.nodeType, toNodeId: input.node.nodeId },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 30,
    select: {
      id: true,
      fromNodeType: true,
      fromNodeId: true,
      toNodeType: true,
      toNodeId: true,
      relationshipType: true,
      createdAt: true,
    },
  });

  return Promise.all(
    relationships.map(async (relationship) => {
      const isFrom = relationship.fromNodeType === input.node.nodeType && relationship.fromNodeId === input.node.nodeId;
      const node: OperationalGraphNodeRef = isFrom
        ? { nodeType: relationship.toNodeType, nodeId: relationship.toNodeId }
        : { nodeType: relationship.fromNodeType, nodeId: relationship.fromNodeId };

      return {
        id: relationship.id,
        relationshipType: relationship.relationshipType,
        direction: isFrom ? "OUTBOUND" : "INBOUND",
        node: await resolveOperationalNodeView(input.organizationId, node),
        createdAt: relationship.createdAt,
      };
    }),
  );
}

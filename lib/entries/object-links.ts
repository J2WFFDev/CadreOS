import { EntryObjectLinkTargetType, OperationalRelationshipType } from "@prisma/client";

import { db } from "@/lib/db";

export type EntryObjectLinkRow = {
  id: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
  createdAt: Date;
};

export type EntryObjectLinkView = {
  id: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  state: "RESOLVED" | "UNAVAILABLE" | "INACCESSIBLE";
  createdAt: Date;
};

const ENTRY_OBJECT_TARGET_LABELS: Record<EntryObjectLinkTargetType, string> = {
  PERSON: "Person",
  TEAM: "Team",
  PROGRAM: "Program",
  SEASON: "Season",
  EVENT: "Event",
  ATTENDANCE_RECORD: "Attendance",
  FACILITY: "Facility",
  FACILITY_RESOURCE: "Resource",
  RESOURCE_BOOKING: "Reservation",
  GEAR_ITEM: "Gear item",
  GEAR_ASSIGNMENT: "Gear assignment",
  GEAR_CHECKOUT: "Gear checkout",
  GEAR_MAINTENANCE_LOG: "Maintenance record",
  FOLLOW_UP_TASK: "Task",
  OBSERVATION_NOTE: "Note",
  INVENTORY_LOCATION: "Inventory location",
  INVENTORY_MOVEMENT: "Inventory movement",
  INVENTORY_KIT: "Inventory kit",
};

export function labelForEntryObjectLinkTargetType(targetType: EntryObjectLinkTargetType): string {
  return ENTRY_OBJECT_TARGET_LABELS[targetType] ?? targetType;
}

export function defaultRelationshipTypeForEntryObjectTarget(
  targetType: EntryObjectLinkTargetType,
): OperationalRelationshipType {
  if (targetType === EntryObjectLinkTargetType.EVENT) return "OBSERVED_DURING";
  if (targetType === EntryObjectLinkTargetType.RESOURCE_BOOKING) return "READINESS_FOR";
  return "RELATED_TO";
}

export function isEntryObjectLinkTargetType(value: string): value is EntryObjectLinkTargetType {
  return Object.values(EntryObjectLinkTargetType).includes(value as EntryObjectLinkTargetType);
}

export async function entryObjectTargetExists(input: {
  organizationId: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
}): Promise<boolean> {
  const base = { id: input.targetId, organizationId: input.organizationId };

  switch (input.targetType) {
    case "PERSON":
      return Boolean(await db.person.findFirst({ where: base, select: { id: true } }));
    case "TEAM":
      return Boolean(await db.team.findFirst({ where: base, select: { id: true } }));
    case "PROGRAM":
      return Boolean(await db.program.findFirst({ where: base, select: { id: true } }));
    case "SEASON":
      return Boolean(await db.season.findFirst({ where: base, select: { id: true } }));
    case "EVENT":
      return Boolean(await db.event.findFirst({ where: base, select: { id: true } }));
    case "ATTENDANCE_RECORD":
      return Boolean(await db.attendanceRecord.findFirst({ where: base, select: { id: true } }));
    case "FACILITY":
      return Boolean(await db.facility.findFirst({ where: base, select: { id: true } }));
    case "FACILITY_RESOURCE":
      return Boolean(await db.facilityResource.findFirst({ where: base, select: { id: true } }));
    case "RESOURCE_BOOKING":
      return Boolean(await db.resourceBooking.findFirst({ where: base, select: { id: true } }));
    case "GEAR_ITEM":
      return Boolean(await db.gearItem.findFirst({ where: base, select: { id: true } }));
    case "GEAR_ASSIGNMENT":
      return Boolean(await db.gearAssignment.findFirst({ where: base, select: { id: true } }));
    case "GEAR_CHECKOUT":
      return Boolean(await db.gearCheckout.findFirst({ where: base, select: { id: true } }));
    case "GEAR_MAINTENANCE_LOG":
      return Boolean(await db.gearMaintenanceLog.findFirst({ where: base, select: { id: true } }));
    case "FOLLOW_UP_TASK":
      return Boolean(await db.followUpTask.findFirst({ where: base, select: { id: true } }));
    case "OBSERVATION_NOTE":
      return Boolean(await db.observationNote.findFirst({ where: base, select: { id: true } }));
    case "INVENTORY_LOCATION":
      return Boolean(await db.inventoryLocation.findFirst({ where: base, select: { id: true } }));
    case "INVENTORY_MOVEMENT":
      return Boolean(await db.inventoryMovement.findFirst({ where: base, select: { id: true } }));
    case "INVENTORY_KIT":
      return Boolean(await db.inventoryKit.findFirst({ where: base, select: { id: true } }));
    default:
      return false;
  }
}

async function resolveEntryObjectLinkTarget(input: {
  organizationId: string;
  targetType: EntryObjectLinkTargetType;
  targetId: string;
}): Promise<{ title: string; subtitle: string | null; href: string | null } | null> {
  const base = { id: input.targetId, organizationId: input.organizationId };

  switch (input.targetType) {
    case "PERSON": {
      const person = await db.person.findFirst({
        where: base,
        select: { id: true, firstName: true, lastName: true, lifecycleStatus: true },
      });
      if (!person) return null;
      return {
        title: `${person.firstName} ${person.lastName}`.trim(),
        subtitle: person.lifecycleStatus,
        href: `/people/${person.id}`,
      };
    }
    case "TEAM": {
      const team = await db.team.findFirst({ where: base, select: { id: true, name: true } });
      if (!team) return null;
      return { title: team.name, subtitle: "Team", href: `/teams/${team.id}` };
    }
    case "PROGRAM": {
      const program = await db.program.findFirst({ where: base, select: { id: true, name: true } });
      if (!program) return null;
      return { title: program.name, subtitle: "Program", href: `/programs/${program.id}` };
    }
    case "SEASON": {
      const season = await db.season.findFirst({
        where: base,
        select: { id: true, name: true, programId: true },
      });
      if (!season) return null;
      return {
        title: season.name,
        subtitle: "Season",
        href: `/programs/${season.programId}/seasons/${season.id}/edit`,
      };
    }
    case "EVENT": {
      const event = await db.event.findFirst({ where: base, select: { id: true, title: true, startsAt: true } });
      if (!event) return null;
      return {
        title: event.title,
        subtitle: event.startsAt.toISOString().slice(0, 10),
        href: `/events/${event.id}`,
      };
    }
    case "ATTENDANCE_RECORD":
      return { title: "Attendance record", subtitle: "Attendance", href: null };
    case "FACILITY": {
      const facility = await db.facility.findFirst({ where: base, select: { id: true, name: true } });
      if (!facility) return null;
      return { title: facility.name, subtitle: "Facility", href: `/field-ops/facilities/${facility.id}` };
    }
    case "FACILITY_RESOURCE": {
      const resource = await db.facilityResource.findFirst({ where: base, select: { id: true, name: true } });
      if (!resource) return null;
      return { title: resource.name, subtitle: "Resource", href: `/field-ops/resources/${resource.id}` };
    }
    case "RESOURCE_BOOKING": {
      const booking = await db.resourceBooking.findFirst({ where: base, select: { id: true, title: true } });
      if (!booking) return null;
      return { title: booking.title, subtitle: "Reservation", href: `/field-ops/bookings/${booking.id}` };
    }
    case "GEAR_ITEM": {
      const gearItem = await db.gearItem.findFirst({ where: base, select: { id: true, name: true } });
      if (!gearItem) return null;
      return { title: gearItem.name, subtitle: "Gear item", href: `/gear-ops/items/${gearItem.id}` };
    }
    case "GEAR_ASSIGNMENT": {
      const assignment = await db.gearAssignment.findFirst({ where: base, select: { id: true, gearItemId: true } });
      if (!assignment) return null;
      return {
        title: "Gear assignment",
        subtitle: "Assignment",
        href: assignment.gearItemId ? `/gear-ops/items/${assignment.gearItemId}/assignments/${assignment.id}/edit` : null,
      };
    }
    case "GEAR_CHECKOUT": {
      const checkout = await db.gearCheckout.findFirst({ where: base, select: { id: true, gearItemId: true } });
      if (!checkout) return null;
      return {
        title: "Gear checkout",
        subtitle: "Checkout",
        href: checkout.gearItemId ? `/gear-ops/items/${checkout.gearItemId}/checkouts/${checkout.id}/edit` : null,
      };
    }
    case "GEAR_MAINTENANCE_LOG": {
      const maintenance = await db.gearMaintenanceLog.findFirst({
        where: base,
        select: { id: true, gearItemId: true },
      });
      if (!maintenance) return null;
      return {
        title: "Maintenance record",
        subtitle: "Gear maintenance",
        href: maintenance.gearItemId
          ? `/gear-ops/items/${maintenance.gearItemId}/maintenance/${maintenance.id}/edit`
          : null,
      };
    }
    case "FOLLOW_UP_TASK": {
      const task = await db.followUpTask.findFirst({ where: base, select: { id: true, title: true } });
      if (!task) return null;
      return { title: task.title, subtitle: "Task", href: `/tasks/${task.id}` };
    }
    case "OBSERVATION_NOTE": {
      const note = await db.observationNote.findFirst({ where: base, select: { id: true, body: true } });
      if (!note) return null;
      return {
        title: note.body.length > 64 ? `${note.body.slice(0, 61)}...` : note.body,
        subtitle: "Note",
        href: `/notes/${note.id}`,
      };
    }
    case "INVENTORY_LOCATION": {
      const location = await db.inventoryLocation.findFirst({
        where: base,
        select: { id: true, name: true, locationCode: true },
      });
      if (!location) return null;
      return {
        title: location.name,
        subtitle: location.locationCode || "Inventory location",
        href: `/gear-ops/locations/${location.id}`,
      };
    }
    case "INVENTORY_MOVEMENT": {
      const movement = await db.inventoryMovement.findFirst({
        where: base,
        select: { movementType: true, occurredAt: true },
      });
      if (!movement) return null;
      return {
        title: `Movement: ${movement.movementType.replace(/_/g, " ")}`,
        subtitle: movement.occurredAt.toISOString().slice(0, 10),
        href: null,
      };
    }
    case "INVENTORY_KIT": {
      const kit = await db.inventoryKit.findFirst({ where: base, select: { id: true, name: true } });
      if (!kit) return null;
      return { title: kit.name, subtitle: "Inventory kit", href: `/gear-ops/kits/${kit.id}` };
    }
    default:
      return null;
  }
}

export async function resolveEntryObjectLinkViews(input: {
  organizationId: string;
  links: EntryObjectLinkRow[];
  canViewTargetDetails: boolean;
}): Promise<EntryObjectLinkView[]> {
  if (!input.canViewTargetDetails) {
    return input.links.map((link) => ({
      id: link.id,
      targetType: link.targetType,
      targetId: link.targetId,
      title: "Linked record (restricted)",
      subtitle: "You do not have access to this linked record.",
      href: null,
      state: "INACCESSIBLE",
      createdAt: link.createdAt,
    }));
  }

  return Promise.all(
    input.links.map(async (link) => {
      const target = await resolveEntryObjectLinkTarget({
        organizationId: input.organizationId,
        targetType: link.targetType,
        targetId: link.targetId,
      });

      if (!target) {
        return {
          id: link.id,
          targetType: link.targetType,
          targetId: link.targetId,
          title: "Linked record unavailable",
          subtitle: `${labelForEntryObjectLinkTargetType(link.targetType)} record is deleted, unresolved, or inaccessible.`,
          href: null,
          state: "UNAVAILABLE",
          createdAt: link.createdAt,
        } satisfies EntryObjectLinkView;
      }

      return {
        id: link.id,
        targetType: link.targetType,
        targetId: link.targetId,
        title: target.title,
        subtitle: target.subtitle,
        href: target.href,
        state: "RESOLVED",
        createdAt: link.createdAt,
      } satisfies EntryObjectLinkView;
    }),
  );
}
